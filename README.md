# Gantry

Every swap gets read as it passes.

A Uniswap v4 hook that prices each swap by the caller's on-chain behaviour. Sandwich bots pay
more, the surplus stays with the pool's LPs, and nobody is ever blocked from trading.

A toll gantry reads a vehicle at speed, classifies it, and bills it accordingly without anyone
stopping. Same idea, applied to a liquidity pool.

## How it works

Behaviour is scored off-chain from indexed history and written to `TierOracle` in batches. The
hook reads one storage slot in `beforeSwap` and returns an overriding fee for that swap only.

| Tier | Meaning | Fee |
| --- | --- | --- |
| 0 | Clean history | 0.05% |
| 1 | Unknown, the default | 0.30% |
| 2 | Some extraction signal | 0.60% |
| 3 | Repeat extractor | 1.00% |

An address nobody has scored yet lands on tier 1, never tier 0, so rotating to a fresh address
does not escape the toll.

## Layout

- `contracts/src/Gantry.sol` - the hook. Fee selection lives in `_beforeSwap`.
- `contracts/src/TierOracle.sol` - behaviour tiers, batch written, single read on the swap path.
- `scorer/` - reads `Swap` logs straight from an RPC, finds sandwiches, assigns tiers.
- `substreams/` - `map_swaps` extracts v4 swaps, `map_sandwiches` consumes it.
- `indexer/` - subgraph over `Tolled` and `TierSet`, building per-address history.
- `mcp/` - ask an MCP client why an address pays what it pays.
- `scripts/demo.sh` - the whole loop on a local chain.

## The loop

```bash
anvil --disable-code-size-limit &
./scripts/demo.sh
```

It deploys a pool, has a bot sandwich a trader inside one block, scores that from
chain data, publishes the tiers, then sends two identical swaps and prints the
difference. Last run:

```
swaps 3  addresses 2  sandwiches 1
0x2279...ebe6  suspected swaps=2 blocks=1 sandwiches=1 victims=1
0x8a79...c318  unknown   swaps=1 blocks=1 sandwiches=0 victims=0

  sandwicher receives 9929150195924421
  trader     receives 9957135968097604
  difference 27985772173183 (0.28%)
```

## Traders behind a router

`beforeSwap` sees whoever called the PoolManager, which for a shared router is the
router. A bot trading from its own contract is therefore priced on its own history,
while everyone behind one router looks the same. A trader can sign an attestation
and pass it as hook data to be priced as themselves; anything malformed, expired or
signed by the wrong key quietly falls back to pricing the caller.

## Live on Sepolia

| Contract | Address |
| --- | --- |
| Gantry hook | [`0x42A5B912625E0b9Aba3286CEfA3BB823DDAE0080`](https://sepolia.etherscan.io/address/0x42A5B912625E0b9Aba3286CEfA3BB823DDAE0080) |
| TierOracle | [`0x846d3eF24c3c6e079Bd95cFeACC08B21427C9132`](https://sepolia.etherscan.io/address/0x846d3eF24c3c6e079Bd95cFeACC08B21427C9132) |
| TierReportReceiver | [`0x351278Ef6FF1325c69127255936e5E7d0B47A1A4`](https://sepolia.etherscan.io/address/0x351278Ef6FF1325c69127255936e5E7d0B47A1A4) |
| PoolManager | `0xE03A1074c86CFeDd5C142C4F04F1a1536e203543` (Uniswap canonical) |

Subgraph: `https://api.studio.thegraph.com/query/1760064/gantry/0.0.1`

The hook address ends `0080` because v4 reads a hook's permissions out of its own address.
The salt was mined until the low 14 bits equalled 128, the `BEFORE_SWAP` bit.

### One address, two prices

The fee is decided in [`Gantry._beforeSwap`](contracts/src/Gantry.sol). These three tolls
are on Sepolia, same pool, same swap size:

```
block 11677086  0xd54db805...  tier 3  fee 1.00%
block 11677086  0x82fdc5c7...  tier 1  fee 0.30%
block 11677137  0x82fdc5c7...  tier 0  fee 0.05%
```

The last two are the same address. Between them a signed report moved it from the default
tier to clean, and the next identical swap cost six times less.

## Setup

```bash
cd contracts
forge install Uniswap/v4-core --no-git
forge install Uniswap/v4-periphery --no-git
forge install OpenZeppelin/uniswap-hooks@v1.1.1 --no-git
forge test -vv
```

Local deploy:

```bash
anvil --disable-code-size-limit
PRIVATE_KEY=0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80 \
  forge script script/Deploy.s.sol:Deploy \
  --rpc-url http://127.0.0.1:8545 --broadcast --disable-code-size-limit
```

Both size-limit flags are needed because Uniswap's `PoolManager` is 34,623 bytes and exceeds
EIP-170. On a live network set `POOL_MANAGER` to the canonical deployment instead and the
script will use it.

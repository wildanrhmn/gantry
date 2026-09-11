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
- `substreams/` - `map_swaps` extracts v4 swaps, `map_sandwiches` and `map_attempts` consume it.
- `indexer/` - subgraph over `Tolled` and `TierSet`, building per-address history.
- `indexer-mainnet/` - subgraph over Uniswap v4's mainnet PoolManager, which every page reads live.
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
| Gantry hook | [`0xa3D2A9ee28198496D5DF469A8FF149aD2d780080`](https://sepolia.etherscan.io/address/0xa3D2A9ee28198496D5DF469A8FF149aD2d780080) |
| Demo pool router | [`0x867a6f9CAcC6d7341Fad9d0d5Fac193dF684C0a9`](https://sepolia.etherscan.io/address/0x867a6f9CAcC6d7341Fad9d0d5Fac193dF684C0a9) |
| TierOracle | [`0x846d3eF24c3c6e079Bd95cFeACC08B21427C9132`](https://sepolia.etherscan.io/address/0x846d3eF24c3c6e079Bd95cFeACC08B21427C9132) |
| TierReportReceiver | [`0x351278Ef6FF1325c69127255936e5E7d0B47A1A4`](https://sepolia.etherscan.io/address/0x351278Ef6FF1325c69127255936e5E7d0B47A1A4) |
| PoolManager | `0xE03A1074c86CFeDd5C142C4F04F1a1536e203543` (Uniswap canonical) |

Subgraphs:

- mainnet behaviour — `https://api.studio.thegraph.com/query/1760064/gantry-mainnet/v0.0.2`
- Gantry's own events — `https://api.studio.thegraph.com/query/1760064/gantry/0.0.2`

The hook address ends `0080` because v4 reads a hook's permissions out of its own address.
The salt was mined until the low 14 bits equalled 128, the `BEFORE_SWAP` bit.

### Where to look in the code

| What | Where |
| --- | --- |
| The fee decision | [`Gantry.sol#L71-L81`](contracts/src/Gantry.sol#L71-L81) — `_beforeSwap` returns `fee \| OVERRIDE_FEE_FLAG` |
| Hook permissions | [`Gantry.sol#L52`](contracts/src/Gantry.sol#L52) — `beforeSwap` only |
| Router vs trader | [`Gantry.sol#L100-L118`](contracts/src/Gantry.sol#L100-L118) — `_resolvePayer`, and why an attestation exists |
| Signable attestation | [`Gantry.sol#L86-L90`](contracts/src/Gantry.sol#L86-L90) — EIP-712 digest |
| Fail open, never revert | [`Gantry.sol#L120-L127`](contracts/src/Gantry.sol#L120-L127) — a bad oracle cannot halt the pool |
| Routers cannot be priced up | [`TierOracle.sol#L99-L104`](contracts/src/TierOracle.sol#L99-L104) — `_set` clamps shared addresses |

Feedback on building against the v4 stack is in [FEEDBACK.md](FEEDBACK.md).

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

### Swapping against it

The pool's tokens mint freely, so anyone can try it: connect on Sepolia, mint gUSD, approve
the router, swap. The hook charges whatever tier the caller sits on.

Because a shared router is what calls the PoolManager, the hook sees the router rather than
the trader. A trader can sign an EIP-712 attestation and pass it as hook data to be priced
as themselves instead. That is what the `Attestation(address trader,bytes32 poolId,uint256
deadline)` type in [`Gantry.sol`](contracts/src/Gantry.sol) is for.

## How The Graph is used

Two products, composed.

**Substreams** — nine modules in `substreams/`, published to the registry at
[substreams.dev/packages/gantry](https://substreams.dev/packages/gantry/v0.1.0) so anyone can
compose against them. `map_swaps` extracts every Uniswap v4 swap on Ethereum mainnet,
`map_sandwiches` consumes that output and finds extraction, `map_attempts` reads transaction
traces, four stores accumulate per-address totals across blocks, and `graph_out` emits entity
changes. `map_swaps` is deliberately generic: any v4 pipeline can reuse it without knowing
anything about Gantry.

**Subgraphs** — two, both deployed to Subgraph Studio and queried per request:

- `indexer-mainnet/` indexes Uniswap v4's mainnet PoolManager and detects sandwiches from the
  order of swaps inside a block. Every number on the site comes from here.
- `indexer/` indexes Gantry's own `Tolled` and `TierSet` events on Sepolia.

Nothing on the site is read from a checked-in dataset. The address readout, the leaderboard,
the venue totals and the features the CRE enclave scores are all GraphQL queries made when the
request arrives.

### The part only Substreams can do

A subgraph's event handlers run on receipts of successful transactions. A transaction that
reverts emits no logs, so **no subgraph can report that it happened** — the data is not
missing, it is structurally absent. `map_attempts` reads `transaction_traces`, which carries
the status, and finds the failures.

Over blocks 25,940,000–25,945,000 that is **2,827 transactions that reached the v4 PoolManager
and reverted**, across 132 addresses. One address reverted 1,146 times in 5,000 blocks. Losing
that many races is what a bot looks like when it does not win, and it moves an address to the
suspected tier in [`score.ts`](scorer/src/score.ts).

The originator is the other reason. Without knowing who sent the transaction, a shared router
is indistinguishable from a bot: Uniswap's Universal Router shows **113,764 swaps from 17,117
distinct originators** over blocks 25,900,000–25,940,000, a dedicated sandwich bot shows one.
Both pipelines carry it, and it is why the router is never priced up.

### Regenerating the trace data

```bash
cd substreams
substreams run gantry-v0.1.0.spkg map_attempts -e mainnet.eth.streamingfast.io:443 \
  -s 25940000 -t 25945000 -o jsonl > attempts.jsonl
```

Aggregated per address into `web/data/failed-attempts.json` and merged into `/api/features`,
which is what the CRE workflow reads.

Note for anyone trying this: **Substreams-powered subgraphs are no longer supported by
Subgraph Studio** ("originally intended for non-EVM chains"), so `graph_out` is consumed
through a sink or the registry rather than by a subgraph. That is why `indexer-mainnet` is an
ordinary event-based subgraph.

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

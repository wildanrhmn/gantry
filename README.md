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

## Contracts

- `contracts/src/Gantry.sol` - the hook. Fee selection lives in `_beforeSwap`.
- `contracts/src/TierOracle.sol` - behaviour tiers, batch written, single read on the swap path.

## Running it

```bash
cd contracts
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

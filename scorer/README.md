# Gantry scorer

Turns raw v4 swap history into behaviour tiers.

- `src/chain.ts` reads `Swap` logs straight from an RPC, no dependencies.
- `src/detect.ts` finds sandwiches and builds per-address features.
- `src/score.ts` maps features to a tier. The thresholds here are the values the
  enclave keeps secret; the algorithm itself is meant to be readable.

## Run

```bash
node --test test/*.test.ts

node src/cli.ts --manager=0xPoolManager --rpc=https://... --from=8000000
```

`SCORING_PARAMS` overrides thresholds as JSON. `POOL_ID` narrows to one pool.

## What counts as a sandwich

One address opens and closes a position around somebody else's trade, in the same
block and pool, where the closing leg roughly reverses the opening one. The offset
check is deliberately tight: missing a sandwich costs nothing, overcharging an
honest trader costs them money.

# gantry mainnet indexer

A Substreams-powered subgraph. There are no AssemblyScript mappings here: the
`graph_out` module in `../substreams` accumulates behaviour across blocks and emits
entity changes directly, and this subgraph serves them.

That is the composition the whole readout rests on — `map_swaps` extracts every v4 swap,
`map_sandwiches` consumes that output to find extraction, and stores accumulate both into
per-address totals.

## Why it exists

`eth_getLogs` returns a log but not who sent the transaction. Without the originator a
shared router is indistinguishable from a bot: over blocks 25,900,000–25,940,000 Uniswap's
Universal Router shows **113,764 swaps from 17,117 distinct originators**, while a
dedicated sandwich bot shows one. Substreams carries the originator, which is why the
pipeline starts there.

## Deploy

The slug has to exist in Subgraph Studio first.

```bash
cp ../substreams/gantry-v0.1.0.spkg ./gantry.spkg
npx graph auth <DEPLOY_KEY>
npx graph build
npx graph deploy gantry-mainnet
```

Regenerate the package after changing any Substreams module:

```bash
cd ../substreams && substreams pack substreams.yaml
```

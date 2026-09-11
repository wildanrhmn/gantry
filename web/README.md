# gantry web

The readout. Paste an address, see what it would pay and why.

```bash
npm install
npm run dev
```

`data/mainnet-features.json` is a real scan of Ethereum mainnet blocks 25,940,000-25,944,999
via Substreams: 66,149 swaps, 129 sandwiches, 475 addresses. Regenerate it with:

```bash
cd ../substreams && substreams run substreams.yaml map_swaps \
  -e mainnet.eth.streamingfast.io:443 --start-block 25940000 --stop-block +5000 -o json > scan.json
cd ../scorer && node src/build-dataset.ts scan.json ../web/data/mainnet-features.json
```

The live feed and venue totals come from the subgraph, set with
`NEXT_PUBLIC_GANTRY_SUBGRAPH`. It defaults to the deployed one.

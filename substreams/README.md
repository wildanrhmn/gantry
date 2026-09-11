# gantry substreams

Extracts Uniswap v4 swaps and finds sandwiches in them.

`map_swaps` is deliberately generic, so any v4 pipeline can reuse it. `map_sandwiches`
consumes its output and looks for one address opening and closing a position around
somebody else's trade inside a single block and pool.

## Authentication

Substreams streams come from The Graph Market.

1. Create an account and an API key at https://thegraph.market
2. `substreams auth` - opens a browser, fetches the key over the API and exchanges it
   for a JWT, then writes `.substreams.env`
3. `. ./.substreams.env`

`substreams auth --paste` accepts an existing JWT if the browser flow is awkward. The
variable is `SUBSTREAMS_API_TOKEN`. `.substreams.env` is gitignored.

## Run

```bash
substreams gui substreams.yaml map_sandwiches -e mainnet.eth.streamingfast.io:443 \
  --start-block 21000000 --stop-block +1000
```

## Why there is no Substreams-powered subgraph

`graph_out` exists and works: it accumulates `map_swaps`, `map_sandwiches` and
`map_attempts` into `MainnetTrader` entities, including `failedAttempts`, which is the one
number a normal subgraph cannot produce. It is packaged in `gantry-v0.1.0.spkg`.

It cannot be deployed. Subgraph Studio rejects the manifest outright:

> Substreams-powered Subgraphs, originally intended for non-EVM chains, are no longer
> supported. If you need help migrating to standalone Substreams, please reach out in the
> #substreams channel on Discord.

Checked again on 12 September 2026 with graph-cli 0.98.1 against a `kind: substreams`
manifest that builds and uploads to IPFS cleanly, so this is a platform decision rather
than anything wrong with the package. Reverted-attempt counts therefore reach the site as
a generated artifact (`web/data/failed-attempts.json`) rather than over GraphQL.

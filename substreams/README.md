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

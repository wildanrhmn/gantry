# gantry sink

Substreams is a stream, not a query API, and Subgraph Studio no longer accepts
substreams-powered subgraphs on EVM chains. So the one number a subgraph structurally cannot
produce - transactions that reached the v4 PoolManager and reverted - comes from a sink:
`substreams sink postgres` streams `map_attempts` from The Graph Market into Postgres
continuously, and a small HTTP service reads what it wrote.

The web app calls that service per request and falls back to the committed snapshot in
`web/data/failed-attempts.json` when it is unreachable, so a sink that dies makes a number
stale rather than a page broken. `/api/lookup?part=attempts` reports which source answered.

## What runs

```
substreams sink postgres gantry-v0.1.0.spkg map_attempts --dsn $PGDSN -s 25940000
node attempts-api.mjs          # GET /attempts, /attempts?address=, /health
```

No stop block, so the sink backfills and then follows the chain head. The schema is derived
from the module's protobuf output by the sink itself - no `db_out` module and no hand-written
SQL.

## Setup

```bash
sudo apt-get install -y postgresql
sudo -u postgres createuser gantry --pwprompt
sudo -u postgres createdb -O gantry gantry

curl -sSfL https://github.com/streamingfast/substreams/releases/download/v1.22.0/substreams_linux_x86_64.tar.gz \
  | sudo tar -xz -C /usr/local/bin substreams

substreams sink postgres gantry-v0.1.0.spkg map_attempts --dsn "$PGDSN" setup
sudo -u postgres psql -d gantry -c \
  "CREATE INDEX IF NOT EXISTS attempt_contract_idx ON public.attempt (contract);"

npm install pg
```

Both run under systemd; the units are in `systemd/`. `SUBSTREAMS_API_KEY` and `PGDSN` live in
a root-only `/etc/gantry/db.env`.

## Environment

| variable | where | what |
| --- | --- | --- |
| `PGDSN` | sink, api | Postgres connection string |
| `SUBSTREAMS_API_KEY` | sink | key from thegraph.market, exchanged for JWTs by the CLI |
| `PORT` | api | defaults to 8787 |
| `GANTRY_API_KEY` | api | optional. When set, requests need a matching `x-gantry-key` |
| `GANTRY_ATTEMPTS_API` | web | base URL of the api. Unset means the app uses the snapshot |

The api is read-only and serves public chain data, so it runs open by default. It rate limits
to 120 requests per minute per address, and a wrong key returns 404 rather than 401 so that
scanning it learns nothing.

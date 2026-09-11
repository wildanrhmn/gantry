# gantry web

The readout. Paste an address, see what it would pay and why.

```bash
npm install
npm run dev
```

Every number is a GraphQL query made when the request arrives. Nothing is read from a
checked-in dataset.

| What | Where from | Override |
| --- | --- | --- |
| Address behaviour, leaderboard, scan totals | `indexer-mainnet` subgraph | `NEXT_PUBLIC_GANTRY_MAINNET_SUBGRAPH` |
| Tolls charged, tier changes, venue totals | `indexer` subgraph on Sepolia | `NEXT_PUBLIC_GANTRY_SUBGRAPH` |

The one exception is `data/failed-attempts.json`: reverted transactions emit no logs, so no
subgraph can produce them. That column comes from the Substreams `map_attempts` module and is
labelled as such in the readout.

`/api/features` merges the two and is what the CRE workflow reads inside its enclave.

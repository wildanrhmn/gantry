# gantry indexer

Subgraph over `Tolled` and `TierSet`, building per-address history and venue totals.

## Before deploying

`subgraph.yaml` still carries placeholder addresses. Deploy the contracts to a testnet
first, then fill in both `address` and `startBlock` for each data source, and set
`network` to whatever you deployed on.

## Deploy

Studio hands out two different keys. The **deploy key** is the one used here; the
**API key** is for querying afterwards.

```bash
npx graph auth <DEPLOY_KEY>
npx graph codegen && npx graph build
npx graph deploy <SLUG>
```

The slug is the name you gave the subgraph when you created it in Studio.

Deploying keeps it private on a development query URL capped at 3,000 queries a day,
which is enough here. Publishing is a separate step and is not needed.

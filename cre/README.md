# gantry cre workflow

Scores addresses inside an AWS Nitro enclave and writes the verdicts on chain.

The split that matters: `gantry-scoring/scoring.ts` holds the rules and imports nothing
from the SDK, so anyone can read them. The thresholds those rules compare against arrive
as a secret and never leave the enclave. A published threshold is one an extractor can sit
just underneath, so the algorithm is open and the numbers are not.

## Layout

- `gantry-scoring/scoring.ts` - tier rules, no SDK, unit tested
- `gantry-scoring/main.ts` - cron trigger, secrets, HTTP, report, on-chain write
- `secrets.yaml` - `gantry_scoring_params` (the thresholds) and `gantry_features_key`
- `project.yaml` - RPC targets

## Test

```bash
cd gantry-scoring && npm install && npm test && npx tsc --noEmit
```

## Simulate

Simulation needs a CRE account.

```bash
cre login              # or export CRE_API_KEY=...
cre workflow simulate ./gantry-scoring --target local-simulation --engine-logs
```

## Before deploying

1. Deploy `TierReportReceiver`, then `oracle.setWriter(receiver)`.
2. Put the receiver address in `config.staging.json` under `evms[0].receiver_address`.
3. Put the subgraph query URL in `features_url`.
4. Set `GANTRY_SCORING_PARAMS` to the threshold JSON and `GANTRY_FEATURES_KEY` to the
   subgraph API key, then upload them with `cre secrets`.

The workflow name in `workflow.yaml` must match the `bytes10` the receiver was
constructed with, and the workflow owner must match too. Names are only unique per
owner, which is why the receiver checks both.

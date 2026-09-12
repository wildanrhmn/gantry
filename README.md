<p align="center">
  <img src="docs/mark.svg" width="96" height="96" alt="Gantry" />
</p>

<h1 align="center">Gantry</h1>

<p align="center"><b>Every swap gets read as it passes.</b></p>

<p align="center">
  A <a href="https://docs.uniswap.org/contracts/v4/overview">Uniswap v4</a> hook that prices each
  swap by the caller's on-chain behaviour.<br/>
  Sandwich bots pay <b>20&times; more</b> than clean addresses, and <b>nobody is ever blocked</b>.
</p>

<p align="center">
  <code>0.05%</code> clean · <code>1.00%</code> extractor · live on Sepolia
</p>

<p align="center">
  <a href="https://www.gantryhook.xyz">Live app</a> ·
  <a href="https://sepolia.etherscan.io/address/0x4e6D007c91aB5491c1De9E491f18fbE18ACC8080">Hook</a> ·
  <a href="https://substreams.dev/packages/gantry/v0.1.0">Substreams package</a> ·
  <a href="FEEDBACK.md">Feedback on v4</a>
</p>

---

A toll gantry reads a vehicle at speed, classifies it, and bills it accordingly without anyone
stopping. Same idea, applied to a liquidity pool. Sandwich bots pay more, the surplus stays
with the pool's LPs, and **nobody is ever blocked from trading**.

| Tier | Meaning | Fee |
| --- | --- | --- |
| 0 | Clean history | 0.05% |
| 1 | Unknown, the default | 0.30% |
| 2 | Some extraction signal | 0.60% |
| 3 | Repeat extractor | 1.00% |

An address nobody has scored yet lands on tier 1, never tier 0, so rotating to a fresh address
does not escape the toll.

## The loop

Behaviour is measured off chain, scored inside a hardware enclave, published on chain in
batches, and read by the hook as a single storage slot on the swap path.

```mermaid
flowchart TB
  chain([Ethereum mainnet])

  subgraph read ["Read · The Graph"]
    ss["Substreams<br/>swaps · sandwiches · attempts"]
    sg[("Subgraph<br/>PoolManager events")]
    db[("Postgres<br/>substreams sink postgres")]
    ss --> db
  end

  tee["Confidential workflow · Chainlink CRE<br/>thresholds fetched inside the TEE"]

  subgraph charge ["Charge · Uniswap v4"]
    rcv[TierReportReceiver] --> orc[(TierOracle)]
    orc --> hook["Gantry hook · beforeSwap"]
    hook --> pool([v4 pool])
  end

  chain --> ss
  chain --> sg
  sg --> tee
  db --> tee
  tee -->|DON-signed report| rcv
```

The enclave is never on the swap path. By the time a swap arrives, the tier is already a
number in a storage slot.

## The router problem

`beforeSwap` sees whoever called the PoolManager. For a shared router that is the router, so
a bot trading from its own contract is priced on its own history while everyone behind one
router looks identical. A trader can sign an EIP-712 attestation and pass it as hook data to
be priced as themselves.

```mermaid
sequenceDiagram
  autonumber
  participant T as Trader
  participant R as Router
  participant PM as PoolManager
  participant G as Gantry

  T->>R: swap + attestation
  R->>PM: swap(..., hookData)
  PM->>G: beforeSwap(sender, data)
  G->>G: recover the trader
  G->>G: tierOf(trader), one slot
  G-->>PM: fee | OVERRIDE_FEE_FLAG
```

The nonce is spent when the hook accepts an attestation, so the same signature cannot price a
second swap. Charging a router punitively would charge every trader behind it, so `TierOracle`
clamps addresses marked as shared infrastructure to the default tier and will not raise them.

## Live on Sepolia

| Contract | Address |
| --- | --- |
| Gantry hook | [`0x4e6D007c91aB5491c1De9E491f18fbE18ACC8080`](https://sepolia.etherscan.io/address/0x4e6D007c91aB5491c1De9E491f18fbE18ACC8080) |
| TierOracle | [`0x846d3eF24c3c6e079Bd95cFeACC08B21427C9132`](https://sepolia.etherscan.io/address/0x846d3eF24c3c6e079Bd95cFeACC08B21427C9132) |
| TierReportReceiver | [`0x351278Ef6FF1325c69127255936e5E7d0B47A1A4`](https://sepolia.etherscan.io/address/0x351278Ef6FF1325c69127255936e5E7d0B47A1A4) |
| Demo pool router | [`0x88decb029a808357402044588f2904504CaaFe39`](https://sepolia.etherscan.io/address/0x88decb029a808357402044588f2904504CaaFe39) |
| PoolManager | `0xE03A1074c86CFeDd5C142C4F04F1a1536e203543` (Uniswap canonical) |

The hook address ends `8080` because v4 reads a hook's permissions out of its own address. The
salt was mined until the low 14 bits equalled 128, the `BEFORE_SWAP` bit. The oracle's `writer`
is the CRE receiver and its `admin` is a separate key, so the deployer cannot write tiers.

Subgraphs, both queried per request:

- mainnet behaviour — `api.studio.thegraph.com/query/1760064/gantry-mainnet/v0.0.2`
- Gantry's own events — `api.studio.thegraph.com/query/1760064/gantry/v0.0.3`

### Where to look in the code

| What | Where |
| --- | --- |
| The fee decision | [`Gantry.sol#L71-L81`](contracts/src/Gantry.sol#L71-L81) — `_beforeSwap` returns `fee \| OVERRIDE_FEE_FLAG` |
| Hook permissions | [`Gantry.sol#L52`](contracts/src/Gantry.sol#L52) — `beforeSwap` only |
| Router vs trader | [`Gantry.sol#L100-L118`](contracts/src/Gantry.sol#L100-L118) — `_resolvePayer`, and why an attestation exists |
| Signable attestation | [`Gantry.sol#L86-L90`](contracts/src/Gantry.sol#L86-L90) — EIP-712 digest |
| Fail open, never revert | [`Gantry.sol#L120-L127`](contracts/src/Gantry.sol#L120-L127) — a bad oracle cannot halt the pool |
| Routers cannot be priced up | [`TierOracle.sol#L99-L104`](contracts/src/TierOracle.sol#L99-L104) — `_set` clamps shared addresses |

### One address, three prices

The same 1,000 gUSD swapped three times on Sepolia, same pool, same size, measured as what
actually arrived:

```
priced as the router, no attestation   0.30%   992.30 gETH
priced as the caller, tier 3           1.00%   985.82 gETH
priced as the caller, tier 0           0.05%   994.30 gETH
```

Swap through a router and the hook sees the router, so you pay the default. Sign and it sees
you: the same wallet, re-scored between swaps, kept **8.47 more tokens out of 1,000**. The gap
is slightly under the 0.95 percent the fees imply because each swap moves the price a little
for the next one.

The pool's tokens mint freely, so anyone can try it: connect on Sepolia, mint gUSD, approve the
router, swap.

## How The Graph is used

Two products, composed, neither of which answers the question alone.

**Substreams** — nine modules in `substreams/`, published to
[substreams.dev/packages/gantry](https://substreams.dev/packages/gantry/v0.1.0). `map_swaps`
extracts every Uniswap v4 swap on mainnet; `map_sandwiches` consumes that output and finds
extraction; `map_attempts` reads transaction traces; four stores accumulate per-address totals.
`map_swaps` is deliberately generic, so any v4 pipeline can reuse it without knowing anything
about Gantry.

**Subgraphs** — two, deployed to Subgraph Studio and queried when the request arrives.
`indexer-mainnet/` indexes the mainnet PoolManager and detects sandwiches from the order of
swaps inside a block. `indexer/` indexes Gantry's own `Tolled` and `TierSet` events on Sepolia.

Nothing on the site is read from a checked-in dataset.

### The part only Substreams can do

A subgraph's event handlers run on receipts of successful transactions. A transaction that
reverts emits no logs, so **no subgraph can report that it happened** — the data is not
missing, it is structurally absent. `map_attempts` reads `transaction_traces`, which carries
the status.

Over the same window the behaviour subgraph covers, that is **more than 10,000 transactions
that reached the v4 PoolManager and did not succeed**, across ~290 addresses. Losing that many
races is what a bot looks like when it does not win, and it moves an address toward the
suspected tier.

The originator is the other reason both pipelines exist. Without knowing who sent the
transaction, a shared router is indistinguishable from a bot: Uniswap's Universal Router shows
thousands of swaps from thousands of distinct originators, a dedicated sandwich bot shows one.
That is why the router is never priced up, even though it reverts more than anyone.

### What the standards bought us

Three things we did not have to build:

**A Postgres schema, and the code to fill it.** `substreams sink postgres` reads an arbitrary
protobuf message and derives tables from it. Pointing it at `map_attempts`, whose output is our
own `gantry.v1.Attempts`, produced the table, the cursor tables and reorg handling with **no
Rust changes, no `db_out` module and no schema written by hand**. It resumes from its cursor
across restarts, which is the part that would have taken longest to get right.

**A reusable extractor.** `map_swaps` knows nothing about Gantry. Publishing it means the next
v4 pipeline starts where we finished rather than parsing the PoolManager again.

**A query layer for free.** The behaviour subgraph came with a GraphQL API, hosted indexing and
a head to poll. The only thing we run ourselves is the piece the standard could not cover.

### What did not work

`graph_out` exists, emits `EntityChanges` and is packaged. It cannot be deployed — Subgraph
Studio rejects the manifest:

> Substreams-powered Subgraphs, originally intended for non-EVM chains, are no longer
> supported.

Checked on 12 September 2026 with graph-cli 0.98.1 against a manifest that builds and uploads
to IPFS cleanly, so it is a platform decision rather than anything wrong with the package. That
is why the Substreams output reaches the site through a sink.

### Running the sink

```bash
substreams sink postgres substreams/gantry-v0.1.0.spkg map_attempts \
  --dsn "postgres://user:pass@host:5432/gantry?sslmode=disable" -s 25940000
```

No stop block, so it backfills and then follows the chain head. A small HTTP service in front
serves the counts; `web/lib/attempts.ts` reads it per request and falls back to a committed
snapshot if the sink is unreachable — a stale number rather than a broken page. The
`/api/lookup?part=attempts` response says which source answered. Details in [`sink/`](sink).

## Scoring inside the enclave

`cre/gantry-scoring/` is a Chainlink CRE workflow whose handler runs in a TEE. The rules are
public in `scoring.ts`; the thresholds that turn features into a tier are fetched as a secret
with `runtime.getSecrets()` inside the enclave and never leave it. A published threshold is one
an extractor can sit just underneath.

Both of its inputs are live: the behaviour subgraph over GraphQL, and the reverted-attempt
counts from the sink. The tier it returns is written on chain by a DON-signed report, and that
is the number the hook charges. Simulation output is in
[`cre/simulation-evidence.txt`](cre/simulation-evidence.txt).

## Layout

| | |
| --- | --- |
| `contracts/` | the hook and the oracle. Fee selection lives in `Gantry._beforeSwap`. |
| `substreams/` | nine modules over mainnet blocks and traces |
| `indexer-mainnet/` | subgraph over Uniswap v4's mainnet PoolManager |
| `indexer/` | subgraph over Gantry's own events on Sepolia |
| `sink/` | streams `map_attempts` into Postgres and serves the counts |
| `cre/` | the confidential scoring workflow |
| `scorer/` | the scoring rules, and their tests |
| `web/` | the app at [www.gantryhook.xyz](https://www.gantryhook.xyz) |
| `mcp/` | ask an MCP client why an address pays what it pays |

## Setup

```bash
cd contracts
forge install Uniswap/v4-core --no-git
forge install Uniswap/v4-periphery --no-git
forge install OpenZeppelin/uniswap-hooks@v1.1.1 --no-git
forge test -vv
```

The whole loop on a local chain, from a sandwich to two differently priced swaps:

```bash
anvil --disable-code-size-limit &
./scripts/demo.sh
```

Both size-limit flags are needed because Uniswap's `PoolManager` is 34,623 bytes and exceeds
EIP-170. On a live network set `POOL_MANAGER` to the canonical deployment and the script will
use it.

## Licence

MIT. See [LICENSE](LICENSE).

---

<p align="center">
  <sub>Built for ETHOnline 2026 on Uniswap v4, The Graph and Chainlink CRE.</sub><br/>
  <sub><b>Gantry prices behaviour. It never blocks anyone from trading.</b></sub>
</p>

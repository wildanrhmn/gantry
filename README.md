# Gantry

Every swap gets read as it passes.

A Uniswap v4 hook that prices each swap by the caller's on-chain behaviour. Sandwich bots pay
more, the surplus stays with the pool's LPs, and nobody is ever blocked from trading.

A toll gantry reads a vehicle at speed, classifies it, and bills it accordingly without anyone
stopping. Same idea, applied to a liquidity pool.

## How it works

Behaviour is scored off-chain from indexed history and written to `TierOracle` in batches. The
hook reads one storage slot in `beforeSwap` and returns an overriding fee for that swap only.

| Tier | Meaning | Fee |
| --- | --- | --- |
| 0 | Clean history | 0.05% |
| 1 | Unknown, the default | 0.30% |
| 2 | Some extraction signal | 0.60% |
| 3 | Repeat extractor | 1.00% |

An address nobody has scored yet lands on tier 1, never tier 0, so rotating to a fresh address
does not escape the toll.

## Layout

- `contracts/src/Gantry.sol` - the hook. Fee selection lives in `_beforeSwap`.
- `contracts/src/TierOracle.sol` - behaviour tiers, batch written, single read on the swap path.
- `scorer/` - reads `Swap` logs straight from an RPC, finds sandwiches, assigns tiers.
- `substreams/` - `map_swaps` extracts v4 swaps, `map_sandwiches` and `map_attempts` consume it.
- `indexer/` - subgraph over `Tolled` and `TierSet`, building per-address history.
- `indexer-mainnet/` - subgraph over Uniswap v4's mainnet PoolManager, which every page reads live.
- `sink/` - streams `map_attempts` into Postgres and serves the counts the site reads.
- `mcp/` - ask an MCP client why an address pays what it pays.
- `scripts/demo.sh` - the whole loop on a local chain.

## The loop

```bash
anvil --disable-code-size-limit &
./scripts/demo.sh
```

It deploys a pool, has a bot sandwich a trader inside one block, scores that from
chain data, publishes the tiers, then sends two identical swaps and prints the
difference. Last run:

```
swaps 3  addresses 2  sandwiches 1
0x2279...ebe6  suspected swaps=2 blocks=1 sandwiches=1 victims=1
0x8a79...c318  unknown   swaps=1 blocks=1 sandwiches=0 victims=0

  sandwicher receives 9929150195924421
  trader     receives 9957135968097604
  difference 27985772173183 (0.28%)
```

## Traders behind a router

`beforeSwap` sees whoever called the PoolManager, which for a shared router is the
router. A bot trading from its own contract is therefore priced on its own history,
while everyone behind one router looks the same. A trader can sign an attestation
and pass it as hook data to be priced as themselves; anything malformed, expired or
signed by the wrong key quietly falls back to pricing the caller.

## Live on Sepolia

| Contract | Address |
| --- | --- |
| Gantry hook | [`0x4e6D007c91aB5491c1De9E491f18fbE18ACC8080`](https://sepolia.etherscan.io/address/0x4e6D007c91aB5491c1De9E491f18fbE18ACC8080) |
| Demo pool router | [`0x88decb029a808357402044588f2904504CaaFe39`](https://sepolia.etherscan.io/address/0x88decb029a808357402044588f2904504CaaFe39) |
| TierOracle | [`0x846d3eF24c3c6e079Bd95cFeACC08B21427C9132`](https://sepolia.etherscan.io/address/0x846d3eF24c3c6e079Bd95cFeACC08B21427C9132) |
| TierReportReceiver | [`0x351278Ef6FF1325c69127255936e5E7d0B47A1A4`](https://sepolia.etherscan.io/address/0x351278Ef6FF1325c69127255936e5E7d0B47A1A4) |
| PoolManager | `0xE03A1074c86CFeDd5C142C4F04F1a1536e203543` (Uniswap canonical) |

Subgraphs:

- mainnet behaviour - `https://api.studio.thegraph.com/query/1760064/gantry-mainnet/v0.0.2`
- Gantry's own events - `https://api.studio.thegraph.com/query/1760064/gantry/v0.0.3`

The hook address ends `8080` because v4 reads a hook's permissions out of its own address.
The salt was mined until the low 14 bits equalled 128, the `BEFORE_SWAP` bit.

### Where to look in the code

| What | Where |
| --- | --- |
| The fee decision | [`Gantry.sol#L71-L81`](contracts/src/Gantry.sol#L71-L81) - `_beforeSwap` returns `fee \| OVERRIDE_FEE_FLAG` |
| Hook permissions | [`Gantry.sol#L52`](contracts/src/Gantry.sol#L52) - `beforeSwap` only |
| Router vs trader | [`Gantry.sol#L100-L118`](contracts/src/Gantry.sol#L100-L118) - `_resolvePayer`, and why an attestation exists |
| Signable attestation | [`Gantry.sol#L86-L90`](contracts/src/Gantry.sol#L86-L90) - EIP-712 digest |
| Fail open, never revert | [`Gantry.sol#L120-L127`](contracts/src/Gantry.sol#L120-L127) - a bad oracle cannot halt the pool |
| Routers cannot be priced up | [`TierOracle.sol#L99-L104`](contracts/src/TierOracle.sol#L99-L104) - `_set` clamps shared addresses |

Feedback on building against the v4 stack is in [FEEDBACK.md](FEEDBACK.md).

### One address, three prices

The fee is decided in [`Gantry._beforeSwap`](contracts/src/Gantry.sol). The same 1,000 gUSD
swapped three times on Sepolia, same pool, same size, measured as what actually arrived:

```
priced as the router, no attestation   0.30%   992.30 gETH
priced as the caller, tier 3           1.00%   985.82 gETH
priced as the caller, tier 0           0.05%   994.30 gETH
```

Swap through a router and the hook sees the router, so you pay the default. Sign an
attestation and it sees you: the same wallet, re-scored between swaps, kept 8.47 more
tokens out of 1,000. The gap is slightly under the 0.95 percent the fees imply because
each swap moves the price a little for the next one.

### Swapping against it

The pool's tokens mint freely, so anyone can try it: connect on Sepolia, mint gUSD, approve
the router, swap. The hook charges whatever tier the caller sits on.

Because a shared router is what calls the PoolManager, the hook sees the router rather than
the trader. A trader can sign an EIP-712 attestation and pass it as hook data to be priced
as themselves instead. That is what the `Attestation(address trader,address sender,bytes32 poolId,uint256 nonce,uint256 deadline)` type in [`Gantry.sol`](contracts/src/Gantry.sol) is for.

## How The Graph is used

Two products, composed.

**Substreams** - nine modules in `substreams/`, published to the registry at
[substreams.dev/packages/gantry](https://substreams.dev/packages/gantry/v0.1.0) so anyone can
compose against them. `map_swaps` extracts every Uniswap v4 swap on Ethereum mainnet,
`map_sandwiches` consumes that output and finds extraction, `map_attempts` reads transaction
traces, four stores accumulate per-address totals across blocks, and `graph_out` emits entity
changes. `map_swaps` is deliberately generic: any v4 pipeline can reuse it without knowing
anything about Gantry.

**Subgraphs** - two, both deployed to Subgraph Studio and queried per request:

- `indexer-mainnet/` indexes Uniswap v4's mainnet PoolManager and detects sandwiches from the
  order of swaps inside a block. Every number on the site comes from here.
- `indexer/` indexes Gantry's own `Tolled` and `TierSet` events on Sepolia.

Nothing on the site is read from a checked-in dataset. The lookup, the toll feed, the scan
totals and the features the CRE enclave scores are all queries made when the request arrives -
the subgraphs over GraphQL, the trace counts from the sink described below.

### The part only Substreams can do

A subgraph's event handlers run on receipts of successful transactions. A transaction that
reverts emits no logs, so **no subgraph can report that it happened** - the data is not
missing, it is structurally absent. `map_attempts` reads `transaction_traces`, which carries
the status, and finds the failures.

Over the same window the behaviour subgraph covers, that is **9,556 transactions that reached
the v4 PoolManager and did not succeed**, across 280 addresses. Losing that many races is what
a bot looks like when it does not win, and it moves an address to the suspected tier in
[`score.ts`](scorer/src/score.ts).

The originator is the other reason both pipelines exist. Without knowing who sent the
transaction, a shared router is indistinguishable from a bot: Uniswap's Universal Router shows
thousands of swaps from thousands of distinct originators, a dedicated sandwich bot shows one.
That is why the router is never priced up, even though it reverts more than anyone.

### How the two are composed

Neither product answers the question on its own.

The subgraph knows what an address *did*: swaps, sandwiches, round trips, distinct
originators, first and last seen. It cannot know what an address *tried*. Substreams knows
what it tried, because traces carry a status that logs do not. A tier needs both, so a lookup
reads both and the enclave scores both together.

They are kept on the same window deliberately. `scripts/scan-attempts.mjs` asks the subgraph
for its own indexed head and scans to exactly that block, so the reverted count and the
behaviour counts always describe the same range. Comparing a 5,000-block failure count against
a 16,000-block swap count would be meaningless, and it is the kind of drift that is invisible
once it starts.

### What the standards bought us

Three things we did not have to build:

**A Postgres schema, and the code to fill it.** `substreams sink postgres` reads an arbitrary
protobuf message and derives tables from it. Pointing it at `map_attempts`, whose output is
our own `gantry.v1.Attempts`, produced the `attempt` table, the cursor tables and reorg
handling with **no Rust changes, no `db_out` module and no schema written by hand**. The sink
resumes from its cursor across restarts, which is the part that would have taken longest to
get right.

**A reusable extractor.** `map_swaps` knows nothing about Gantry - it takes a block and emits
v4 swaps. `map_sandwiches`, `map_attempts`, four stores and `graph_out` are all consumers of
it. Publishing it to the registry means the next v4 pipeline starts where we finished rather
than parsing the PoolManager again.

**A query layer for free.** The behaviour subgraph is an ordinary event-based subgraph, so it
came with a GraphQL API, hosted indexing and a head to poll. The only thing we had to run
ourselves is the piece the standard could not cover.

### What did not work

`graph_out` exists, emits `EntityChanges` and is packaged. It cannot be deployed: Subgraph
Studio rejects the manifest with *"Substreams-powered Subgraphs, originally intended for
non-EVM chains, are no longer supported."* Checked again on 12 September 2026 with graph-cli
0.98.1 against a manifest that builds and uploads to IPFS cleanly, so it is a platform
decision rather than anything wrong with the package.

That is why the Substreams output reaches the site through a sink rather than a subgraph.

### Running the sink

```bash
substreams sink postgres substreams/gantry-v0.1.0.spkg map_attempts \
  --dsn "postgres://user:pass@host:5432/gantry?sslmode=disable" -s 25940000
```

No stop block, so it backfills and then follows the chain head. A small HTTP service in front
serves the counts, and `web/lib/attempts.ts` reads it per request, falling back to the
committed snapshot if the sink is unreachable - a stale number rather than a broken page. The
`/api/lookup?part=attempts` response says which source answered.

To regenerate the fallback snapshot without a sink:

```bash
SUBSTREAMS_API_TOKEN=... node scripts/scan-attempts.mjs
```

## Setup

```bash
cd contracts
forge install Uniswap/v4-core --no-git
forge install Uniswap/v4-periphery --no-git
forge install OpenZeppelin/uniswap-hooks@v1.1.1 --no-git
forge test -vv
```

Local deploy:

```bash
anvil --disable-code-size-limit
PRIVATE_KEY=0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80 \
  forge script script/Deploy.s.sol:Deploy \
  --rpc-url http://127.0.0.1:8545 --broadcast --disable-code-size-limit
```

Both size-limit flags are needed because Uniswap's `PoolManager` is 34,623 bytes and exceeds
EIP-170. On a live network set `POOL_MANAGER` to the canonical deployment instead and the
script will use it.

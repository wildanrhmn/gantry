# ETHOnline 2026 — Idea Bank

Solo · net-new (Classic) · **max 3 partner selections** · multi-track sponsors give more slots per selection

---

## 0. How to read this

Every idea below is scored against five filters that came out of the research, not out of taste:

1. **Three load-bearing sponsors.** If a leg could be replaced by a `mapping` or an RPC call, it's decoration. Named and killed.
2. **Hosted product, not a library.** 53% of finalists ship an app; 5% ship a library — and *every* pure-library finalist won **zero sponsor money** (EVM PORST, Hardhat3-Ledger, ethui, OpenPayAI).
3. **One sharp mechanism + 2-3 deep integrations.** Platforms lose. `DIVE` won 4 prizes writing **zero Solidity**.
4. **Real data, real money, no invented scenario.** The demo should prove the thing works, not ask a judge to imagine it.
5. **Not on a ban list and not already won.** See §5.

**Odds baseline:** online events run ~**10%** for any real prize (ETHOnline 2025: 555 submissions), ~1.6% finalist. In-person is 25-30%. Multi-track sponsor selection is the main lever against that.

---

## 1. Sponsor capability map — what each is *actually* uniquely good at

| Sponsor | The one thing nothing else does | Net-new tracks | Slots | Field |
|---|---|---|---|---|
| **The Graph** | Cross-protocol, multi-chain **historical + realtime** data. Impossible from RPC. | Composable + AI | **6** | Composable ~5 repos ⭐ / AI ~170 |
| **Hedera** | ATS = ERC-3643 compliance engine in a box. HCS = ordered log at $0.0001. | x402 + Tokenization + Harness | **8** | x402 crowded / ATS thin ⭐ |
| **Chainlink CRE** | Run code in a **TEE** and put only the verdict on-chain. | Confidential Workflows (+$500 challenge) | 2 (+1) | very thin ⭐ |
| **1inch** | Aqua virtual balances (LP keeps custody) + SwapVM bytecode VM | Aqua App | 3 | **6 repos** ⭐ |
| **ENS** | EAC: 64 roles/resource, **scoped to a single record**, reversible, expiring | ENSv2 | **4** | 11 repos |
| **Uniswap** | v4 hooks: arbitrary logic on every swap, dynamic per-swap fees, custom accounting | Stack Contribution | 3 | moderate |
| **Ledger** | Hardware-enforced approval; Key Ring for hosts with no USB | AI Agents x Ledger | 3 | thin (hardware barrier) |
| **Privy** | Email → wallet in hours. Policies, key quorums, session signers, Earn | B2B + Financial Flow | 2 | crowded |
| **Arc** | **USDC is the gas token.** CCTP, Gateway, Paymaster | DeFi + Agentic | 2 | **70+ repos, crowded** |
| **Bazantic** | Turn any API into an x402-payable, MCP-exposed service with a Recipe | Recipe + Agentify | **6** | ~zero ⭐ |
| **World** | Selfie Check: liveness + **facial continuity** (not uniqueness), cheap, repeatable | Selfie Check | 3 | **0 repos** ⭐ |

**Prize-density note:** Bazantic is $2,000 across **6 slots** with near-zero competition and low effort. It's the cheapest third selection on the board if a stronger one doesn't fit — but it's small money, so use it as a bolt-on only when it's genuinely honest.

---

## 2. The ideas

### Tier A — my strongest

---

### ~~A1. Compliant Pool~~ — ❌ **DEAD. SATURATED.**

> **Uniswap Labs shipped exactly this on 2026-07-23**: "Permissioned Pools" on v4, with **ERC-3643 integration contributed by Dowgo**, launch partners Securitize, Superstate and Dowgo — an issuer-managed allowlist checked on every swap via a hook. Civic also has an earlier KYC-gated v4 hook. Presenting this as novel would be actively embarrassing in front of Uniswap's own judges. The only surviving gap is cross-issuer allowlist interoperability / liquidity fragmentation, which is a different and much smaller project.

<details><summary>Original writeup (kept for reference)</summary>

#### Compliant Pool — the first AMM liquidity a regulated asset can legally touch

**Pitch:** *"Tokenised equities hit $29.5B and can't trade on a DEX. This fixes that."*

**Real problem, with numbers.** Tokenized equities grew **+415% in 30 days to $29.5B**, and **$1B traded while the stock market was shut**. But ERC-3643/ERC-1400 assets enforce transfer restrictions in the token itself — only verified, eligible identities can hold them. So the entire RWA category is locked out of AMM liquidity and trades in thin, bilateral, OTC-ish venues. Hedera's own bounty admits the gap: *"A secondary market for ATS assets, **which the Studio does not have today**."*

**Mechanism.** A Uniswap **v4 hook** that performs the eligibility check at swap time against the asset's identity registry — so a permissioned token can sit in a pool and only eligible counterparties can take the other side. Compliance moves from blocking transfers to **gating swaps**.

**Sponsors, all structural:**
- **Hedera ATS** — issues the asset and *is* the compliance engine (KYC grants, freezes, transfer restrictions, corporate actions). Their explicitly-invited gap.
- **Uniswap v4** — the hook is the mechanism. `beforeSwap` gating plus custom accounting; nothing else on the board can put arbitrary logic in a swap path.
- **The Graph** — the compliance-state and holder register across chains, plus trading history. Standardized schema; genuinely not RPC-able.

**Demo:** issue a tokenized equity, try to swap as an ineligible address → blocked. Grant KYC → same swap succeeds. Live, on testnet, with the register visible.

**Post-mortem — the architecture, for reference.** It *is* possible, but not the way it sounds. v4 is a **singleton**: `PoolManager` holds the real ERC-20 balances, and moves tokens via `take()` (a raw `transfer` **from PoolManager**) and `_settle()` (trader transfers **to PoolManager**). T-REX's `transfer()` checks `isVerified(_to)` and `canTransfer(...)` on the literal wallet moving funds. Therefore:
1. **`PoolManager` itself must be registered as a verified identity** in the token's `IIdentityRegistry`, or every swap, LP add, and even initial seeding reverts.
2. Every LP and every swapper must independently be KYC'd in that same registry.
3. `beforeSwap`'s `sender` is the **router**, not the trader — so identifying the real beneficial owner requires a signed claim passed through `hookData`.
4. The hook's genuine value is fail-fast reverts and **pool-level policy** (jurisdiction, position caps, time-locks) — **the token is always the actual compliance backstop.**

Claiming "the hook makes an otherwise non-compliant pool compliant" is false, and a judge who reads T-REX source will catch it.

</details>

---

### A2. Gantry — a v4 hook that prices you by your behaviour, with the model kept secret ⭐ **TOP PICK — VALIDATED OPEN GAP**

**Pitch:** *"The pool knows what you are from what you've done — and the rulebook is sealed."*

**Real problem.** MEV extraction from retail is the most documented harm in DeFi and every mitigation is *infrastructural* (private mempools, batch auctions). Nobody attacks it at the mechanism layer. And the obvious version — charge bots more — fails instantly, because **a public rulebook is a rulebook you game**: bots simply stay under the threshold.

**Mechanism.** Dynamic per-swap fees driven by **behavioural history**, not identity: has this address sandwiched before, does it arrive in the same block as its own counter-trade, is its lifetime pattern arbitrage-shaped? The scoring model runs **inside a TEE**, so the only thing on-chain is the fee verdict. Surplus is redistributed to LPs.

**Sponsors, all structural:**
- **Uniswap v4** — `DYNAMIC_FEE_FLAG` at init, `beforeSwap` returns a `uint24` with `OVERRIDE_FEE_FLAG` set to override the fee for that swap alone. Verified mechanism, exactly the thing hooks exist for.
- **The Graph** — behavioural history across protocols and chains. This *is* the input. No indexer, no product.
- **Chainlink CRE** — the **thresholds and weights** must be confidential or the mechanism is gamed within a day. "Privacy-preserving risk assessment" is verbatim on their listed use cases.

**⚙️ Verified CRE constraints — state the claim precisely.** AWS **Nitro Enclaves**, one region (`us-west-2`), Go or TypeScript → WASM, registered via `handlerInTee` / `cre.HandlerInTee`.
**The workflow binary is NOT confidential** — the Workflow DON provides it into the enclave in the clear. Only the **data it computes over** is protected. So:
- ✅ You CAN hide: scoring **weights and thresholds** (via `runtime.getSecrets()`, released only into the attested enclave) and the **input data**.
- ❌ You CANNOT hide: the algorithm's shape.
That is still sufficient — the real failure mode is an attacker sizing behaviour to stay just under a *known threshold* — but **do not claim "we hide the model."** Claim "the thresholds are unknowable," which is true and defensible.
**Hard limits** (template defaults, `buildRestrictions()`): `maxTotalCalls: 10`, **8 HTTP calls**, 1 consensus report, 1 EVM write, `maxSecrets: 3`. Outbound HTTP works (`HTTPClient.sendRequest()`). No native fork/simulation primitive — you'd call your own Anvil/Tenderly over HTTP. Output reaches chain via `donRuntime.report()` → `EVMClient.writeReport()`.

**Why it dodges the ban list:** it prices **behaviour**, never personhood. No World credential, no "humans pay less" (which Turing Swap already did and World now bans).

**Demo:** same pool, same size, two addresses — one with a clean history, one with a sandwich history. Watch the fee differ on-chain, and watch the surplus land with LPs.

**Hole:** bots rotate addresses. Answer: fresh addresses have no history and default to the high tier, so rotation *costs* them. Not airtight, but economically real.

**✅ Prior-art verdict: OPEN GAP, uncontested.** Verified against the field:
- **Angstrom** (Sorella Labs, Paradigm-backed) — uniform-clearing-price batch auction with a priority-fee MEV tax applied **identically to everyone**. No per-address scoring, no TEE.
- **Arrakis Diamond** — dynamic fees driven by **volatility and inventory**, not behaviour or identity.
- **Detox-Hook** (ETHGlobal winner) — taxes oracle-price deviation **uniformly**.
- **Nomis / RubyScore / Ethos / Cred Protocol** — wallet reputation exists, but scores *general trustworthiness for lending and airdrops*, never sandwicher-specific behaviour applied at swap time, and **none hide the model in a TEE**.
- One academic paper (arXiv 2512.17602) studies bot behavioural adaptation but isn't a pricing mechanism.

**Nobody combines address-level MEV-bot behavioural scoring with a confidential TEE-hidden model applied at swap time.** This is the cleanest novelty claim on the entire list.

---

### A3. Ledger — the truth machine for ERC-4626 vaults

**Pitch:** *"Every vault reports its own APY. None of them agree on what APY means."*

**Real problem.** Vault yields are self-reported, computed differently per protocol, and routinely exclude fees, impermanent loss, and rehypothecation. An LP genuinely cannot compare Yearn to Morpho to a Steakhouse vault on a like-for-like basis.

**This is the one The Graph asked for by name.** Their prize text: *"Contributing a new composable Substreams module for an emerging standard, such as **ERC-4626 tokenized-vault flows**, also counts."* That's a written invitation to fill a specific gap.

**Mechanism.** Author the standardized ERC-4626 Substreams module, index every vault on every chain through one schema, and compute **realised** return — net of everything — with one query pattern across all protocols. Then let it *act*: route capital to the honest winner.

**Sponsors:**
- **The Graph** — the module is the contribution. Composable *and* AI tracks from one selection. Strongest Graph fit on this whole list.

**⚠️ The premise needs correcting — do not overclaim.** **Pinax already ships a complete `erc4626/` Substreams module** ([pinax-network/substreams-evm](https://github.com/pinax-network/substreams-evm), Apache-2.0) — topic0 signature matching across *every* vault with no allow-list, decoded via `substreams-abis`, and it already handles the edge cases a naive build misses: **fee-spread** (Deposit `assets` includes entry fee, Withdraw is post-exit-fee) and **OZ virtual-offset decimals**.
**The real, narrower gap:** `streamingfast/substreams-chain-modules` — the repo the prize actually names — has dirs for `dex/`, `lending/`, `nft/`, `staking/`, `tokenized-assets/` but **no `erc4626/`**. So the honest pitch is *"the reference implementation exists but isn't in the canonical modules registry — we're porting it and contributing upstream."* A porting + PR exercise, not novel R&D. **Never say "nobody has solved ERC-4626 Substreams"** — a judge who knows pinax's repo will end the conversation there.
- **Privy** — Earn vaults, session signers and policies actually move the money. Turns a comparison into an allocation.
- **Bazantic** — expose the truth engine as an x402-payable, MCP-described service so other agents can consume it. Recipe + Agentify tracks, near-zero competition.

**Demo:** side-by-side advertised APY vs realised APY for real vaults, with the gap visible — then one click reallocates.

**⚠️ Prior-art verdict: CROWDED, and it's The Graph's own suggested prompt.** DefiLlama's yield-server already computes net-of-fee yield via `convertToAssets`, though as curated per-protocol adapters rather than a generic module. **Vaults.fyi** is the closest product — hourly on-chain sampling, standardized schema, **80+ protocols** — but curated, proprietary, with no explicit IL/rehypothecation modelling. Exponential.fi now 308-redirects to yo.xyz (consolidation).
**The catch:** because The Graph's prize page names this example by name, **expect several teams chasing the identical prompt.** Differentiators must be the standardized module contribution plus *acting* on the answer — not the comparison itself.

---

### A4. Sealed Bounty — prove the exploit without revealing it

**Pitch:** *"Get paid before you disclose. The enclave sees the bug. The protocol never does."*

**Real problem.** Bug bounties force disclosure *before* payment, so researchers routinely hear "we already knew," "that's a duplicate," or "we've reassessed it as medium" — after handing over their only leverage. Immunefi has paid $100M+ and its dispute threads are notorious.

**Mechanism.** The exploit runs **inside a TEE against forked state**. The enclave attests *"real, novel, worth $X value-at-risk"* without the exploit leaving. Payment escrows on that attestation; disclosure happens after settlement.

**Sponsors:**
- **Chainlink CRE** — the enclave. Their listed territory (AI audit firewall, protecting "evaluation criteria and model responses").
- **Hedera HCS** — **first-finder priority.** "Duplicate" is an *ordering* dispute, and HCS is a global ordered timestamped log at $0.0001 with 3s finality. Exactly the right tool, and it settles the single most-argued word in the industry.
- **The Graph** — severity as arithmetic: index the affected contracts to compute real value-at-risk instead of negotiating a vibe.

**Demo:** submit a real bug against a real fork. Enclave attests. Money moves. The exploit appears on screen only *after* payment.

**Hole:** running arbitrary exploit code in a TEE is heavy, and CRE's compute limits may not allow it. Users are researchers — intense, not numerous.

**⚠️ Prior-art verdict: CROWDED, soft embarrassment risk.** Trail of Bits + Matthew Green (Johns Hopkins), DARPA SIEVE-funded, **published this exact idea in 2020**. **zkpoex** (ACM SAC 2025/26, `github.com/ziemen4/zkpoex`) already replays exploits in a **zkVM** against forked chain state and emits a SNARK attesting exploitability without disclosure.
**Surviving gap:** zkpoex proves only a *boolean*, uses a zkVM not a TEE, and has **no severity/novelty/value-at-risk scoring and no escrow-on-attestation**. Viable only if pitched explicitly as that wrapper, citing zkpoex as the baseline. Claiming "proof of exploit" as your own invites an instant gotcha.

---

### Tier B — strong, more conventional

---

### A5. Radar — liquidation early-warning across every lending market at once

**Real problem.** Your positions are scattered across Aave, Compound, Morpho, Spark and five chains, and each one warns you separately, in its own units, if at all.

**Mechanism.** One query across **Messari's standardized Lending/CDP schema** for every market you touch, unified health factor, and a **private** risk threshold in a TEE (public thresholds get farmed by liquidators who know exactly where you'll act). Emergency top-up requires a hardware confirm.

**Sponsors:** The Graph (standardized Lending schema, multi-chain) + Chainlink CRE (private thresholds — *and their separate $500 Liquidation Protection Challenge is a second prize from the same work*) + Ledger (device confirm before emergency capital moves — verbatim their "human before anything irreversible").

**Bonus:** Chainlink's challenge has its own $500 and a published scoring scenario. Free second bite.

**Hole:** Hypernative, Chaos Labs and DeFiSaver occupy this space commercially. Differentiator is the standardized-schema breadth + confidential thresholds.

---

### A6. Backstop — unbacked-mint detection with automatic exit

**Real problem, biggest single loss vector in the window.** May 1-Sep 10: **172 incidents, $1.007B**, of which bridge/cross-chain is **38.9% ($392M)** and **"unbacked cross-chain mint" alone is $334M**. Liquid Network, Sep 6-7: **$320M**, ~4,000 BTC — *a proof-cache bypass in Elements Confidential Transactions minted unbacked L-BTC*. Not stolen keys. Broken verification.

**Mechanism.** Continuously reconcile minted-across-destinations against locked-at-source. On divergence, **exit the position automatically** rather than sending an alert nobody reads.

**Sponsors:** The Graph (Substreams multi-chain realtime + **Messari Bridge v1.2.0** standardized schema — a direct hit on "one query across many protocols") + Chainlink CRE (thresholds must be secret or an attacker sizes the mint to stay under) + Uniswap or Arc (the exit route).

**The killer demo:** **backtest against real exploits.** Replay Liquid from indexed history and show the divergence signal firing before the dump — *"detected 6 minutes early"* — a falsifiable claim on real data.

**Hole:** detection accuracy is the whole product and bridges have legitimate mint/burn asymmetries and in-flight messages. False positives dump your position for nothing. Third leg ("execution") is the weakest of the three.

**⚠️ Prior-art verdict: CROWDED on detection, narrow OPEN GAP on the exit — scope tightly.** Detection is saturated: **Chainlink Proof of Reserve already auto-halts minting** via Automation (Swingby/Skybridge case study); **Hexagate** (now Chainalysis) does real-time burn/release reconciliation with automated protocol-side response, claiming **>$1B saved**; **Hypernative** explicitly markets "move funds to safety."
**What nobody does:** wire a PoR-style mint-vs-lock mismatch to an *individual, self-custodied, user-controlled* exit. (Harpie auto-evacuates, but on mempool drain detection, not reserve mismatch.)
**Therefore: pitch it as a personal auto-exit agent, never as bridge monitoring.** Framed broadly it dies; framed narrowly it survives.

---

### A7. Keyring — a secret broker your coding agent can't leak

**Real problem, four weeks old.** The **ChainDrop npm worm** (Aug 4) hit 444 packages / 2,212 malicious versions in four hours via `keyv@6.0.0` (153.7M weekly downloads). It dumped GitHub Actions runner memory, **republished itself with valid SLSA provenance attestations**, used an Ethereum mainnet dead-drop C2 — and specifically **harvested `.claude/`, `.cursor/` and `.openai/` credentials**, installing persistence hooks in VS Code and Claude Code configs.

**Mechanism.** Your agent never receives an API key. A broker issues short-lived, scoped capabilities backed by a hardware key ring; the agent gets a capability that expires, not a secret it can exfiltrate.

**Sponsors:** Ledger (Key Ring CLI — *literally their stated ask*: "a broker hands out scoped capabilities, never the API key" and "bring the Key Ring to hosts with no USB port: enroll a VPS, a CI runner, or a hosted agent") + Bazantic (scoped agent-payable services behind the broker) + Hedera x402 (agent pays per capability use).

**❌ Also confirmed non-viable without hardware.** No Speculos or emulator path is documented anywhere in Ledger's hackathon materials, and the seed-derived key wrapping appears to need a real device tap for setup. Their own submission option of a "recorded walkthrough" implies they expect you to have run it on real hardware. **Prior-art verdict: SATURATED. Do not build.** **Ledger open-sourced the Agent Stack on 2026-07-16** — hardware-signer-enforced execution for agents proposing wallet actions. Worse, **1Claw** (1claw.co) has already productized this exact concept: HSM/MPC-backed secrets for AI agents, TEE-inspected traffic, keys never leaving hardware, per-grant traceability. OneCLI is a software-only adjacent competitor. The space is actively consolidating around this precise pattern *right now*. Pitching it to Ledger's own judges would be embarrassing.

---

### A8. Statement — agent spending, reconciled

**Real problem, named by practitioners.** *"x402 moves the dollar but does not track your budget. AP2 proves authorization for one purchase but does not aggregate a session. Stripe MPP bills the session but does not enforce your per-agent, per-project policy."* The cap has to live above the rail, and nobody has shipped it. Real damage: enterprises burning annual AI budgets in a quarter; Microsoft pulling internal Claude Code licences over token overruns.

**Mechanism.** Reconcile everything an agent spent across chains, rails and standards into one statement — with per-agent, per-project budget enforcement above the payment layer.

**Sponsors:** The Graph (spend across x402 flows, ERC-8004/Agent0 registries on 9 chains, and token transfers — genuinely multi-source) + Hedera (x402-gated service + HCS audit trail) + Privy (policies and key quorums enforce the cap).

**⚠️ Warning:** this is **the most crowded shape in the field** — hundreds of agent-mandate/budget repos. Only take it if the reconciliation angle is genuinely differentiated from the enforcement angle everyone else is building.

---

### Tier C — worth considering

**A9. Corporate Actions Engine.** ATS handles coupons and dividends but automation is manual. Scheduled Transactions for coupon dates + Chainlink for NAV + The Graph for the holder register. *Hedera + Chainlink + Graph.* Boring but very winnable; ATS track is thin.

**A10. Invoice Factoring.** Hedera's own listed idea ("cashflow tokenisation: invoices sold at a discount, settled on maturity"). Real SME market. *Hedera ATS + Arc (USDC settlement) + Chainlink CRE (confidential debtor credit scoring — the scoring model can't be public).*

**A11. One-Prompt Substreams.** The Graph's own **featured challenge**: natural language → a working, deployed Substreams pipeline via Substreams SKILLs. Almost nobody attempts featured challenges. *Graph (both tracks) + Bazantic (expose generated pipelines as agent-payable services) + Hedera or Arc.* Note: `streamingfast/substreams-skills` uses branch `develop`.

**A12. Launch Forensics.** Robinhood's **Pons is the #3 protocol on earth by fees** ($4.88M/24h) — but analysis shows the volume is trading terminals and bots, not retail. Real-time insider/sniper detection across launchpads via Substreams, surfaced before you buy. *Graph + Uniswap + Chainlink CRE (private detection heuristics).*

**A13. Depeg Watch.** Multi-chain stablecoin reserve and pool-imbalance early warning, with automatic rotation. Timely: **21 banks** forming a joint stablecoin, U.S. Bank launched USBDC. *Graph + Chainlink + Arc.*

**A14. Confidential Rebalancing.** Chainlink's own listed example — private target allocations and trade sizing in a TEE. *Chainlink + Graph (positions) + Uniswap/1inch (execution).* Lower novelty since their template exists.

**A15. Agent Expense Policy via ENS.** Agents as namespaces with EAC-scoped, expiring spend rights. *ENS + Graph + Privy.* **Crowded** — this is the dominant field shape.

**A16. Weak-Key Wallet Scanner.** Coldcard firmware 4.0.1 (March 2021) silently fell back to a non-cryptographic PRNG: **128 bits → ~40 bits**, **$116-130M**, **5,200+ addresses**, and **updating firmware does not fix existing wallets**. Thousands of people are silently drainable right now. Real and urgent — but detection is cryptographic, not indexing, so sponsor fit is weak. Listed because the problem is too real to omit.

**A17. Aqua Delegated MM.** Non-custodial delegated market making — strategist ships SwapVM programs against capital that never leaves your wallet, revocable via ENS EAC. *1inch + ENS + Graph.* **Economically weak:** returns are dominated by order flow, and Aqua has none yet. Great technical submission, poor product story.

**A18. Bazantic Bolt-On.** Whatever you build, wrapping its internal API as a Bazantic gateway + Recipe is ~an afternoon and targets **6 slots against near-zero competition**. Only counts as one of your three selections — use it when the third leg would otherwise be decoration.

---

## 3. Ranked shortlist

*Reordered after the adversarial prior-art pass. Two ideas died; one was validated.*

| # | Idea | Prior-art verdict | Sponsor fit | Demo | Risk |
|---|---|---|---|---|---|
| **1** | **A2 Gantry** | ✅ **OPEN GAP, uncontested** | Excellent | Strong | Address rotation |
| 2 | **A6 Backstop** | ⚠️ Gap only if scoped to *personal* auto-exit | Good | **Best — real backtest** | Detection accuracy |
| 3 | **A3 Vault Truth** | ⚠️ Crowded + Graph's own prompt → rivals | **Best Graph fit** | Medium | Competing submissions |
| 4 | **A5 Radar** | Not checked | Good + bonus $500 | Medium | Commercial incumbents |
| 5 | **A4 Sealed Bounty** | ⚠️ zkpoex + 6yrs prior art; wrapper only | Good | Strong | Embarrassment risk |
| — | ~~A1 Compliant Pool~~ | ❌ **Uniswap shipped it 2026-07-23** | — | — | Dead |
| — | ~~A7 Keyring~~ | ❌ **Ledger + 1Claw shipped it** | — | — | Dead |

**A2 Gantry is the pick.** It is the only idea on this list with a clean, verified "nobody has done this specific combination" claim and no embarrassment risk. A6 is the credible fallback, but only under tight scoping.

---

## 4. Sponsor stacks worth building toward

- **RWA stack:** Hedera ATS + Uniswap v4 + The Graph → A9 *(A1 dead)*
- **Mechanism stack:** Uniswap v4 + The Graph + Chainlink CRE → A2, A12
- **Data stack:** The Graph + Privy + Bazantic → A3
- **Security stack:** Chainlink CRE + Hedera HCS + The Graph → A4, A6
- ~~**Agent stack:** Ledger + Bazantic + Hedera x402~~ *(A7 dead)*

---

## 5. Do not build these

**World's named exclusions:** agent reputation · human-backed benefits for agents (API calls, discounts) · human-verified content generation · Selfie Check as generic login · client-side proof verification (hard DQ) · gambling mini apps.

**Shipped by the sponsor themselves — never pitch these:** compliance-gated AMM pools (**Uniswap Permissioned Pools, 2026-07-23**, with Securitize/Superstate/Dowgo) · hardware-backed agent secret brokers (**Ledger Agent Stack, 2026-07-16**, plus 1Claw productizing it) · proof-of-exploit without disclosure (**Trail of Bits/DARPA 2020**, **zkpoex** ACM SAC 2025/26).

**Already won, don't repeat:** *Commitment Issues* (human signs agent-authored commits) · *Human Bond* (90-day proof-of-life heartbeat with financial consequence) · *Turing Swap* (humans pay lower DEX fees) · *TreasureHunt* (sybil-gated physical game) · *BookerBob* (personhood as booking underwriting) · *MEVictim Rebate* (MEV-victim NFT unlocks rebate pool) · *Accrue* (get paid to wait) · *NpmGuard* (agents audit npm).

**Dead archetypes (from 450 winners):** governance/DAO tooling (4-5%) · generic cross-chain bridges (finalist share 8% vs 13% bounty) · portfolio dashboards · "AI assistant for your wallet" with no mechanism · ZK for its own sake (16% finalist vs 22% bounty).

**Oversaturated at THIS event:** "agent + wallet + mandate + reputation gate" — hundreds of repos. x402 generally — 1,037 repos created since Aug 15, against an economy whose *measured* real volume is ~$87/day across 680 services. Arc — 70+ repos.

---

## 6. Submission mechanics — these are auto-rejections

- **Video 2-4 min, ≥720p, narrated by a human.** No sped-up footage, no music-over-text, no AI voiceover/TTS, not phone-recorded.
- **Commit continuously from kickoff.** A single fat commit is *presumed disqualified*.
- **Commit your spec/prompt files** if using AI tooling — fully-AI-generated submissions are ineligible for partner prizes and finalist consideration.
- **"How it's made": 1,500-2,500 chars of real architecture.** Finalist median is 1,846; bottom quartile of winners ~800. Booth judging is now optional and **partners judge asynchronously from your write-up** — this is the highest-ROI hour of the event.
- **Deploy it and put the live URL in the submission.** Only 16% of finalists do; never required; correlates with winning.
- **Tagline uses "X for Y"** with a product judges already know — every hard-to-demo winner did this (*"Google Analytics for x402"*, *"DeFiLlama for the agent economy"*).
- **Exactly 3 partner selections.** Multiple tracks from one sponsor = one selection.
- Live pitch if you advance: **7 min = 4 demo + 3 Q&A.** Scoring: Technicality · Originality · Practicality · Usability · **WOW Factor**.

---

## 7. ⏰ Deadline

**Ledger's track page states a submission deadline of September 13, 2026.** Today is September 11. **Confirm this against the main ETHOnline submission page before committing** — at two days, solo, the feasible choice set is much narrower than this document assumes, and A2's full stack (v4 hook + Substreams + CRE workflow) is a lot of surface.

## 7b. Open verifications

~~1. v4 hook + ERC-3643~~ — ✅ answered. Possible, but PoolManager must be a verified identity; A1 dead on prior art anyway.
~~2. Ledger Key Ring hardware~~ — ✅ answered. No emulator path. Not viable.
~~3. CRE TEE limits~~ — ✅ answered. Nitro, 8 HTTP / 1 write / 3 secrets, binary not confidential.
~~4. ERC-4626 module~~ — ✅ answered. Pinax has one; canonical registry doesn't.
~~5. Prior art on A1/A2~~ — ✅ answered. A1 saturated, A2 open gap.

**Still open:**
1. **Confirm the real submission deadline.**
2. Whether CRE's 8-HTTP / 1-EVM-write ceiling is a platform limit or just the template default — test empirically with `cre workflow simulate`.
3. Whether A2's behavioural scoring can run within those call limits at swap frequency.

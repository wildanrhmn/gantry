# Feedback on building a v4 hook

Gantry is a v4 hook that returns a different LP fee per swap depending on the caller's
on-chain behaviour. Everything below is friction hit while building it, in the order it
was hit. Where something cost real time, the cost is stated.

## The thing that cost the most time: a silent deploy failure

`PoolManager` compiles to **34,623 bytes**, well past the EIP-170 limit of 24,576.

Deploying a local one needs `--disable-code-size-limit` on **both** `anvil` **and**
`forge script`. Neither flag alone is enough, and that is not the problem. The problem is
what happens when you get it wrong:

```
forge script script/Deploy.s.sol:Deploy --rpc-url http://127.0.0.1:8545 --broadcast
  PoolManager 0x5FbDB2315678afecb367f032d93F642f64180aa3
  TierOracle  0xe7f1725E7734CE288F8367e1Bb143E90bb3F0512
  Gantry      0x6Db5C644C687Ec2f779F65674eCEAD8885014080
```

Three addresses printed, exit code fine. `cast codesize` on all three returns `0`. Nothing
was deployed. The script prints the addresses it *simulated*, so a failed broadcast reads
as a success, and the next command that touches those addresses fails somewhere unrelated.

This cost two wasted deploy cycles before checking codesize directly. A warning on the
deployments page, or a non-zero exit when a broadcast drops a transaction, would have saved
all of it.

## `BaseHook` is gone from v4-periphery and nothing says so

Every hook tutorial and most blog posts start with `import {BaseHook} from
"v4-periphery/src/base/hooks/BaseHook.sol"`. That path does not exist in current
v4-periphery - there is no `BaseHook.sol` anywhere in the repo.

The working answer is `OpenZeppelin/uniswap-hooks` (`uniswap-hooks/base/BaseHook.sol`),
which is a fine home for it, but finding that took a search of the whole dependency tree.
A line in the v4 docs saying where it moved would help every new hook author.

## `sender` in `beforeSwap` is the router, and this deserves a warning

`beforeSwap(address sender, ...)` gives `msg.sender` of `PoolManager.swap()`. For any swap
through Universal Router or a periphery router, that is the router, not the trader.

For a hook that prices per-swap this is the single most important fact about the whole
interface, and it is easy to miss until you deploy and every user is priced identically.
It is documented, but as a parameter description rather than as the design consideration it
actually is.

Measured on mainnet while building this: the Universal Router shows **1,319 distinct
transaction originators across 3,580 swaps** in a 1,500-block window, while a dedicated bot
contract shows exactly one. Any hook that treats `sender` as "the user" is wrong in the
overwhelming majority of cases.

Suggestion: a short "who is `sender`?" note in the hooks guide, with the routed vs direct
distinction spelled out.

## `deployCodeTo` cannot resolve private constants in a constructor signature

This fails:

```solidity
uint256 private constant TIER_COUNT = 4;
constructor(IPoolManager pm, ITierOracle oracle, uint24[TIER_COUNT] memory fees) { ... }
```

```
Error (7576): Undeclared identifier.
 --> foundry-pp/DeployHelper99.sol:9:64:
    IPoolManager poolManager_; ITierOracle oracle_; uint24[TIER_COUNT] fees;
```

The preprocessor copies the constructor's parameter list into a generated struct without
the contract's constants in scope. Changing the signature to `uint24[4]` fixes it. This is
a Foundry issue rather than a Uniswap one, but it bites specifically when using
`deployCodeTo` to place a hook at a mined address, which is the standard v4 test pattern.

## Docs redirects break automated fetching

`docs.uniswap.org/contracts/v4/deployments` 301s to `developers.uniswap.org`, which then
303s to `developers.uniswap.org/llms.mdx/docs/protocols/v4/deployments`. Three hops.
Anything scripted, and any agent reading the docs, gives up before the content.

## What worked well

- **`uniswapfoundation/v4-template`** is genuinely good. HookMiner already wired, a working
  example hook, a test harness with pool manager and tokens ready. Starting from it removed
  a whole class of setup mistakes.
- **The dynamic-fee mechanism is clean.** Initialise with `DYNAMIC_FEE_FLAG`, return
  `fee | OVERRIDE_FEE_FLAG` from `beforeSwap`, and the override applies to that swap only.
  It did exactly what the source said it would, first time.
- **Permissions encoded in the hook address** is unusual and took a minute to absorb, but it
  is self-verifying: `address & 0x3FFF == 128` proves the deployed hook has exactly the
  `BEFORE_SWAP` permission and nothing else. Good design.
- **`v4-core`'s own test contracts** (`DynamicReturnFeeTestHook`, `PoolSwapTest`) are better
  documentation than the docs. Reading them answered more questions than the guides did.

## One request

A note in the hooks documentation about what a reverting hook does to a pool. A hook that
reverts blocks every swap against that pool for everyone, permanently, until it stops
reverting. Gantry fails open on every path for this reason - a missing or reverting oracle
resolves to the default tier rather than bubbling up - but that design decision came from
reading `Hooks.sol`, not from any guidance.

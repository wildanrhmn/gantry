# Sepolia

All addresses below are live on Sepolia (chain 11155111), deployed from block 11677077.

| Contract | Address |
| --- | --- |
| Gantry hook | `0x42A5B912625E0b9Aba3286CEfA3BB823DDAE0080` |
| TierOracle | `0x846d3eF24c3c6e079Bd95cFeACC08B21427C9132` |
| TierReportReceiver | `0x351278Ef6FF1325c69127255936e5E7d0B47A1A4` |
| PoolManager (Uniswap canonical) | `0xE03A1074c86CFeDd5C142C4F04F1a1536e203543` |

The hook address ends in `0080`, whose low 14 bits are `128` - the `BEFORE_SWAP` permission
bit. That is not cosmetic; v4 reads permissions out of the address itself, so the salt was
mined to land there.

## Demo pool

| | Address |
| --- | --- |
| Token0 (GTA) | `0xda8Fb81A250fe0A96E0D096B692667b5D1F44D03` |
| Token1 (GTB) | `0xDaB15723e1c29a2d8133b9b678dE433a3992DB9F` |
| Router priced as an extractor | `0xd54db805b9437C43041A6C635bFdd7262De8182c` |
| Router at the default tier | `0x82FDc5C726EbA76cB8f167d040fdF2e09334a2dC` |

Fees per tier: 0.05% clean, 0.30% unknown, 0.60% suspected, 1.00% extractor.

## The two swaps in block 11677086

Same pool, same size, same block:

```
payer 0xd54db805...  tier 3  fee 1.0%
payer 0x82fdc5c7...  tier 1  fee 0.3%
```

That is the whole idea, on a public chain.

## Subgraph

Live at `https://api.studio.thegraph.com/query/1760064/gantry/0.0.1`, indexing from
block 11677077 with no indexing errors.

First query against it returned the two real swaps:

```
0xd54db805...  tier 3  scored true   swaps 1
0x82fdc5c7...  tier 1  scored false  swaps 1
```

`scored: false` on the second is the point - it is on the default tier because nobody
scored it, not because anyone decided it was clean.

## The full path, on Sepolia

The report bytes came from the workflow's own `encodeTierReport()`, and the metadata was
packed the way the Chainlink forwarder packs it: 32 bytes workflow id, 10 bytes name,
20 bytes owner. Delivered to `TierReportReceiver.onReport` in tx
`0x55f1dfe3c8a7920bb0a68f7313b204ee71e748dbde07f6990ebad78beccea2c8`.

One address, two prices, before and after that report:

```
block 11677086  0x82fdc5c726...  tier 1  fee 0.30%
block 11677137  0x82fdc5c726...  tier 0  fee 0.05%
```

Same pool, same size, six times cheaper, because a report moved it a tier. The subgraph
recorded the transition as previousTier 1 -> tier 0.

## What is still not exercised

Chainlink's own Forwarder verifying DON signatures before it calls `onReport`. Our
receiver trusts the forwarder by design - it checks `msg.sender`, the workflow owner and
the workflow name, and leaves signature verification to the forwarder. So the untested
piece is Chainlink infrastructure, not this repo. Running it for real needs CRE deploy
access, which is not enabled for the org.

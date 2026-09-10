# Where to deploy

Gantry attaches to an existing v4 `PoolManager`, so pick a network and pass its
canonical address. Do not deploy your own manager on a live network.

| Network | Chain ID | PoolManager |
| --- | --- | --- |
| Sepolia | 11155111 | `0xE03A1074c86CFeDd5C142C4F04F1a1536e203543` |
| Base Sepolia | 84532 | `0x05E73354cFDd6745C338b50BcFDfA3Aa6fA03408` |
| Unichain Sepolia | 1301 | `0x00b036b58a818b1bc34d502d3fe730db729e62ac` |
| Arbitrum Sepolia | 421614 | `0xFB3e0C6F74eB1a21CC1Da29aeC80D2Dfe6C9a317` |

Universal Router, StateView and Quoter for the same networks are in the Uniswap docs
under v4 deployments.

## Deploy

```bash
export PRIVATE_KEY=0x...
export POOL_MANAGER=0xE03A1074c86CFeDd5C142C4F04F1a1536e203543

forge script script/Deploy.s.sol:Deploy \
  --rpc-url $SEPOLIA_RPC --broadcast --verify
```

`POOL_MANAGER` makes the script use the canonical manager instead of deploying one,
which also sidesteps the EIP-170 size problem entirely.

Note the deployed `Gantry` and `TierOracle` addresses and the block they landed in -
the subgraph manifest needs both.

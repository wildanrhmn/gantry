import { createPublicClient, custom, encodeAbiParameters, http, keccak256, type Address, type Hex } from "viem";
import { sepolia } from "viem/chains";

export const CHAIN = sepolia;

export const ADDRESSES = {
  gantry: "0xa3D2A9ee28198496D5DF469A8FF149aD2d780080",
  oracle: "0x846d3eF24c3c6e079Bd95cFeACC08B21427C9132",
  receiver: "0x351278Ef6FF1325c69127255936e5E7d0B47A1A4",
  poolManager: "0xE03A1074c86CFeDd5C142C4F04F1a1536e203543",
  router: "0x867a6f9CAcC6d7341Fad9d0d5Fac193dF684C0a9",
  token0: "0x814b446F9fcAeDF9521BCcF987b4B7584697E3dA",
  token1: "0xea8c0f41dd721804a346bA6a8F037eF2edd95fFD",
} as const satisfies Record<string, Address>;

export const TOKENS = {
  [ADDRESSES.token0]: { symbol: "gUSD", name: "Gantry USD" },
  [ADDRESSES.token1]: { symbol: "gETH", name: "Gantry ETH" },
} as const;

/** Dynamic-fee pools are opened with this flag; the hook overrides the fee per swap. */
export const DYNAMIC_FEE_FLAG = 0x800000;
export const TICK_SPACING = 60;
export const MIN_PRICE_LIMIT = BigInt("4295128740");
export const MAX_PRICE_LIMIT = BigInt("1461446703485210103287273052203988822378723970341");

export const POOL_KEY = {
  currency0: ADDRESSES.token0,
  currency1: ADDRESSES.token1,
  fee: DYNAMIC_FEE_FLAG,
  tickSpacing: TICK_SPACING,
  hooks: ADDRESSES.gantry,
} as const;

export const publicClient = createPublicClient({
  chain: CHAIN,
  transport: http("https://ethereum-sepolia-rpc.publicnode.com"),
});

export function browserTransport() {
  const eth = (globalThis as { ethereum?: unknown }).ethereum;
  if (!eth) return null;
  return custom(eth as never);
}

export const erc20Abi = [
  { type: "function", name: "mint", stateMutability: "nonpayable", inputs: [{ name: "to", type: "address" }, { name: "value", type: "uint256" }], outputs: [] },
  { type: "function", name: "approve", stateMutability: "nonpayable", inputs: [{ name: "spender", type: "address" }, { name: "value", type: "uint256" }], outputs: [{ type: "bool" }] },
  { type: "function", name: "balanceOf", stateMutability: "view", inputs: [{ name: "a", type: "address" }], outputs: [{ type: "uint256" }] },
  { type: "function", name: "allowance", stateMutability: "view", inputs: [{ name: "o", type: "address" }, { name: "s", type: "address" }], outputs: [{ type: "uint256" }] },
] as const;

export const routerAbi = [
  {
    type: "function",
    name: "swap",
    stateMutability: "payable",
    inputs: [
      { name: "key", type: "tuple", components: [
        { name: "currency0", type: "address" }, { name: "currency1", type: "address" },
        { name: "fee", type: "uint24" }, { name: "tickSpacing", type: "int24" }, { name: "hooks", type: "address" },
      ]},
      { name: "params", type: "tuple", components: [
        { name: "zeroForOne", type: "bool" }, { name: "amountSpecified", type: "int256" },
        { name: "sqrtPriceLimitX96", type: "uint160" },
      ]},
      { name: "testSettings", type: "tuple", components: [
        { name: "takeClaims", type: "bool" }, { name: "settleUsingBurn", type: "bool" },
      ]},
      { name: "hookData", type: "bytes" },
    ],
    outputs: [{ type: "int256" }],
  },
] as const;

export const gantryAbi = [
  { type: "function", name: "tierFee", stateMutability: "view", inputs: [{ type: "uint256" }], outputs: [{ type: "uint24" }] },
  {
    type: "event", name: "Tolled",
    inputs: [
      { name: "payer", type: "address", indexed: true },
      { name: "tier", type: "uint8", indexed: false },
      { name: "fee", type: "uint24", indexed: false },
    ],
  },
] as const;

export const oracleAbi = [
  { type: "function", name: "tierOf", stateMutability: "view", inputs: [{ type: "address" }], outputs: [{ type: "uint8" }] },
] as const;

/** v4 derives a pool id as keccak256(abi.encode(PoolKey)). */
export function poolId(): Hex {
  return keccak256(
    encodeAbiParameters(
      [{ type: "address" }, { type: "address" }, { type: "uint24" }, { type: "int24" }, { type: "address" }],
      [POOL_KEY.currency0, POOL_KEY.currency1, POOL_KEY.fee, POOL_KEY.tickSpacing, POOL_KEY.hooks],
    ),
  );
}

/** hookData the hook decodes: (trader, deadline, signature). */
export function encodeAttestation(trader: Address, deadline: bigint, signature: Hex): Hex {
  return encodeAbiParameters(
    [{ type: "address" }, { type: "uint256" }, { type: "bytes" }],
    [trader, deadline, signature],
  );
}

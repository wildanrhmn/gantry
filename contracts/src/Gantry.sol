// SPDX-License-Identifier: MIT
pragma solidity ^0.8.26;

import {BaseHook} from "uniswap-hooks/base/BaseHook.sol";
import {Hooks} from "@uniswap/v4-core/src/libraries/Hooks.sol";
import {IPoolManager} from "@uniswap/v4-core/src/interfaces/IPoolManager.sol";
import {PoolKey} from "@uniswap/v4-core/src/types/PoolKey.sol";
import {SwapParams} from "@uniswap/v4-core/src/types/PoolOperation.sol";
import {BeforeSwapDelta, BeforeSwapDeltaLibrary} from "@uniswap/v4-core/src/types/BeforeSwapDelta.sol";
import {LPFeeLibrary} from "@uniswap/v4-core/src/libraries/LPFeeLibrary.sol";
import {IHooks} from "@uniswap/v4-core/src/interfaces/IHooks.sol";
import {ITierOracle} from "./interfaces/ITierOracle.sol";

/// @notice Prices each swap by the caller's behaviour tier. Nobody is ever blocked;
/// toxic flow simply pays more, and the surplus stays with the pool's LPs.
contract Gantry is BaseHook {
    uint256 private constant TIER_COUNT = 4;

    /// @dev Hard ceiling on anything this hook can charge, so a bad tier table cannot confiscate a trade.
    uint24 public constant MAX_FEE = 10_000;

    uint8 private constant FALLBACK_TIER = 1;

    ITierOracle public immutable oracle;

    uint24[4] public tierFee;

    event Tolled(address indexed payer, uint8 tier, uint24 fee);

    error FeeTooHigh();

    constructor(IPoolManager poolManager_, ITierOracle oracle_, uint24[4] memory fees) BaseHook(poolManager_) {
        oracle = oracle_;
        for (uint256 i; i < TIER_COUNT; ++i) {
            if (fees[i] > MAX_FEE) revert FeeTooHigh();
            tierFee[i] = fees[i];
        }
    }

    function getHookPermissions() public pure override returns (Hooks.Permissions memory) {
        return Hooks.Permissions({
            beforeInitialize: false,
            afterInitialize: false,
            beforeAddLiquidity: false,
            afterAddLiquidity: false,
            beforeRemoveLiquidity: false,
            afterRemoveLiquidity: false,
            beforeSwap: true,
            afterSwap: false,
            beforeDonate: false,
            afterDonate: false,
            beforeSwapReturnDelta: false,
            afterSwapReturnDelta: false,
            afterAddLiquidityReturnDelta: false,
            afterRemoveLiquidityReturnDelta: false
        });
    }

    /// @dev `sender` is whoever called the PoolManager. MEV bots call from their own
    /// contracts and are therefore scored individually; swaps arriving through a shared
    /// router are indistinguishable to us and fall to the default tier.
    function _beforeSwap(address sender, PoolKey calldata, SwapParams calldata, bytes calldata)
        internal
        override
        returns (bytes4, BeforeSwapDelta, uint24)
    {
        uint8 tier = _tierOf(sender);
        uint24 fee = tierFee[tier];
        emit Tolled(sender, tier, fee);
        return (IHooks.beforeSwap.selector, BeforeSwapDeltaLibrary.ZERO_DELTA, fee | LPFeeLibrary.OVERRIDE_FEE_FLAG);
    }

    /// @dev A missing or misbehaving oracle must never be able to halt the pool,
    /// so every failure path resolves to the default tier rather than reverting.
    function _tierOf(address account) private view returns (uint8) {
        try oracle.tierOf(account) returns (uint8 tier) {
            return tier < TIER_COUNT ? tier : FALLBACK_TIER;
        } catch {
            return FALLBACK_TIER;
        }
    }
}

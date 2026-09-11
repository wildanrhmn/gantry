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
import {PoolId, PoolIdLibrary} from "@uniswap/v4-core/src/types/PoolId.sol";
import {ECDSA} from "@openzeppelin/contracts/utils/cryptography/ECDSA.sol";
import {EIP712} from "@openzeppelin/contracts/utils/cryptography/EIP712.sol";
import {ITierOracle} from "./interfaces/ITierOracle.sol";

/// @notice Prices each swap by the caller's behaviour tier. Nobody is ever blocked;
/// toxic flow simply pays more, and the surplus stays with the pool's LPs.
contract Gantry is BaseHook, EIP712 {
    using PoolIdLibrary for PoolKey;

    uint256 private constant TIER_COUNT = 4;

    /// @dev Hard ceiling on anything this hook can charge, so a bad tier table cannot confiscate a trade.
    uint24 public constant MAX_FEE = 10_000;

    uint8 private constant FALLBACK_TIER = 1;

    ITierOracle public immutable oracle;

    uint24[4] public tierFee;

    /// @notice Next attestation number a trader may sign. Consumed on use so a
    /// signature can never be presented twice.
    mapping(address => uint256) public nonces;

    event Tolled(address indexed payer, uint8 tier, uint24 fee);
    event Attested(address indexed trader, address indexed sender, uint256 nonce);

    error FeeTooHigh();

    /// @dev Attestation(address trader,address sender,bytes32 poolId,uint256 nonce,uint256 deadline)
    bytes32 private constant ATTESTATION_TYPEHASH = keccak256(
        "Attestation(address trader,address sender,bytes32 poolId,uint256 nonce,uint256 deadline)"
    );

    constructor(IPoolManager poolManager_, ITierOracle oracle_, uint24[4] memory fees)
        BaseHook(poolManager_)
        EIP712("Gantry", "1")
    {
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

    function _beforeSwap(address sender, PoolKey calldata key, SwapParams calldata, bytes calldata hookData)
        internal
        override
        returns (bytes4, BeforeSwapDelta, uint24)
    {
        address payer = _resolvePayer(sender, key, hookData);
        uint8 tier = _tierOf(payer);
        uint24 fee = tierFee[tier];
        emit Tolled(payer, tier, fee);
        return (IHooks.beforeSwap.selector, BeforeSwapDeltaLibrary.ZERO_DELTA, fee | LPFeeLibrary.OVERRIDE_FEE_FLAG);
    }

    /// @notice Digest a trader signs to be priced on their own history rather than their router's.
    /// EIP-712 so a wallet can show what is being signed. Bound to this hook, this chain and
    /// this pool so it cannot be replayed elsewhere; bound to `sender` and a one-shot `nonce`
    /// so it is worthless to anyone but the router the trader signed for, exactly once.
    function attestationDigest(
        address trader,
        address sender,
        PoolKey calldata key,
        uint256 nonce,
        uint256 deadline
    ) public view returns (bytes32) {
        return _hashTypedDataV4(
            keccak256(
                abi.encode(ATTESTATION_TYPEHASH, trader, sender, PoolId.unwrap(key.toId()), nonce, deadline)
            )
        );
    }

    /// @dev Exposed only so the decode below can be attempted inside a try/catch.
    function decodeAttestation(bytes calldata data)
        external
        pure
        returns (address, uint256, uint256, bytes memory)
    {
        return abi.decode(data, (address, uint256, uint256, bytes));
    }

    /// @dev `sender` is whoever called the PoolManager, which for a shared router is the router
    /// itself. A trader behind one can sign an attestation to be scored as themselves. Anything
    /// malformed, expired, replayed or unsigned quietly falls back to pricing the caller.
    function _resolvePayer(address sender, PoolKey calldata key, bytes calldata hookData)
        private
        returns (address)
    {
        if (hookData.length == 0) return sender;

        try this.decodeAttestation(hookData) returns (
            address trader, uint256 nonce, uint256 deadline, bytes memory signature
        ) {
            if (block.timestamp > deadline) return sender;
            // An attestation is only good for the next number this trader has not spent.
            if (nonce != nonces[trader]) return sender;

            (address recovered, ECDSA.RecoverError err,) =
                ECDSA.tryRecover(attestationDigest(trader, sender, key, nonce, deadline), signature);
            if (err != ECDSA.RecoverError.NoError || recovered != trader) return sender;

            // Spend it, so the same signature cannot price a second swap.
            unchecked {
                nonces[trader] = nonce + 1;
            }
            emit Attested(trader, sender, nonce);
            return trader;
        } catch {
            return sender;
        }
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

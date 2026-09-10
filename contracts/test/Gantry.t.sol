// SPDX-License-Identifier: MIT
pragma solidity ^0.8.26;

import {Test} from "forge-std/Test.sol";
import {Vm} from "forge-std/Vm.sol";
import {Deployers} from "@uniswap/v4-core/test/utils/Deployers.sol";
import {PoolSwapTest} from "@uniswap/v4-core/src/test/PoolSwapTest.sol";
import {Hooks} from "@uniswap/v4-core/src/libraries/Hooks.sol";
import {IHooks} from "@uniswap/v4-core/src/interfaces/IHooks.sol";
import {PoolKey} from "@uniswap/v4-core/src/types/PoolKey.sol";
import {Currency} from "@uniswap/v4-core/src/types/Currency.sol";
import {SwapParams} from "@uniswap/v4-core/src/types/PoolOperation.sol";
import {LPFeeLibrary} from "@uniswap/v4-core/src/libraries/LPFeeLibrary.sol";
import {IERC20Minimal} from "@uniswap/v4-core/src/interfaces/external/IERC20Minimal.sol";

import {Gantry} from "../src/Gantry.sol";
import {TierOracle} from "../src/TierOracle.sol";
import {ITierOracle} from "../src/interfaces/ITierOracle.sol";

contract GantryTest is Test, Deployers {
    Gantry internal gantry;
    TierOracle internal oracle;

    PoolSwapTest internal cleanCaller;
    PoolSwapTest internal extractorCaller;

    uint24 internal constant FEE_CLEAN = 500;
    uint24 internal constant FEE_UNKNOWN = 3_000;
    uint24 internal constant FEE_SUSPECTED = 6_000;
    uint24 internal constant FEE_EXTRACTOR = 10_000;

    int256 internal constant SWAP_AMOUNT = -1e15;

    function setUp() public {
        deployFreshManagerAndRouters();
        deployMintAndApprove2Currencies();

        oracle = new TierOracle(address(this));

        uint24[4] memory fees = [FEE_CLEAN, FEE_UNKNOWN, FEE_SUSPECTED, FEE_EXTRACTOR];
        address hookAddr = address(uint160(Hooks.BEFORE_SWAP_FLAG ^ (0x4444 << 144)));
        deployCodeTo("Gantry.sol:Gantry", abi.encode(manager, ITierOracle(address(oracle)), fees), hookAddr);
        gantry = Gantry(hookAddr);

        // The pool must be opened as a dynamic-fee pool or beforeSwap's override is ignored.
        (key,) = initPoolAndAddLiquidity(
            currency0, currency1, IHooks(hookAddr), LPFeeLibrary.DYNAMIC_FEE_FLAG, SQRT_PRICE_1_1
        );

        cleanCaller = _newCaller();
        extractorCaller = _newCaller();
    }

    /// @dev Each caller is its own contract, which is how the hook tells them apart:
    /// a bot trading from its own contract is scored, a shared router is not.
    function _newCaller() private returns (PoolSwapTest caller) {
        caller = new PoolSwapTest(manager);
        IERC20Minimal(Currency.unwrap(currency0)).approve(address(caller), type(uint256).max);
        IERC20Minimal(Currency.unwrap(currency1)).approve(address(caller), type(uint256).max);
    }

    function _swapVia(PoolSwapTest caller) private returns (uint256 received) {
        uint256 before = IERC20Minimal(Currency.unwrap(currency1)).balanceOf(address(this));
        caller.swap(
            key,
            SwapParams({zeroForOne: true, amountSpecified: SWAP_AMOUNT, sqrtPriceLimitX96: MIN_PRICE_LIMIT}),
            PoolSwapTest.TestSettings({takeClaims: false, settleUsingBurn: false}),
            ZERO_BYTES
        );
        received = IERC20Minimal(Currency.unwrap(currency1)).balanceOf(address(this)) - before;
    }

    function test_unscoredAddressGetsUnknownTierNotClean() public view {
        assertEq(oracle.tierOf(address(cleanCaller)), oracle.TIER_UNKNOWN());
        assertFalse(oracle.isScored(address(cleanCaller)));
    }

    /// The whole thesis in one assertion: same pool, same size, different behaviour, different price.
    function test_identicalSwapsPayDifferentFeesByTier() public {
        oracle.setTier(address(cleanCaller), oracle.TIER_CLEAN());
        oracle.setTier(address(extractorCaller), oracle.TIER_EXTRACTOR());

        uint256 cleanOut = _swapVia(cleanCaller);
        uint256 extractorOut = _swapVia(extractorCaller);

        assertGt(cleanOut, extractorOut, "clean tier must receive more for an identical swap");
    }

    function test_emitsTierAndFeeCharged() public {
        oracle.setTier(address(extractorCaller), oracle.TIER_EXTRACTOR());

        vm.recordLogs();
        _swapVia(extractorCaller);

        bytes32 topic = keccak256("Tolled(address,uint8,uint24)");
        bool found;
        Vm.Log[] memory logs = vm.getRecordedLogs();
        for (uint256 i; i < logs.length; ++i) {
            if (logs[i].topics[0] == topic) {
                (uint8 tier, uint24 fee) = abi.decode(logs[i].data, (uint8, uint24));
                assertEq(tier, oracle.TIER_EXTRACTOR());
                assertEq(fee, FEE_EXTRACTOR);
                found = true;
            }
        }
        assertTrue(found, "Tolled event not emitted");
    }

    /// A pool that can be halted by its own oracle is worse than no pool.
    function test_poolKeepsWorkingWhenOracleReverts() public {
        vm.mockCallRevert(address(oracle), abi.encodeWithSelector(ITierOracle.tierOf.selector), "down");
        uint256 out = _swapVia(cleanCaller);
        assertGt(out, 0, "swap must still succeed when the oracle is unavailable");
    }

    function test_feeCeilingIsEnforced() public {
        uint24[4] memory tooHigh = [FEE_CLEAN, FEE_UNKNOWN, FEE_SUSPECTED, gantry.MAX_FEE() + 1];
        address other = address(uint160(Hooks.BEFORE_SWAP_FLAG ^ (0x5555 << 144)));
        vm.expectRevert(Gantry.FeeTooHigh.selector);
        deployCodeTo("Gantry.sol:Gantry", abi.encode(manager, ITierOracle(address(oracle)), tooHigh), other);
    }
}

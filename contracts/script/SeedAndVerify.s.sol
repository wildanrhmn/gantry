// SPDX-License-Identifier: MIT
pragma solidity ^0.8.26;

import {Script, console} from "forge-std/Script.sol";
import {IPoolManager} from "@uniswap/v4-core/src/interfaces/IPoolManager.sol";
import {PoolSwapTest} from "@uniswap/v4-core/src/test/PoolSwapTest.sol";
import {PoolModifyLiquidityTest} from "@uniswap/v4-core/src/test/PoolModifyLiquidityTest.sol";
import {MockERC20} from "@uniswap/v4-core/lib/solmate/src/test/utils/mocks/MockERC20.sol";
import {IHooks} from "@uniswap/v4-core/src/interfaces/IHooks.sol";
import {PoolKey} from "@uniswap/v4-core/src/types/PoolKey.sol";
import {Currency} from "@uniswap/v4-core/src/types/Currency.sol";
import {LPFeeLibrary} from "@uniswap/v4-core/src/libraries/LPFeeLibrary.sol";
import {SwapParams, ModifyLiquidityParams} from "@uniswap/v4-core/src/types/PoolOperation.sol";
import {TierOracle} from "../src/TierOracle.sol";
import {Gantry} from "../src/Gantry.sol";

/// Deepens the pool until price impact is small next to the fee, then charges the
/// same trade at three tiers so the difference on screen is the fee and nothing else.
contract SeedAndVerify is Script {
    uint160 constant MAX_PRICE_LIMIT = 1461446703485210103287273052203988822378723970341;

    function _key() private view returns (PoolKey memory) {
        return PoolKey({
            currency0: Currency.wrap(vm.envAddress("TOKEN0")),
            currency1: Currency.wrap(vm.envAddress("TOKEN1")),
            fee: LPFeeLibrary.DYNAMIC_FEE_FLAG,
            tickSpacing: 60,
            hooks: IHooks(vm.envAddress("GANTRY"))
        });
    }

    function _attest(uint256 pk, address trader, address sender) private view returns (bytes memory) {
        Gantry gantry = Gantry(vm.envAddress("GANTRY"));
        uint256 nonce = gantry.nonces(trader);
        uint256 deadline = block.timestamp + 1 days;
        (uint8 v, bytes32 r, bytes32 s) =
            vm.sign(pk, gantry.attestationDigest(trader, sender, _key(), nonce, deadline));
        return abi.encode(trader, nonce, deadline, abi.encodePacked(r, s, v));
    }

    function run() external {
        uint256 pk = vm.envUint("PRIVATE_KEY");
        address me = vm.addr(pk);
        PoolSwapTest router = PoolSwapTest(vm.envAddress("ROUTER"));
        PoolModifyLiquidityTest lp = PoolModifyLiquidityTest(vm.envAddress("LP"));
        TierOracle oracle = TierOracle(vm.envAddress("ORACLE"));

        vm.startBroadcast(pk);

        MockERC20(vm.envAddress("TOKEN0")).mint(me, 20_000_000 ether);
        MockERC20(vm.envAddress("TOKEN1")).mint(me, 20_000_000 ether);
        MockERC20(vm.envAddress("TOKEN0")).approve(address(lp), type(uint256).max);
        MockERC20(vm.envAddress("TOKEN1")).approve(address(lp), type(uint256).max);
        MockERC20(vm.envAddress("TOKEN1")).approve(address(router), type(uint256).max);

        // Deep enough that a 1,000 unit trade barely moves the price.
        lp.modifyLiquidity(
            _key(),
            ModifyLiquidityParams({tickLower: -6000, tickUpper: 6000, liquidityDelta: 4_000_000 ether, salt: bytes32(0)}),
            ""
        );

        oracle.setWriter(me);
        _measure(pk, me, router, oracle, 3, "extractor 1.00%");
        _measure(pk, me, router, oracle, 1, "unknown   0.30%");
        _measure(pk, me, router, oracle, 0, "clean     0.05%");
        oracle.setWriter(vm.envAddress("RECEIVER"));

        vm.stopBroadcast();
    }

    function _measure(
        uint256 pk,
        address me,
        PoolSwapTest router,
        TierOracle oracle,
        uint8 tier,
        string memory label
    ) private {
        oracle.setTier(me, tier);
        uint256 before = MockERC20(vm.envAddress("TOKEN0")).balanceOf(me);
        router.swap(
            _key(),
            SwapParams({zeroForOne: false, amountSpecified: -1000 ether, sqrtPriceLimitX96: MAX_PRICE_LIMIT}),
            PoolSwapTest.TestSettings({takeClaims: false, settleUsingBurn: false}),
            _attest(pk, me, address(router))
        );
        console.log(label, MockERC20(vm.envAddress("TOKEN0")).balanceOf(me) - before);
    }
}

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
import {ModifyLiquidityParams, SwapParams} from "@uniswap/v4-core/src/types/PoolOperation.sol";

import {TierOracle} from "../src/TierOracle.sol";
import {TierReportReceiver} from "../src/TierReportReceiver.sol";

/// Opens a Gantry pool against the canonical PoolManager and puts real traffic
/// through it from two separate callers, so the indexer has something to read.
contract SepoliaPool is Script {
    uint160 constant SQRT_PRICE_1_1 = 79228162514264337593543950336;
    uint160 constant MIN_LIMIT = 4295128740;

    function run() external {
        uint256 pk = vm.envUint("PRIVATE_KEY");
        address me = vm.addr(pk);
        IPoolManager manager = IPoolManager(vm.envAddress("POOL_MANAGER"));
        address gantry = vm.envAddress("GANTRY");
        TierOracle oracle = TierOracle(vm.envAddress("ORACLE"));

        vm.startBroadcast(pk);

        TierReportReceiver receiver =
            new TierReportReceiver(oracle, vm.envAddress("CRE_FORWARDER"), me, bytes10("gantry"));

        MockERC20 a = new MockERC20("Gantry Test A", "GTA", 18);
        MockERC20 b = new MockERC20("Gantry Test B", "GTB", 18);
        (MockERC20 t0, MockERC20 t1) = address(a) < address(b) ? (a, b) : (b, a);
        t0.mint(me, 1_000 ether);
        t1.mint(me, 1_000 ether);

        PoolModifyLiquidityTest lp = new PoolModifyLiquidityTest(manager);
        PoolSwapTest botRouter = new PoolSwapTest(manager);
        PoolSwapTest retailRouter = new PoolSwapTest(manager);

        t0.approve(address(lp), type(uint256).max);
        t1.approve(address(lp), type(uint256).max);
        t0.approve(address(botRouter), type(uint256).max);
        t1.approve(address(botRouter), type(uint256).max);
        t0.approve(address(retailRouter), type(uint256).max);
        t1.approve(address(retailRouter), type(uint256).max);

        PoolKey memory key = PoolKey({
            currency0: Currency.wrap(address(t0)),
            currency1: Currency.wrap(address(t1)),
            fee: LPFeeLibrary.DYNAMIC_FEE_FLAG,
            tickSpacing: 60,
            hooks: IHooks(gantry)
        });

        manager.initialize(key, SQRT_PRICE_1_1);
        lp.modifyLiquidity(
            key,
            ModifyLiquidityParams({tickLower: -600, tickUpper: 600, liquidityDelta: 10 ether, salt: bytes32(0)}),
            ""
        );

        // One caller is marked as an extractor, the other left at the default, so the
        // pool immediately contains two swaps priced differently.
        address[] memory who = new address[](1);
        uint8[] memory tiers = new uint8[](1);
        who[0] = address(botRouter);
        tiers[0] = 3;
        oracle.setTiers(who, tiers);

        PoolSwapTest.TestSettings memory settings =
            PoolSwapTest.TestSettings({takeClaims: false, settleUsingBurn: false});
        SwapParams memory p = SwapParams({zeroForOne: true, amountSpecified: -1e15, sqrtPriceLimitX96: MIN_LIMIT});

        botRouter.swap(key, p, settings, "");
        retailRouter.swap(key, p, settings, "");

        vm.stopBroadcast();

        console.log("RECEIVER=%s", address(receiver));
        console.log("TOKEN0=%s", address(t0));
        console.log("TOKEN1=%s", address(t1));
        console.log("BOT_ROUTER=%s", address(botRouter));
        console.log("RETAIL_ROUTER=%s", address(retailRouter));
    }
}

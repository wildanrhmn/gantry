// SPDX-License-Identifier: MIT
pragma solidity ^0.8.26;

import {Script, console} from "forge-std/Script.sol";
import {HookMiner} from "@uniswap/v4-periphery/test/shared/HookMiner.sol";
import {PoolManager} from "@uniswap/v4-core/src/PoolManager.sol";
import {IPoolManager} from "@uniswap/v4-core/src/interfaces/IPoolManager.sol";
import {PoolSwapTest} from "@uniswap/v4-core/src/test/PoolSwapTest.sol";
import {PoolModifyLiquidityTest} from "@uniswap/v4-core/src/test/PoolModifyLiquidityTest.sol";
import {MockERC20} from "@uniswap/v4-core/lib/solmate/src/test/utils/mocks/MockERC20.sol";
import {Hooks} from "@uniswap/v4-core/src/libraries/Hooks.sol";
import {IHooks} from "@uniswap/v4-core/src/interfaces/IHooks.sol";
import {PoolKey} from "@uniswap/v4-core/src/types/PoolKey.sol";
import {Currency} from "@uniswap/v4-core/src/types/Currency.sol";
import {LPFeeLibrary} from "@uniswap/v4-core/src/libraries/LPFeeLibrary.sol";
import {ModifyLiquidityParams} from "@uniswap/v4-core/src/types/PoolOperation.sol";

import {Gantry} from "../src/Gantry.sol";
import {TierOracle} from "../src/TierOracle.sol";
import {ITierOracle} from "../src/interfaces/ITierOracle.sol";

/// Stands up a full local venue: manager, oracle, mined hook, a dynamic-fee pool and
/// two independent routers so the hook can tell two callers apart.
contract Setup is Script {
    address constant CREATE2_DEPLOYER = 0x4e59b44847b379578588920cA78FbF26c0B4956C;
    uint160 constant SQRT_PRICE_1_1 = 79228162514264337593543950336;

    function run() external {
        uint256 pk = vm.envUint("PRIVATE_KEY");
        address me = vm.addr(pk);

        vm.startBroadcast(pk);

        PoolManager manager = new PoolManager(me);
        TierOracle oracle = new TierOracle(me);

        uint24[4] memory fees = [uint24(500), 3_000, 6_000, 10_000];
        bytes memory args = abi.encode(IPoolManager(address(manager)), ITierOracle(address(oracle)), fees);
        (, bytes32 salt) =
            HookMiner.find(CREATE2_DEPLOYER, uint160(Hooks.BEFORE_SWAP_FLAG), type(Gantry).creationCode, args);
        Gantry gantry = new Gantry{salt: salt}(IPoolManager(address(manager)), ITierOracle(address(oracle)), fees);

        MockERC20 tokenA = new MockERC20("Token A", "A", 18);
        MockERC20 tokenB = new MockERC20("Token B", "B", 18);
        (MockERC20 token0, MockERC20 token1) =
            address(tokenA) < address(tokenB) ? (tokenA, tokenB) : (tokenB, tokenA);
        token0.mint(me, 1_000_000 ether);
        token1.mint(me, 1_000_000 ether);

        PoolModifyLiquidityTest lpRouter = new PoolModifyLiquidityTest(IPoolManager(address(manager)));
        PoolSwapTest botRouter = new PoolSwapTest(IPoolManager(address(manager)));
        PoolSwapTest retailRouter = new PoolSwapTest(IPoolManager(address(manager)));

        token0.approve(address(lpRouter), type(uint256).max);
        token1.approve(address(lpRouter), type(uint256).max);
        token0.approve(address(botRouter), type(uint256).max);
        token1.approve(address(botRouter), type(uint256).max);
        token0.approve(address(retailRouter), type(uint256).max);
        token1.approve(address(retailRouter), type(uint256).max);

        PoolKey memory key = PoolKey({
            currency0: Currency.wrap(address(token0)),
            currency1: Currency.wrap(address(token1)),
            fee: LPFeeLibrary.DYNAMIC_FEE_FLAG,
            tickSpacing: 60,
            hooks: IHooks(address(gantry))
        });

        manager.initialize(key, SQRT_PRICE_1_1);
        lpRouter.modifyLiquidity(
            key,
            ModifyLiquidityParams({tickLower: -600, tickUpper: 600, liquidityDelta: 100 ether, salt: bytes32(0)}),
            ""
        );

        vm.stopBroadcast();

        console.log("MANAGER=%s", address(manager));
        console.log("ORACLE=%s", address(oracle));
        console.log("GANTRY=%s", address(gantry));
        console.log("TOKEN0=%s", address(token0));
        console.log("TOKEN1=%s", address(token1));
        console.log("BOT_ROUTER=%s", address(botRouter));
        console.log("RETAIL_ROUTER=%s", address(retailRouter));
    }
}

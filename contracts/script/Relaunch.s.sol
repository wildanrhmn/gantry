// SPDX-License-Identifier: MIT
pragma solidity ^0.8.26;

import {Script, console} from "forge-std/Script.sol";
import {HookMiner} from "@uniswap/v4-periphery/test/shared/HookMiner.sol";
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

/// Relaunches the hook with EIP-712 attestations and opens a pool anyone can trade.
/// Tokens mint freely so a visitor can get some and swap without asking for anything.
contract Relaunch is Script {
    address constant CREATE2_DEPLOYER = 0x4e59b44847b379578588920cA78FbF26c0B4956C;
    uint160 constant SQRT_PRICE_1_1 = 79228162514264337593543950336;

    function run() external {
        uint256 pk = vm.envUint("PRIVATE_KEY");
        address me = vm.addr(pk);
        IPoolManager manager = IPoolManager(vm.envAddress("POOL_MANAGER"));
        TierOracle oracle = TierOracle(vm.envAddress("ORACLE"));

        uint24[4] memory fees = [uint24(500), 3_000, 6_000, 10_000];
        bytes memory args = abi.encode(manager, ITierOracle(address(oracle)), fees);
        (, bytes32 salt) =
            HookMiner.find(CREATE2_DEPLOYER, uint160(Hooks.BEFORE_SWAP_FLAG), type(Gantry).creationCode, args);

        vm.startBroadcast(pk);

        Gantry gantry = new Gantry{salt: salt}(manager, ITierOracle(address(oracle)), fees);

        MockERC20 a = new MockERC20("Gantry USD", "gUSD", 18);
        MockERC20 b = new MockERC20("Gantry ETH", "gETH", 18);
        (MockERC20 t0, MockERC20 t1) = address(a) < address(b) ? (a, b) : (b, a);
        t0.mint(me, 100_000 ether);
        t1.mint(me, 100_000 ether);

        PoolModifyLiquidityTest lp = new PoolModifyLiquidityTest(manager);
        PoolSwapTest router = new PoolSwapTest(manager);

        t0.approve(address(lp), type(uint256).max);
        t1.approve(address(lp), type(uint256).max);

        PoolKey memory key = PoolKey({
            currency0: Currency.wrap(address(t0)),
            currency1: Currency.wrap(address(t1)),
            fee: LPFeeLibrary.DYNAMIC_FEE_FLAG,
            tickSpacing: 60,
            hooks: IHooks(address(gantry))
        });

        manager.initialize(key, SQRT_PRICE_1_1);
        lp.modifyLiquidity(
            key,
            ModifyLiquidityParams({tickLower: -6000, tickUpper: 6000, liquidityDelta: 2_000 ether, salt: bytes32(0)}),
            ""
        );

        vm.stopBroadcast();

        console.log("GANTRY=%s", address(gantry));
        console.log("TOKEN0=%s", address(t0));
        console.log("TOKEN1=%s", address(t1));
        console.log("ROUTER=%s", address(router));
    }
}

// SPDX-License-Identifier: MIT
pragma solidity ^0.8.26;

import {Script, console} from "forge-std/Script.sol";
import {HookMiner} from "@uniswap/v4-periphery/test/shared/HookMiner.sol";
import {PoolManager} from "@uniswap/v4-core/src/PoolManager.sol";
import {IPoolManager} from "@uniswap/v4-core/src/interfaces/IPoolManager.sol";
import {Hooks} from "@uniswap/v4-core/src/libraries/Hooks.sol";

import {Gantry} from "../src/Gantry.sol";
import {TierOracle} from "../src/TierOracle.sol";
import {ITierOracle} from "../src/interfaces/ITierOracle.sol";

contract Deploy is Script {
    address constant CREATE2_DEPLOYER = 0x4e59b44847b379578588920cA78FbF26c0B4956C;

    function run() external {
        uint256 pk = vm.envUint("PRIVATE_KEY");
        address me = vm.addr(pk);

        // Live networks already have a canonical v4 PoolManager; only spin up a local one when none is given.
        address existing = vm.envOr("POOL_MANAGER", address(0));

        vm.startBroadcast(pk);

        IPoolManager manager = existing == address(0) ? IPoolManager(address(new PoolManager(me))) : IPoolManager(existing);
        TierOracle oracle = new TierOracle(me);

        uint24[4] memory fees = [uint24(500), 3_000, 6_000, 10_000];
        bytes memory args = abi.encode(manager, ITierOracle(address(oracle)), fees);

        // The permission bits live in the hook's own address, so the salt has to be mined before deploying.
        (address predicted, bytes32 salt) =
            HookMiner.find(CREATE2_DEPLOYER, uint160(Hooks.BEFORE_SWAP_FLAG), type(Gantry).creationCode, args);

        Gantry gantry = new Gantry{salt: salt}(manager, ITierOracle(address(oracle)), fees);
        require(address(gantry) == predicted, "hook address mismatch");

        vm.stopBroadcast();

        console.log("PoolManager", address(manager));
        console.log("TierOracle ", address(oracle));
        console.log("Gantry     ", address(gantry));
    }
}

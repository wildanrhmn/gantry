// SPDX-License-Identifier: MIT
pragma solidity ^0.8.26;

import {Script, console} from "forge-std/Script.sol";
import {TierOracle} from "../src/TierOracle.sol";
import {TierReportReceiver} from "../src/TierReportReceiver.sol";

/// Deploys the oracle plus the report receiver and hands tier writing to it.
contract DeployReceiver is Script {
    function run() external {
        uint256 pk = vm.envUint("PRIVATE_KEY");
        address forwarder = vm.envAddress("CRE_FORWARDER");
        address workflowOwner = vm.envAddress("CRE_WORKFLOW_OWNER");
        bytes10 workflowName = bytes10(bytes(vm.envString("CRE_WORKFLOW_NAME")));

        vm.startBroadcast(pk);
        TierOracle oracle = new TierOracle(vm.addr(pk));
        TierReportReceiver receiver = new TierReportReceiver(oracle, forwarder, workflowOwner, workflowName);
        oracle.setWriter(address(receiver));
        vm.stopBroadcast();

        console.log("ORACLE=%s", address(oracle));
        console.log("RECEIVER=%s", address(receiver));
    }
}

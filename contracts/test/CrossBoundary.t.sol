// SPDX-License-Identifier: MIT
pragma solidity ^0.8.26;

import {Test} from "forge-std/Test.sol";
import {TierOracle} from "../src/TierOracle.sol";
import {TierReportReceiver} from "../src/TierReportReceiver.sol";

/// The workflow encodes reports in TypeScript and this contract decodes them in
/// Solidity. Nothing else checks that those two agree, so this feeds the exact bytes
/// the workflow produced straight into the receiver.
contract CrossBoundaryTest is Test {
    TierOracle internal oracle;
    TierReportReceiver internal receiver;

    address internal forwarder = address(0xF0);
    address internal workflowOwner = address(0x0E);
    bytes10 internal workflowName = bytes10("gantry");

    // Produced by cre/gantry-scoring/scoring.ts encodeTierReport() for
    // 0x9205a569... tier 3, 0x76f30e3f... tier 2, 0xaaf4b27e... tier 0.
    bytes internal constant WORKFLOW_PAYLOAD = hex"000000000000000000000000000000000000000000000000000000000000004000000000000000000000000000000000000000000000000000000000000000c000000000000000000000000000000000000000000000000000000000000000030000000000000000000000009205a569b0ff45df1e4f5ae48e21bc7f0656f0bb00000000000000000000000076f30e3f75437fb862b8d2c4d80a671bceba5b1a000000000000000000000000aaf4b27e0d0f0f0f0f0f0f0f0f0f0f0f0f0f0f0f0000000000000000000000000000000000000000000000000000000000000003000000000000000000000000000000000000000000000000000000000000000300000000000000000000000000000000000000000000000000000000000000020000000000000000000000000000000000000000000000000000000000000000";

    function setUp() public {
        oracle = new TierOracle(address(this));
        receiver = new TierReportReceiver(oracle, forwarder, workflowOwner, workflowName);
        oracle.setWriter(address(receiver));
    }

    function test_receiverDecodesWhatTheWorkflowEncoded() public {
        bytes memory metadata = abi.encodePacked(bytes32(uint256(1)), workflowName, workflowOwner);

        vm.prank(forwarder);
        receiver.onReport(metadata, WORKFLOW_PAYLOAD);

        assertEq(oracle.tierOf(0x9205A569B0ff45dF1E4f5ae48E21bC7F0656f0BB), 3, "extractor");
        assertEq(oracle.tierOf(0x76f30e3f75437fB862B8D2C4D80a671bCeBA5b1A), 2, "suspected");
        assertEq(oracle.tierOf(0xAaF4B27e0D0f0f0f0F0f0f0F0F0F0F0f0f0f0F0F), 0, "clean");
    }

    function test_addressesNotInTheReportKeepTheDefault() public {
        bytes memory metadata = abi.encodePacked(bytes32(uint256(1)), workflowName, workflowOwner);

        vm.prank(forwarder);
        receiver.onReport(metadata, WORKFLOW_PAYLOAD);

        assertEq(oracle.tierOf(address(0xDEAD)), oracle.TIER_UNKNOWN());
    }
}

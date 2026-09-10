// SPDX-License-Identifier: MIT
pragma solidity ^0.8.26;

import {Test} from "forge-std/Test.sol";
import {TierOracle} from "../src/TierOracle.sol";
import {TierReportReceiver} from "../src/TierReportReceiver.sol";

contract TierReportReceiverTest is Test {
    TierOracle internal oracle;
    TierReportReceiver internal receiver;

    address internal forwarder = address(0xF0);
    address internal owner = address(0x0E);
    bytes10 internal name = bytes10("gantry");

    address internal bot = address(0xB0);
    address internal router = address(0xA0);

    function setUp() public {
        oracle = new TierOracle(address(this));
        receiver = new TierReportReceiver(oracle, forwarder, owner, name);
        oracle.setWriter(address(receiver));
    }

    function _metadata(bytes10 name_, address owner_) private pure returns (bytes memory) {
        return abi.encodePacked(bytes32(uint256(1)), name_, owner_);
    }

    function _report(address account, uint8 tier) private pure returns (bytes memory) {
        address[] memory accounts = new address[](1);
        uint8[] memory tiers = new uint8[](1);
        accounts[0] = account;
        tiers[0] = tier;
        return abi.encode(accounts, tiers);
    }

    function test_writesTiersFromASignedReport() public {
        uint8 extractor = oracle.TIER_EXTRACTOR();
        bytes memory report = _report(bot, extractor);

        vm.prank(forwarder);
        receiver.onReport(_metadata(name, owner), report);
        assertEq(oracle.tierOf(bot), extractor);
    }

    function test_rejectsAnyoneButTheForwarder() public {
        vm.expectRevert(abi.encodeWithSelector(TierReportReceiver.InvalidSender.selector, address(this)));
        receiver.onReport(_metadata(name, owner), _report(bot, 3));
    }

    function test_rejectsAnotherOwnersWorkflow() public {
        vm.prank(forwarder);
        vm.expectRevert(abi.encodeWithSelector(TierReportReceiver.InvalidAuthor.selector, address(0xBAD)));
        receiver.onReport(_metadata(name, address(0xBAD)), _report(bot, 3));
    }

    function test_rejectsAnotherWorkflowName() public {
        vm.prank(forwarder);
        vm.expectRevert(abi.encodeWithSelector(TierReportReceiver.InvalidWorkflowName.selector, bytes10("other")));
        receiver.onReport(_metadata(bytes10("other"), owner), _report(bot, 3));
    }

    /// Charging a router charges every trader behind it, so the oracle refuses to.
    function test_sharedAddressesCannotBePricedPunitively() public {
        uint8 extractor = oracle.TIER_EXTRACTOR();
        uint8 unknown = oracle.TIER_UNKNOWN();
        oracle.setShared(router, true);
        bytes memory report = _report(router, extractor);

        vm.prank(forwarder);
        receiver.onReport(_metadata(name, owner), report);

        assertEq(oracle.tierOf(router), unknown, "a router must stay neutral");
    }

    function test_markingSharedDemotesAnExistingPunitiveTier() public {
        uint8 extractor = oracle.TIER_EXTRACTOR();
        uint8 unknown = oracle.TIER_UNKNOWN();
        bytes memory report = _report(router, extractor);

        vm.prank(forwarder);
        receiver.onReport(_metadata(name, owner), report);
        assertEq(oracle.tierOf(router), extractor);

        oracle.setShared(router, true);
        assertEq(oracle.tierOf(router), unknown, "demoted once recognised as shared");
    }

    /// Handing tier writing to a workflow must not hand over who is protected from it.
    function test_adminKeepsTheSharedListAfterHandingOverWriting() public {
        assertEq(oracle.writer(), address(receiver));
        assertEq(oracle.admin(), address(this));

        oracle.setShared(router, true);
        assertTrue(oracle.shared(router));
    }
}

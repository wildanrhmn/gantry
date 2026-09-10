// SPDX-License-Identifier: MIT
pragma solidity ^0.8.26;

import {TierOracle} from "./TierOracle.sol";

/// @notice Accepts DON-signed tier reports from a CRE workflow and writes them to the oracle.
/// The workflow itself is public; the thresholds it applies are held as secrets inside the
/// enclave, so what reaches this contract is a verdict rather than a rule.
contract TierReportReceiver {
    TierOracle public immutable oracle;
    address public immutable forwarder;
    address public immutable workflowOwner;
    bytes10 public immutable workflowName;

    event TiersReported(uint256 count, bytes32 workflowId);

    error InvalidSender(address received);
    error InvalidAuthor(address received);
    error InvalidWorkflowName(bytes10 received);
    error LengthMismatch();

    constructor(TierOracle oracle_, address forwarder_, address workflowOwner_, bytes10 workflowName_) {
        oracle = oracle_;
        forwarder = forwarder_;
        workflowOwner = workflowOwner_;
        workflowName = workflowName_;
    }

    function onReport(bytes calldata metadata, bytes calldata report) external {
        if (msg.sender != forwarder) revert InvalidSender(msg.sender);

        (bytes32 workflowId, bytes10 name, address owner) = _decodeMetadata(metadata);
        // Names are only unique per owner, so the owner check has to come first.
        if (owner != workflowOwner) revert InvalidAuthor(owner);
        if (name != workflowName) revert InvalidWorkflowName(name);

        (address[] memory accounts, uint8[] memory tiers) = abi.decode(report, (address[], uint8[]));
        if (accounts.length != tiers.length) revert LengthMismatch();

        oracle.setTiers(accounts, tiers);
        emit TiersReported(accounts.length, workflowId);
    }

    function supportsInterface(bytes4 interfaceId) external pure returns (bool) {
        return interfaceId == this.onReport.selector;
    }

    /// @dev Forwarder packs metadata: 32 bytes workflowId, 10 bytes name, 20 bytes owner.
    function _decodeMetadata(bytes memory metadata)
        internal
        pure
        returns (bytes32 workflowId, bytes10 workflowName_, address workflowOwner_)
    {
        assembly {
            workflowId := mload(add(metadata, 32))
            workflowName_ := mload(add(metadata, 64))
            workflowOwner_ := shr(mul(12, 8), mload(add(metadata, 74)))
        }
    }
}

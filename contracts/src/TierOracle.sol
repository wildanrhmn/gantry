// SPDX-License-Identifier: MIT
pragma solidity ^0.8.26;

import {ITierOracle} from "./interfaces/ITierOracle.sol";

/// @notice Behaviour tiers for addresses trading against a Gantry pool.
/// Tiers are produced off-chain and written here in batches, so the swap path
/// only ever performs a single storage read.
contract TierOracle is ITierOracle {
    uint8 public constant TIER_CLEAN = 0;
    uint8 public constant TIER_UNKNOWN = 1;
    uint8 public constant TIER_SUSPECTED = 2;
    uint8 public constant TIER_EXTRACTOR = 3;

    /// @dev Stored as tier+1 so an empty slot means "never scored" without a second lookup.
    mapping(address => uint8) private _stored;

    address public writer;

    event TierSet(address indexed account, uint8 tier);
    event WriterSet(address indexed writer);

    error NotWriter();
    error BadTier();
    error LengthMismatch();
    error ZeroAddress();

    constructor(address writer_) {
        if (writer_ == address(0)) revert ZeroAddress();
        writer = writer_;
        emit WriterSet(writer_);
    }

    modifier onlyWriter() {
        if (msg.sender != writer) revert NotWriter();
        _;
    }

    /// @notice An address nobody has scored yet is treated as unknown, never as clean.
    function tierOf(address account) external view override returns (uint8) {
        uint8 s = _stored[account];
        return s == 0 ? TIER_UNKNOWN : s - 1;
    }

    function isScored(address account) external view override returns (bool) {
        return _stored[account] != 0;
    }

    function setTier(address account, uint8 tier) external onlyWriter {
        _set(account, tier);
    }

    function setTiers(address[] calldata accounts, uint8[] calldata tiers) external onlyWriter {
        if (accounts.length != tiers.length) revert LengthMismatch();
        for (uint256 i; i < accounts.length; ++i) {
            _set(accounts[i], tiers[i]);
        }
    }

    function setWriter(address writer_) external onlyWriter {
        if (writer_ == address(0)) revert ZeroAddress();
        writer = writer_;
        emit WriterSet(writer_);
    }

    function _set(address account, uint8 tier) private {
        if (tier > TIER_EXTRACTOR) revert BadTier();
        _stored[account] = tier + 1;
        emit TierSet(account, tier);
    }
}

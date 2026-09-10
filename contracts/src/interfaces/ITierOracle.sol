// SPDX-License-Identifier: MIT
pragma solidity ^0.8.26;

interface ITierOracle {
    function tierOf(address account) external view returns (uint8);
    function isScored(address account) external view returns (bool);
}

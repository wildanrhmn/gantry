// SPDX-License-Identifier: MIT
pragma solidity ^0.8.26;

import {Script, console} from "forge-std/Script.sol";
import {IPoolManager} from "@uniswap/v4-core/src/interfaces/IPoolManager.sol";
import {PoolSwapTest} from "@uniswap/v4-core/src/test/PoolSwapTest.sol";
import {MockERC20} from "@uniswap/v4-core/lib/solmate/src/test/utils/mocks/MockERC20.sol";
import {IHooks} from "@uniswap/v4-core/src/interfaces/IHooks.sol";
import {PoolKey} from "@uniswap/v4-core/src/types/PoolKey.sol";
import {Currency} from "@uniswap/v4-core/src/types/Currency.sol";
import {LPFeeLibrary} from "@uniswap/v4-core/src/libraries/LPFeeLibrary.sol";
import {SwapParams} from "@uniswap/v4-core/src/types/PoolOperation.sol";
import {TierOracle} from "../src/TierOracle.sol";
import {Gantry} from "../src/Gantry.sol";

/// Charges the same swap twice against the same address, re-scored in between,
/// so the difference on chain is the tier and nothing else.
contract DemoTolls is Script {
    uint160 constant MAX_PRICE_LIMIT = 1461446703485210103287273052203988822378723970341;

    /// Signed for one router, one nonce, once.
    function _attest(uint256 pk, address trader, address sender, PoolKey memory key)
        private
        view
        returns (bytes memory)
    {
        Gantry gantry = Gantry(vm.envAddress("GANTRY"));
        uint256 nonce = gantry.nonces(trader);
        uint256 deadline = block.timestamp + 1 days;
        (uint8 v, bytes32 r, bytes32 s) =
            vm.sign(pk, gantry.attestationDigest(trader, sender, key, nonce, deadline));
        return abi.encode(trader, nonce, deadline, abi.encodePacked(r, s, v));
    }

    function run() external {
        uint256 pk = vm.envUint("PRIVATE_KEY");
        address me = vm.addr(pk);
        TierOracle oracle = TierOracle(vm.envAddress("ORACLE"));
        PoolSwapTest router = PoolSwapTest(vm.envAddress("ROUTER"));

        PoolKey memory key = PoolKey({
            currency0: Currency.wrap(vm.envAddress("TOKEN0")),
            currency1: Currency.wrap(vm.envAddress("TOKEN1")),
            fee: LPFeeLibrary.DYNAMIC_FEE_FLAG,
            tickSpacing: 60,
            hooks: IHooks(vm.envAddress("GANTRY"))
        });

        // token1 is gUSD in this deployment, so selling it is oneForZero.
        SwapParams memory params =
            SwapParams({zeroForOne: false, amountSpecified: -1 ether, sqrtPriceLimitX96: MAX_PRICE_LIMIT});
        PoolSwapTest.TestSettings memory settings =
            PoolSwapTest.TestSettings({takeClaims: false, settleUsingBurn: false});

        vm.startBroadcast(pk);

        MockERC20(vm.envAddress("TOKEN1")).approve(address(router), type(uint256).max);
        oracle.setWriter(me);

        // Priced as an extractor, but only because the attestation makes the hook
        // look past the router at the address that actually signed for the trade.
        oracle.setTier(me, 3);
        router.swap(key, params, settings, _attest(pk, me, address(router), key));

        oracle.setTier(me, 0);
        router.swap(key, params, settings, _attest(pk, me, address(router), key));

        oracle.setWriter(vm.envAddress("RECEIVER"));

        vm.stopBroadcast();
    }
}

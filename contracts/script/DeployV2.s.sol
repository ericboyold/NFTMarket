// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Script, console} from "forge-std/Script.sol";
import {BaseERC20} from "../src/BaseERC20.sol";
import {NFTMarketV2} from "../src/NFTMarketV2.sol";
import {SimpleNFT} from "../src/SimpleNFT.sol";

contract DeployV2Script is Script {
    function run() external {
        uint256 deployerPrivateKey = vm.envUint("PRIVATE_KEY_TEST");

        vm.startBroadcast(deployerPrivateKey);

        // Deploy BaseERC20 token with 1 million initial supply (18 decimals)
        BaseERC20 token = new BaseERC20("Market Token", "MTK", 1_000_000 * 10**18);

        // Deploy SimpleNFT
        SimpleNFT simpleNFT = new SimpleNFT();

        // Deploy NFTMarketV2 with token address
        NFTMarketV2 nftMarketV2 = new NFTMarketV2(address(token));

        vm.stopBroadcast();

        console.log("\n=== Deployment Complete (V2) ===");
        console.log("BaseERC20:", address(token));
        console.log("SimpleNFT:", address(simpleNFT));
        console.log("NFTMarketV2:", address(nftMarketV2));
    }
}

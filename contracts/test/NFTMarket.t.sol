// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Test} from "forge-std/Test.sol";
import {NFTMarket} from "../src/NFTMarket.sol";
import {BaseERC20} from "../src/BaseERC20.sol";
import {SimpleNFT} from "../src/SimpleNFT.sol";

contract NFTMarketTest is Test {
    BaseERC20 internal token;
    SimpleNFT internal nft;
    NFTMarket internal market;

    address internal owner = address(this);
    address internal seller = address(0xA11CE);
    address internal buyer = address(0xB0B);

    uint256 internal tokenId;
    uint256 internal listingId;

    function setUp() public {
        token = new BaseERC20("Market Token", "MTK", 1_000_000 ether);
        nft = new SimpleNFT();
        market = new NFTMarket(address(token));

        // Fund seller with NFT + buyer with ERC20
        vm.startPrank(seller);
        tokenId = nft.mint(seller, "ipfs://0");
        vm.stopPrank();

        token.mint(buyer, 10_000 ether);

        // Approve market to transfer NFT
        vm.startPrank(seller);
        nft.setApprovalForAll(address(market), true);
        vm.stopPrank();
    }

    function list(uint256 price) internal returns (uint256) {
        vm.prank(seller);
        listingId = market.listNFT(address(nft), tokenId, price);
        return listingId;
    }

    function testSetFeeRate() public {
        uint256 oldFee = market.feeRateBps();
        vm.prank(owner);
        market.setFeeRate(100);
        assertEq(market.feeRateBps(), 100);
        assertTrue(oldFee != market.feeRateBps());
    }

    function testSetFeeRateRevertsIfTooHigh() public {
        uint256 tooHigh = market.MAX_FEE_BPS() + 1;
        // sanity check
        assertEq(market.MAX_FEE_BPS(), 1000);
        assertEq(tooHigh, 1001);
        vm.prank(owner);
        vm.expectRevert("Fee too high");
        market.setFeeRate(tooHigh);
    }

    function testListNFTStoresAndIncrements() public {
        uint256 price = 1_000 ether;
        uint256 id = list(price);

        NFTMarket.Listing memory listing = market.getListing(id);
        assertEq(listing.price, price);
        assertTrue(listing.active);
        assertEq(market.listingCounter(), 1);
    }

    function testBuyNFTTransfersAndDeactivates() public {
        uint256 price = 1_000 ether;
        list(price);

        uint256 fee = (price * market.feeRateBps()) / 10_000;
        uint256 sellerAmount = price - fee;

        uint256 sellerBefore = token.balanceOf(seller);
        uint256 ownerBefore = token.balanceOf(owner);
        uint256 buyerBefore = token.balanceOf(buyer);

        vm.startPrank(buyer);
        token.approve(address(market), price);
        market.buyNFT(listingId);
        vm.stopPrank();

        NFTMarket.Listing memory listingAfter = market.getListing(listingId);
        assertEq(listingAfter.active, false);
        assertEq(token.balanceOf(seller), sellerBefore + sellerAmount);
        assertEq(token.balanceOf(owner), ownerBefore + fee);
        assertEq(token.balanceOf(buyer), buyerBefore - price);
        assertEq(nft.ownerOf(tokenId), buyer);
    }

    function testBuyNFTRevertsIfBuyerOwnsNFT() public {
        uint256 price = 1_000 ether;
        list(price);

        // Buyer buys from listing that belongs to seller; make buyer same as seller
        vm.prank(seller);
        token.approve(address(market), price);

        vm.prank(seller);
        vm.expectRevert("Cannot buy own NFT");
        market.buyNFT(listingId);
    }

    function testCancelListingOnlySeller() public {
        uint256 price = 1_000 ether;
        list(price);

        vm.prank(buyer);
        vm.expectRevert("Not the seller");
        market.cancelListing(listingId);

        uint256 sellerBefore = token.balanceOf(seller);
        vm.prank(seller);
        market.cancelListing(listingId);
        NFTMarket.Listing memory listingAfter = market.getListing(listingId);
        assertEq(listingAfter.active, false);
        assertEq(token.balanceOf(seller), sellerBefore); // cancel does not move ERC20
    }

    function testCancelListingRevertsIfInactive() public {
        uint256 price = 1_000 ether;
        list(price);

        // Cancel once
        vm.prank(seller);
        market.cancelListing(listingId);

        vm.prank(seller);
        vm.expectRevert("Listing not active");
        market.cancelListing(listingId);
    }

    function testTokensReceivedCallbackPaysViaTokenContractAndEscrowsToMarket() public {
        uint256 price = 1_000 ether;
        list(price);

        uint256 buyerBefore = token.balanceOf(buyer);
        uint256 sellerBefore = token.balanceOf(seller);
        uint256 ownerBefore = token.balanceOf(owner);
        uint256 marketTokenBefore = token.balanceOf(address(market));

        uint256 fee = (price * market.feeRateBps()) / 10_000;
        uint256 sellerAmount = price - fee;

        vm.startPrank(buyer);
        token.approve(address(market), price); // not needed for callback, but harmless
        bytes memory data = abi.encode(listingId);

        token.transferWithCallback(address(market), price, data);
        vm.stopPrank();

        NFTMarket.Listing memory listingAfter = market.getListing(listingId);
        assertFalse(listingAfter.active);
        assertEq(nft.ownerOf(tokenId), buyer);

        // Escrow is paid out during tokensReceived, so market balance should return back.
        assertEq(token.balanceOf(address(market)), marketTokenBefore);
        assertEq(token.balanceOf(buyer), buyerBefore - price);

        assertEq(token.balanceOf(seller), sellerBefore + sellerAmount);
        assertEq(token.balanceOf(owner), ownerBefore + fee);
    }
}


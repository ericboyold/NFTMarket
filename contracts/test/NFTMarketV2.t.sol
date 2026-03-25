// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Test} from "forge-std/Test.sol";
import {NFTMarketV2} from "../src/NFTMarketV2.sol";
import {BaseERC20} from "../src/BaseERC20.sol";
import {SimpleNFT} from "../src/SimpleNFT.sol";

contract NFTMarketV2Test is Test {
    BaseERC20 internal token;
    SimpleNFT internal nft;
    NFTMarketV2 internal market;

    address internal seller = address(0xA11CE);
    address internal buyer = address(0xB0B);
    address internal bidder1 = address(0xB1D1);
    address internal bidder2 = address(0xB1D2);

    uint256 internal tokenId0;
    uint256 internal tokenId1;
    uint256 internal tokenId2;

    function setUp() public {
        token = new BaseERC20("Mock Token", "MTK", 1_000_000 ether);
        nft = new SimpleNFT();
        market = new NFTMarketV2(address(token));

        token.mint(buyer, 10_000 ether);
        token.mint(bidder1, 10_000 ether);
        token.mint(bidder2, 10_000 ether);

        vm.startPrank(seller);
        tokenId0 = nft.mint(seller, "ipfs://0");
        tokenId1 = nft.mint(seller, "ipfs://1");
        tokenId2 = nft.mint(seller, "ipfs://2");
        nft.setApprovalForAll(address(market), true);
        vm.stopPrank();
    }

    function testUpdateListingPrice() public {
        vm.prank(seller);
        uint256 listingId = market.listNFT(address(nft), tokenId0, 100 ether);

        vm.prank(seller);
        market.updateListingPrice(listingId, 150 ether);

        NFTMarketV2.Listing memory listing = market.getListing(listingId);
        assertEq(listing.price, 150 ether);
        assertTrue(listing.active);
    }

    function testBatchListNFT() public {
        address[] memory nftContracts = new address[](2);
        uint256[] memory tokenIds = new uint256[](2);
        uint256[] memory prices = new uint256[](2);

        nftContracts[0] = address(nft);
        nftContracts[1] = address(nft);
        tokenIds[0] = tokenId0;
        tokenIds[1] = tokenId1;
        prices[0] = 100 ether;
        prices[1] = 200 ether;

        vm.prank(seller);
        uint256[] memory listingIds = market.batchListNFT(nftContracts, tokenIds, prices);

        assertEq(listingIds.length, 2);
        assertEq(market.listingCounter(), 2);

        NFTMarketV2.Listing memory listing0 = market.getListing(listingIds[0]);
        NFTMarketV2.Listing memory listing1 = market.getListing(listingIds[1]);
        assertEq(listing0.price, 100 ether);
        assertEq(listing1.price, 200 ether);
        assertTrue(listing0.active);
        assertTrue(listing1.active);
    }

    function testPlaceBidRefundsPreviousHighestBid() public {
        vm.prank(seller);
        uint256 listingId = market.listNFT(address(nft), tokenId0, 1_000 ether);

        uint256 bidder1Before = token.balanceOf(bidder1);
        uint256 bidder2Before = token.balanceOf(bidder2);

        vm.startPrank(bidder1);
        token.approve(address(market), type(uint256).max);
        market.placeBid(listingId, 300 ether);
        vm.stopPrank();

        assertEq(token.balanceOf(bidder1), bidder1Before - 300 ether);

        vm.startPrank(bidder2);
        token.approve(address(market), type(uint256).max);
        market.placeBid(listingId, 500 ether);
        vm.stopPrank();

        assertEq(token.balanceOf(bidder1), bidder1Before);
        assertEq(token.balanceOf(bidder2), bidder2Before - 500 ether);

        NFTMarketV2.Bid memory bid = market.getHighestBid(listingId);
        assertEq(bid.bidder, bidder2);
        assertEq(bid.amount, 500 ether);
    }

    function testAcceptHighestBid() public {
        vm.prank(seller);
        uint256 listingId = market.listNFT(address(nft), tokenId0, 1_000 ether);

        uint256 sellerBefore = token.balanceOf(seller);
        uint256 ownerBefore = token.balanceOf(address(this));
        uint256 bidderBefore = token.balanceOf(bidder1);

        vm.startPrank(bidder1);
        token.approve(address(market), type(uint256).max);
        market.placeBid(listingId, 1_000 ether);
        vm.stopPrank();

        vm.prank(seller);
        market.acceptHighestBid(listingId);

        uint256 fee = (1_000 ether * market.feeRateBps()) / 10_000;
        uint256 sellerAmount = 1_000 ether - fee;

        assertEq(token.balanceOf(seller), sellerBefore + sellerAmount);
        assertEq(token.balanceOf(address(this)), ownerBefore + fee);
        assertEq(token.balanceOf(bidder1), bidderBefore - 1_000 ether);
        assertEq(token.balanceOf(address(market)), 0);
        assertEq(nft.ownerOf(tokenId0), bidder1);

        NFTMarketV2.Listing memory listing = market.getListing(listingId);
        assertFalse(listing.active);
    }

    function testCancelListingRefundsHighestBid() public {
        vm.prank(seller);
        uint256 listingId = market.listNFT(address(nft), tokenId0, 1_000 ether);

        uint256 bidderBefore = token.balanceOf(bidder1);

        vm.startPrank(bidder1);
        token.approve(address(market), type(uint256).max);
        market.placeBid(listingId, 400 ether);
        vm.stopPrank();

        vm.prank(seller);
        market.cancelListing(listingId);

        assertEq(token.balanceOf(bidder1), bidderBefore);
        NFTMarketV2.Bid memory bid = market.getHighestBid(listingId);
        assertEq(bid.bidder, address(0));
        assertEq(bid.amount, 0);

        NFTMarketV2.Listing memory listing = market.getListing(listingId);
        assertFalse(listing.active);
    }

    function testBuyNftRefundsExistingHighestBid() public {
        vm.prank(seller);
        uint256 listingId = market.listNFT(address(nft), tokenId0, 1_000 ether);

        uint256 bidderBefore = token.balanceOf(bidder1);
        uint256 sellerBefore = token.balanceOf(seller);

        vm.startPrank(bidder1);
        token.approve(address(market), type(uint256).max);
        market.placeBid(listingId, 300 ether);
        vm.stopPrank();

        vm.startPrank(buyer);
        token.approve(address(market), type(uint256).max);
        market.buyNFT(listingId);
        vm.stopPrank();

        uint256 fee = (1_000 ether * market.feeRateBps()) / 10_000;
        uint256 sellerAmount = 1_000 ether - fee;

        assertEq(token.balanceOf(bidder1), bidderBefore);
        assertEq(token.balanceOf(seller), sellerBefore + sellerAmount);
        assertEq(nft.ownerOf(tokenId0), buyer);

        NFTMarketV2.Bid memory bid = market.getHighestBid(listingId);
        assertEq(bid.bidder, address(0));
        assertEq(bid.amount, 0);
    }

    function testRevertUpdateListingPriceByNonSeller() public {
        vm.prank(seller);
        uint256 listingId = market.listNFT(address(nft), tokenId0, 100 ether);

        vm.prank(buyer);
        vm.expectRevert("Not the seller");
        market.updateListingPrice(listingId, 120 ether);
    }

    function testRevertCancelListingByNonSeller() public {
        vm.prank(seller);
        uint256 listingId = market.listNFT(address(nft), tokenId0, 100 ether);

        vm.prank(buyer);
        vm.expectRevert("Not the seller");
        market.cancelListing(listingId);
    }

    function testRevertPlaceBidBySeller() public {
        vm.prank(seller);
        uint256 listingId = market.listNFT(address(nft), tokenId0, 100 ether);

        vm.startPrank(seller);
        token.approve(address(market), type(uint256).max);
        vm.expectRevert("Seller cannot bid");
        market.placeBid(listingId, 10 ether);
        vm.stopPrank();
    }

    function testRevertPlaceBidTooLow() public {
        vm.prank(seller);
        uint256 listingId = market.listNFT(address(nft), tokenId0, 100 ether);

        vm.startPrank(bidder1);
        token.approve(address(market), type(uint256).max);
        market.placeBid(listingId, 50 ether);
        vm.stopPrank();

        vm.startPrank(bidder2);
        token.approve(address(market), type(uint256).max);
        vm.expectRevert("Bid too low");
        market.placeBid(listingId, 50 ether);
        vm.stopPrank();
    }

    function testRevertAcceptHighestBidWithoutBid() public {
        vm.prank(seller);
        uint256 listingId = market.listNFT(address(nft), tokenId0, 100 ether);

        vm.prank(seller);
        vm.expectRevert("No bid");
        market.acceptHighestBid(listingId);
    }

    function testRevertCancelBidByNonBidder() public {
        vm.prank(seller);
        uint256 listingId = market.listNFT(address(nft), tokenId0, 100 ether);

        vm.startPrank(bidder1);
        token.approve(address(market), type(uint256).max);
        market.placeBid(listingId, 80 ether);
        vm.stopPrank();

        vm.prank(bidder2);
        vm.expectRevert("Not bidder");
        market.cancelBid(listingId);
    }
}

// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {IERC721} from "@openzeppelin/contracts/token/ERC721/IERC721.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {ReentrancyGuard} from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";

/**
 * @title NFTMarketV2
 * @notice 使用 ERC20 代币进行交易的 NFT 市场（V2）
 * @dev 在 V1 基础上增加：出价系统、更新价格、批量上架
 */
contract NFTMarketV2 is ReentrancyGuard, Ownable {
    struct Listing {
        address seller;
        address nftContract;
        uint256 tokenId;
        uint256 price; // 标价（ERC20 代币数量）
        bool active;
    }

    struct Bid {
        address bidder;
        uint256 amount;
    }

    // 用于支付的 ERC20 代币
    IERC20 public paymentToken;

    // 挂单 ID -> 挂单信息
    mapping(uint256 => Listing) public listings;
    uint256 public listingCounter;

    // 挂单 ID -> 当前最高出价
    mapping(uint256 => Bid) public highestBids;

    // 市场手续费，单位为基点（1 bps = 0.01%）
    uint256 public feeRateBps;
    uint256 public constant MAX_FEE_BPS = 1000; // 10%
    uint256 public constant DEFAULT_FEE_BPS = 250; // 2.5%

    // 事件
    event NFTListed(uint256 indexed listingId, address indexed seller, address indexed nftContract, uint256 tokenId, uint256 price);
    event NFTPurchased(uint256 indexed listingId, address indexed buyer, address indexed seller, uint256 price);
    event ListingCancelled(uint256 indexed listingId);
    event FeeRateUpdated(uint256 oldFeeRateBps, uint256 newFeeRateBps);
    event ListingPriceUpdated(uint256 indexed listingId, uint256 oldPrice, uint256 newPrice);
    event BidPlaced(uint256 indexed listingId, address indexed bidder, uint256 amount);
    event BidCancelled(uint256 indexed listingId, address indexed bidder, uint256 amount);
    event BidAccepted(uint256 indexed listingId, address indexed seller, address indexed bidder, uint256 amount);

    constructor(address _paymentToken) Ownable(msg.sender) {
        require(_paymentToken != address(0), "Invalid token address");
        paymentToken = IERC20(_paymentToken);
        feeRateBps = DEFAULT_FEE_BPS;
    }

    /**
     * @notice 上架 NFT 出售
     * @param nftContract NFT 合约地址
     * @param tokenId NFT 的 tokenId
     * @param price 标价（ERC20 代币数量）
     * @return listingId 新创建的挂单 ID
     */
    function listNFT(address nftContract, uint256 tokenId, uint256 price) external nonReentrant returns (uint256) {
        return _createListing(nftContract, tokenId, price);
    }

    /**
     * @notice 批量上架 NFT
     * @param nftContracts NFT 合约地址数组
     * @param tokenIds tokenId 数组
     * @param prices 标价数组
     * @return listingIds 创建的挂单 ID 数组
     */
    function batchListNFT(
        address[] calldata nftContracts,
        uint256[] calldata tokenIds,
        uint256[] calldata prices
    ) external nonReentrant returns (uint256[] memory listingIds) {
        uint256 length = nftContracts.length;
        require(length > 0, "Empty batch");
        require(tokenIds.length == length && prices.length == length, "Length mismatch");

        listingIds = new uint256[](length);
        for (uint256 i = 0; i < length; i++) {
            listingIds[i] = _createListing(nftContracts[i], tokenIds[i], prices[i]);
        }
    }

    /**
     * @notice 创建挂单
     * @param nftContract NFT 合约地址
     * @param tokenId NFT 的 tokenId
     * @param price 标价（ERC20 代币数量）
     * @return listingId 新创建的挂单 ID
     */
    function _createListing(address nftContract, uint256 tokenId, uint256 price) internal returns (uint256 listingId) {
        require(price > 0, "Price must be greater than 0");
        require(nftContract != address(0), "Invalid NFT contract");

        IERC721 nft = IERC721(nftContract);
        require(nft.ownerOf(tokenId) == msg.sender, "Not the owner");
        require(
            nft.isApprovedForAll(msg.sender, address(this)) || nft.getApproved(tokenId) == address(this),
            "Market not approved"
        );

        listingId = listingCounter++;
        listings[listingId] = Listing({
            seller: msg.sender,
            nftContract: nftContract,
            tokenId: tokenId,
            price: price,
            active: true
        });

        emit NFTListed(listingId, msg.sender, nftContract, tokenId, price);
    }

    /**
     * @notice 更新挂单价格（仅卖家）
     * @param listingId 挂单 ID
     * @param newPrice 新价格
     */
    function updateListingPrice(uint256 listingId, uint256 newPrice) external {
        Listing storage listing = listings[listingId];
        require(listing.active, "Listing not active");
        require(listing.seller == msg.sender, "Not the seller");
        require(newPrice > 0, "Price must be greater than 0");

        uint256 oldPrice = listing.price;
        listing.price = newPrice;

        emit ListingPriceUpdated(listingId, oldPrice, newPrice);
    }

    /**
     * @notice 更新市场手续费
     * @param newFeeRateBps 新的手续费率（基点）
     */
    function setFeeRate(uint256 newFeeRateBps) external onlyOwner {
        require(newFeeRateBps <= MAX_FEE_BPS, "Fee too high");
        uint256 oldFeeRateBps = feeRateBps;
        feeRateBps = newFeeRateBps;
        emit FeeRateUpdated(oldFeeRateBps, newFeeRateBps);
    }

    /**
     * @notice 使用 ERC20 购买 NFT
     * @param listingId 要购买的挂单 ID
     */
    function buyNFT(uint256 listingId) external nonReentrant {
        Listing storage listing = listings[listingId];
        require(listing.active, "Listing not active");
        require(msg.sender != listing.seller, "Cannot buy own NFT");

        uint256 feeAmount = (listing.price * feeRateBps) / 10000;
        uint256 sellerAmount = listing.price - feeAmount;

        // 标记挂单已结束
        listing.active = false;

        // 先退还当前最高出价，避免资金留在合约中
        _refundHighestBid(listingId);

        // 从买家向卖家与手续费接收方（合约 owner）划转 ERC20
        require(paymentToken.transferFrom(msg.sender, listing.seller, sellerAmount), "Seller payment failed");
        if (feeAmount > 0) {
            require(paymentToken.transferFrom(msg.sender, owner(), feeAmount), "Fee payment failed");
        }

        // 将 NFT 从卖家转给买家
        IERC721(listing.nftContract).safeTransferFrom(listing.seller, msg.sender, listing.tokenId);

        emit NFTPurchased(listingId, msg.sender, listing.seller, listing.price);
    }

    /**
     * @notice 回调函数用于接收代币
     * @dev 实现当代币通过 transferWithCallback 转移时购买
     * @param from 发送代币的地址（买家）
     * @param amount 发送的代币数量
     * @param data 编码的挂单 ID
     * @return bool 成功状态
     */
    function tokensReceived(address from, uint256 amount, bytes calldata data) external nonReentrant returns (bool) {
        require(msg.sender == address(paymentToken), "Invalid token");
        require(data.length == 32, "Invalid data");

        // 从 data 中解码挂单 ID
        uint256 listingId = abi.decode(data, (uint256));

        Listing storage listing = listings[listingId];
        require(listing.active, "Listing not active");
        require(from != listing.seller, "Cannot buy own NFT");
        require(amount == listing.price, "Incorrect amount");

        uint256 feeAmount = (amount * feeRateBps) / 10000;
        uint256 sellerAmount = amount - feeAmount;

        // 将挂单标记为已结束
        listing.active = false;

        // 先退还当前最高出价，避免资金留在合约中
        _refundHighestBid(listingId);

        // 将代币转给卖家和手续费接收方（合约 owner）
        require(paymentToken.transfer(listing.seller, sellerAmount), "Seller payment failed");
        if (feeAmount > 0) {
            require(paymentToken.transfer(owner(), feeAmount), "Fee payment failed");
        }

        // 将 NFT 从卖家转给买家
        IERC721(listing.nftContract).safeTransferFrom(listing.seller, from, listing.tokenId);

        emit NFTPurchased(listingId, from, listing.seller, amount);
        return true;
    }

    /**
     * @notice 对挂单出价（自动托管到合约）
     * @dev 新出价会退还之前最高出价
     * @param listingId 挂单 ID
     * @param amount 出价金额（ERC20）
     */
    function placeBid(uint256 listingId, uint256 amount) external nonReentrant {
        Listing storage listing = listings[listingId];
        require(listing.active, "Listing not active");
        require(msg.sender != listing.seller, "Seller cannot bid");

        Bid memory currentBid = highestBids[listingId];
        require(amount > 0, "Bid must be greater than 0");
        require(amount > currentBid.amount, "Bid too low");

        // 托管新的出价
        require(paymentToken.transferFrom(msg.sender, address(this), amount), "Bid transfer failed");

        // 退还旧出价
        if (currentBid.amount > 0) {
            require(paymentToken.transfer(currentBid.bidder, currentBid.amount), "Refund failed");
        }

        highestBids[listingId] = Bid({bidder: msg.sender, amount: amount});
        emit BidPlaced(listingId, msg.sender, amount);
    }

    /**
     * @notice 卖家接受当前最高出价
     * @param listingId 挂单 ID
     */
    function acceptHighestBid(uint256 listingId) external nonReentrant {
        Listing storage listing = listings[listingId];
        require(listing.active, "Listing not active");
        require(listing.seller == msg.sender, "Not the seller");

        Bid memory currentBid = highestBids[listingId];
        require(currentBid.amount > 0, "No bid");

        // 先结束挂单并清空最高出价，防止重入
        listing.active = false;
        delete highestBids[listingId];

        uint256 feeAmount = (currentBid.amount * feeRateBps) / 10000;
        uint256 sellerAmount = currentBid.amount - feeAmount;

        require(paymentToken.transfer(listing.seller, sellerAmount), "Seller payment failed");
        if (feeAmount > 0) {
            require(paymentToken.transfer(owner(), feeAmount), "Fee payment failed");
        }

        IERC721(listing.nftContract).safeTransferFrom(listing.seller, currentBid.bidder, listing.tokenId);
        emit BidAccepted(listingId, listing.seller, currentBid.bidder, currentBid.amount);
        emit NFTPurchased(listingId, currentBid.bidder, listing.seller, currentBid.amount);
    }

    /**
     * @notice 最高出价人取消当前出价
     * @param listingId 挂单 ID
     */
    function cancelBid(uint256 listingId) external nonReentrant {
        Bid memory currentBid = highestBids[listingId];
        require(currentBid.amount > 0, "No bid");
        require(currentBid.bidder == msg.sender, "Not bidder");

        delete highestBids[listingId];
        require(paymentToken.transfer(msg.sender, currentBid.amount), "Refund failed");
        emit BidCancelled(listingId, msg.sender, currentBid.amount);
    }

    /**
     * @notice 取消上架（仅卖家）
     * @param listingId 要取消的挂单 ID
     */
    function cancelListing(uint256 listingId) external nonReentrant {
        Listing storage listing = listings[listingId];
        require(listing.active, "Listing not active");
        require(listing.seller == msg.sender, "Not the seller");

        listing.active = false;
        _refundHighestBid(listingId);

        emit ListingCancelled(listingId);
    }

    /**
     * @notice 查询挂单详情
     * @param listingId 挂单 ID
     * @return listing 挂单结构体 Listing
     */
    function getListing(uint256 listingId) external view returns (Listing memory listing) {
        return listings[listingId];
    }

    /**
     * @notice 查询当前最高出价
     * @param listingId 挂单 ID
     * @return bid 最高出价结构体 Bid
     */
    function getHighestBid(uint256 listingId) external view returns (Bid memory bid) {
        return highestBids[listingId];
    }

    /**
     * @dev 退还某个挂单的当前最高出价
     */
    function _refundHighestBid(uint256 listingId) internal {
        Bid memory currentBid = highestBids[listingId];
        if (currentBid.amount > 0) {
            delete highestBids[listingId];
            require(paymentToken.transfer(currentBid.bidder, currentBid.amount), "Refund failed");
            emit BidCancelled(listingId, currentBid.bidder, currentBid.amount);
        }
    }
}

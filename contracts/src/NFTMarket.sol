// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {IERC721} from "@openzeppelin/contracts/token/ERC721/IERC721.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {ReentrancyGuard} from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";

/**
 * @title NFTMarket
 * @notice 使用 ERC20 代币进行交易的 NFT 市场
 * @dev 支持常规 buyNFT 与基于回调的购买（tokensReceived）
 */
contract NFTMarket is ReentrancyGuard, Ownable {

    struct Listing {
        address seller;
        address nftContract;
        uint256 tokenId;
        uint256 price;      // 标价（ERC20 代币数量）
        bool active;
    }

    // 用于支付的 ERC20 代币
    IERC20 public paymentToken;

    // 挂单 ID -> 挂单信息
    mapping(uint256 => Listing) public listings;
    uint256 public listingCounter;

    // 市场手续费，单位为基点（1 bps = 0.01%）
    uint256 public feeRateBps;
    uint256 public constant MAX_FEE_BPS = 1000; // 10%
    uint256 public constant DEFAULT_FEE_BPS = 250; // 2.5%

    // 事件
    event NFTListed(uint256 indexed listingId, address indexed seller, address indexed nftContract, uint256 tokenId, uint256 price);

    event NFTPurchased(uint256 indexed listingId, address indexed buyer, address indexed seller, uint256 price);

    event ListingCancelled(uint256 indexed listingId);

    event FeeRateUpdated(uint256 oldFeeRateBps, uint256 newFeeRateBps);

    constructor(address _paymentToken) Ownable(msg.sender) {
        require(_paymentToken != address(0), "Invalid token address");
        paymentToken = IERC20(_paymentToken);
        feeRateBps = DEFAULT_FEE_BPS;
    }

    /**
     * @notice 上架 NFT 出售
     * @param nftContract: NFT 合约地址
     * @param tokenId: NFT 的 tokenId
     * @param price: 标价（ERC20 代币数量）
     * @return listingId: 新创建的挂单 ID
     */
    function listNFT(address nftContract, uint256 tokenId, uint256 price) external nonReentrant returns (uint256) {
        return _createListing(nftContract, tokenId, price);
    }

    /**
     * @notice 创建挂单
     * @param nftContract: NFT 合约地址
     * @param tokenId: NFT 的 tokenId
     * @param price: 标价（ERC20 代币数量）
     * @return listingId: 新创建的挂单 ID
     */
    function _createListing(address nftContract, uint256 tokenId, uint256 price) internal returns (uint256) {
        require(price > 0, "Price must be greater than 0");
        require(nftContract != address(0), "Invalid NFT contract");

        IERC721 nft = IERC721(nftContract);
        require(nft.ownerOf(tokenId) == msg.sender, "Not the owner");
        require(
            nft.isApprovedForAll(msg.sender, address(this)) || nft.getApproved(tokenId) == address(this),
            "Market not approved"
        );

        uint256 listingId = listingCounter++;
        listings[listingId] = Listing({
            seller: msg.sender,
            nftContract: nftContract,
            tokenId: tokenId,
            price: price,
            active: true
        });

        emit NFTListed(listingId, msg.sender, nftContract, tokenId, price);

        return listingId;
    }

    /**
     * @notice 更新市场手续费
     * @param newFeeRateBps: 新的手续费率（基点）
     */
    function setFeeRate(uint256 newFeeRateBps) external onlyOwner {
        require(newFeeRateBps <= MAX_FEE_BPS, "Fee too high");
        uint256 oldFeeRateBps = feeRateBps;
        feeRateBps = newFeeRateBps;
        emit FeeRateUpdated(oldFeeRateBps, newFeeRateBps);
    }

    /**
     * @notice 使用 ERC20 购买 NFT
     * @param listingId: 要购买的挂单 ID
     */
    function buyNFT(uint256 listingId) external nonReentrant {
        Listing storage listing = listings[listingId];
        require(listing.active, "Listing not active");
        require(msg.sender != listing.seller, "Cannot buy own NFT");

        uint256 feeAmount = (listing.price * feeRateBps) / 10000;
        uint256 sellerAmount = listing.price - feeAmount;

        // 标记挂单已结束
        listing.active = false;

        // 从买家向卖家与手续费接收方（合约 owner）划转 ERC20
        require(
            paymentToken.transferFrom(msg.sender, listing.seller, sellerAmount),
            "Seller payment failed"
        );
        if (feeAmount > 0) {
            require(
                paymentToken.transferFrom(msg.sender, owner(), feeAmount),
                "Fee payment failed"
            );
        }

        // 将 NFT 从卖家转给买家
        IERC721(listing.nftContract).safeTransferFrom(
            listing.seller,
            msg.sender,
            listing.tokenId
        );

        emit NFTPurchased(listingId, msg.sender, listing.seller, listing.price);
    }

    /**
     * @notice 回调函数用于接收代币
     * @dev 实现当代币通过 transferWithCallback 转移时购买
     * @param from: 发送代币的地址（买家）
     * @param amount: 发送的代币数量
     * @param data: 编码的挂单 ID
     * @return bool: 成功状态
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

        // 将代币转给卖家和手续费接收方（合约 owner）
        // 如果手续费为 0，则不进行转账
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
     * @notice 取消上架（仅卖家）
     * @param listingId: 要取消的挂单 ID
     */
    function cancelListing(uint256 listingId) external {
        Listing storage listing = listings[listingId];
        require(listing.active, "Listing not active");
        require(listing.seller == msg.sender, "Not the seller");

        listing.active = false;

        emit ListingCancelled(listingId);
    }

    /**
     * @notice 查询挂单详情
     * @param listingId: 挂单 ID
     * @return listing: 挂单结构体 Listing
     */
    function getListing(uint256 listingId) external view returns (Listing memory) {
        return listings[listingId];
    }
}

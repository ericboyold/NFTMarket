// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {ERC721} from "@openzeppelin/contracts/token/ERC721/ERC721.sol";
import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";

/**
 * @title SimpleNFT
 * @notice 简单的NFT合约用于测试市场功能
 */
contract SimpleNFT is ERC721, Ownable {
    uint256 private _tokenIdCounter;

    // Token URI映射
    mapping(uint256 => string) private _tokenURIs;

    constructor() ERC721("Simple NFT", "SNFT") Ownable(msg.sender) {}

    /**
     * @notice 铸造NFT
     * @param to: 接收者地址
     * @param uri: Token URI
     */
    function mint(address to, string memory uri) public returns (uint256) {
        uint256 tokenId = _tokenIdCounter++;
        _mint(to, tokenId);
        _tokenURIs[tokenId] = uri;
        return tokenId;
    }

    /**
     * @notice 获取Token URI
     */
    function tokenURI(uint256 tokenId) public view virtual override returns (string memory) {
        require(ownerOf(tokenId) != address(0), "Token does not exist");
        return _tokenURIs[tokenId];
    }
}

// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {ERC20} from "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";

/**
 * @title ITokenReceiver
 * @notice 接口用于接收代币回调的合约
 */
interface ITokenReceiver {
    function tokensReceived(
        address from,
        uint256 amount,
        bytes calldata data
    ) external returns (bool);
}

/**
 * @title BaseERC20
 * @notice 扩展 ERC20 代币，支持回调功能
 * @dev 实现 transferWithCallback 用于基于钩子的转移
 */
contract BaseERC20 is ERC20, Ownable {

    event TransferWithCallback(
        address indexed from,
        address indexed to,
        uint256 amount,
        bytes data
    );

    constructor(
        string memory name,
        string memory symbol,
        uint256 initialSupply
    ) ERC20(name, symbol) Ownable(msg.sender) {
        _mint(msg.sender, initialSupply);
    }

    /**
     * @notice 转移代币并调用回调函数
     * @dev 如果接收者是合约，则调用 tokensReceived() 钩子
     * @param to: 接收者地址
     * @param amount: 转移的代币数量
     * @param data: 传递给回调函数的额外数据
     * @return bool: 成功状态
     */
    function transferWithCallback(
        address to,
        uint256 amount,
        bytes calldata data
    ) external returns (bool) {
        require(to != address(0), "Transfer to zero address");
        require(balanceOf(msg.sender) >= amount, "Insufficient balance");

        // Perform the transfer
        _transfer(msg.sender, to, amount);

        // If recipient is a contract, call the callback
        if (_isContract(to)) {
            require(
                ITokenReceiver(to).tokensReceived(msg.sender, amount, data),
                "Callback failed"
            );
        }

        emit TransferWithCallback(msg.sender, to, amount, data);

        return true;
    }

    /**
     * @notice 检查一个地址是否是合约
     * @param account: 要检查的地址
     * @return bool: 是否是合约
     */
    function _isContract(address account) internal view returns (bool) {
        uint256 size;
        assembly {
            size := extcodesize(account)
        }
        return size > 0;
    }

    /**
     * @notice 铸造新的代币（仅 owner）
     * @param to: 接收者地址
     * @param amount: 铸造的代币数量
     */
    function mint(address to, uint256 amount) external onlyOwner {
        _mint(to, amount);
    }
}

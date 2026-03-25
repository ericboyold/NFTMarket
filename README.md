项目包含智能合约开发、前端开发和后端API开发的完整流程。

## 项目概述

本项目在Sepolia测试网上部署，包含以下核心功能：

### 智能合约（Foundry）
- **NFTMarket.sol** - 基础版市场合约，支持NFT上架、购买、取消上架
- **NFTMarketV2.sol** - 增强版市场合约，新增出价系统、价格更新、批量上架
- **SimpleNFT.sol** - 示例ERC721合约，用于测试市场功能

### 前端应用（Next.js）
- **NFTMarket页面** - 基础市场功能界面
- **NFTMarket V2页面** - 增强市场功能界面
- **买卖记录页面** - 查看所有交易历史
- 全局钱包连接（RainbowKit）
- 响应式设计（Tailwind CSS）

## 项目结构

```
NFTMarket/
├── contracts/              # Foundry智能合约项目
│   ├── src/               # 合约源代码
│   │   ├── NFTMarket.sol
│   │   ├── NFTMarketV2.sol
│   │   └── SimpleNFT.sol
│   ├── script/            # 部署脚本
│   ├── test/              # 测试文件
│   └── foundry.toml       # Foundry配置
│
├── web/                   # Next.js前端项目
│   ├── app/              # Next.js App Router
│   │   ├── page.tsx      # NFTMarket页面
│   │   ├── v2/           # NFTMarket V2页面
│   │   └── transactions/ # 买卖记录页面
│   ├── components/        # React组件
│   │   ├── Navigation.tsx
│   │   └── Web3Provider.tsx
│   ├── lib/              # 工具函数
│   │   ├── contracts.ts  # 合约地址管理
│   │   └── wagmi.ts      # Wagmi配置
│   └── contracts/        # 合约ABI文件
│
└── README.md             # 本文件
```
## 核心功能说明

### NFTMarket（基础版）

- **上架NFT** - `listNFT(address, uint256, uint256)`
- **购买NFT** - `buyNFT(uint256)`
- **取消上架** - `cancelListing(uint256)`
- **手续费率** - 默认2.5%，可由管理员调整

### NFTMarket V2（增强版）

除了基础功能外，还包括：

- **出价系统** - `placeBid(uint256, uint256)` / `acceptHighestBid(uint256)` / `cancelBid(uint256)`
- **更新价格** - `updateListingPrice(uint256, uint256)`
- **批量上架** - `batchListNFT(address[], uint256[], uint256[])`
- **出价过期机制** - 设置出价有效期

## 贡献指南

欢迎提交Issue和Pull Request！

## 许可证

MIT License

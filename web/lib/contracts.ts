export const CONTRACT_ADDRESSES = {
  // Sepolia Testnet Addresses
  sepolia: {
    BaseERC20: process.env.NEXT_PUBLIC_BASE_ERC20_ADDRESS || '',
    NFTMarket: process.env.NEXT_PUBLIC_NFT_MARKET_ADDRESS || '',
    SimpleNFT: process.env.NEXT_PUBLIC_SIMPLE_NFT_ADDRESS || '',
    NFTMarketV2: process.env.NEXT_PUBLIC_NFT_MARKET_V2_ADDRESS || '',
  },
} as const;

/**
 * Get contract address for current network
 * @param chainId Chain ID
 * @param contractName Contract name
 * @returns Contract address
 */
export function getContractAddress(
  chainId: number,
  contractName: 'BaseERC20' | 'NFTMarket' | 'SimpleNFT' | 'NFTMarketV2'
): string {
  // Sepolia chainId = 11155111
  if (chainId === 11155111) {
    return CONTRACT_ADDRESSES.sepolia[contractName];
  }

  throw new Error(`Unsupported chain ID: ${chainId}`);
}

/**
 * Validate if address is valid
 */
export function isValidAddress(address: string): boolean {
  return /^0x[a-fA-F0-9]{40}$/.test(address);
}

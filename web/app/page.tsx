'use client';

import { useAccount } from 'wagmi';

export default function NFTMarketPage() {
  const { address, isConnected } = useAccount();

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-4xl font-bold text-gray-900 mb-2">NFT Market</h1>
          <p className="text-gray-600">Trade NFTs using ERC20 tokens</p>
        </div>

        {!isConnected ? (
          <div className="bg-white rounded-lg shadow p-8 text-center">
            <p className="text-gray-700 mb-4">Please connect your wallet</p>
            <p className="text-sm text-gray-500">Click the &quot;Connect Wallet&quot; button in the top right corner</p>
          </div>
        ) : (
          <div className="space-y-8">
            {/* List NFT Section */}
            <div className="bg-white rounded-lg shadow p-6">
              <h2 className="text-2xl font-bold text-gray-900 mb-4">List NFT</h2>
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    NFT Contract Address
                  </label>
                  <input
                    type="text"
                    placeholder="0x..."
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Token ID
                  </label>
                  <input
                    type="number"
                    placeholder="0"
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Price (Tokens)
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    placeholder="100"
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  />
                </div>
                <button className="w-full bg-blue-600 hover:bg-blue-700 text-white font-medium py-3 px-4 rounded-lg transition-colors">
                  List NFT
                </button>
              </div>
            </div>

            {/* Market Listings */}
            <div className="bg-white rounded-lg shadow p-6">
              <h2 className="text-2xl font-bold text-gray-900 mb-4">Available NFTs</h2>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {/* Example NFT Card */}
                <div className="border border-gray-200 rounded-lg overflow-hidden hover:shadow-lg transition-shadow">
                  <div className="aspect-square bg-gray-100 flex items-center justify-center">
                    <span className="text-gray-400">NFT Image</span>
                  </div>
                  <div className="p-4">
                    <h3 className="text-lg font-semibold text-gray-900 mb-2">NFT #1</h3>
                    <p className="text-gray-600 text-sm mb-4">Price: 100 MTK</p>
                    <button className="w-full bg-green-600 hover:bg-green-700 text-white font-medium py-2 px-4 rounded-lg transition-colors">
                      Buy NFT
                    </button>
                  </div>
                </div>

                {/* Empty State */}
                <div className="col-span-full text-center py-12">
                  <p className="text-gray-500">No NFTs listed yet</p>
                </div>
              </div>
            </div>

            {/* My Listings */}
            <div className="bg-white rounded-lg shadow p-6">
              <h2 className="text-2xl font-bold text-gray-900 mb-4">My Listings</h2>
              <div className="text-center py-12">
                <p className="text-gray-500">You have no active listings</p>
              </div>
            </div>
          </div>
        )}

        {/* Features Info */}
        <div className="mt-8 bg-blue-50 rounded-lg p-6 border border-blue-100">
          <h3 className="text-xl font-bold text-gray-900 mb-4">How It Works</h3>
          <ul className="space-y-2 text-gray-700">
            <li className="flex items-start">
              <span className="text-blue-600 mr-2">•</span>
              <span><strong>List NFT:</strong> Set a price in ERC20 tokens and list your NFT for sale</span>
            </li>
            <li className="flex items-start">
              <span className="text-blue-600 mr-2">•</span>
              <span><strong>Buy NFT:</strong> Purchase NFTs by transferring ERC20 tokens</span>
            </li>
            <li className="flex items-start">
              <span className="text-blue-600 mr-2">•</span>
              <span><strong>Callback Purchase:</strong> Use transferWithCallback for automatic NFT purchase</span>
            </li>
            <li className="flex items-start">
              <span className="text-blue-600 mr-2">•</span>
              <span><strong>Cancel Listing:</strong> Remove your NFT from the market anytime</span>
            </li>
          </ul>
        </div>
      </div>
    </div>
  );
}

'use client';

import { useAccount, useChainId } from 'wagmi';
import { useMarketEvents } from '@/lib/hooks/useMarketEvents';
import { getContractAddress } from '@/lib/contracts';
import { formatUnits } from 'viem';

export default function TransactionsPage() {
  const { isConnected } = useAccount();
  const chainId = useChainId();
  const marketAddress = getContractAddress(chainId, 'NFTMarketV2');
  const { events, isLoading } = useMarketEvents(marketAddress);

  const formatAddress = (address?: string) => {
    if (!address) return '-';
    return `${address.slice(0, 6)}...${address.slice(-4)}`;
  };

  const formatPrice = (price?: string) => {
    if (!price) return '-';
    return `${formatUnits(BigInt(price), 18)} MTK`;
  };

  const getEventTypeLabel = (type: string) => {
    switch (type) {
      case 'NFTListed':
        return <span className="px-2 py-1 bg-blue-100 text-blue-800 rounded text-xs font-medium">Listed</span>;
      case 'NFTPurchased':
        return <span className="px-2 py-1 bg-green-100 text-green-800 rounded text-xs font-medium">Purchased</span>;
      case 'ListingCancelled':
        return <span className="px-2 py-1 bg-red-100 text-red-800 rounded text-xs font-medium">Cancelled</span>;
      case 'ListingPriceUpdated':
        return <span className="px-2 py-1 bg-amber-100 text-amber-800 rounded text-xs font-medium">Price Updated</span>;
      case 'BidPlaced':
        return <span className="px-2 py-1 bg-purple-100 text-purple-800 rounded text-xs font-medium">Bid Placed</span>;
      case 'BidCancelled':
        return <span className="px-2 py-1 bg-gray-100 text-gray-800 rounded text-xs font-medium">Bid Cancelled</span>;
      case 'BidAccepted':
        return <span className="px-2 py-1 bg-emerald-100 text-emerald-800 rounded text-xs font-medium">Bid Accepted</span>;
      default:
        return type;
    }
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="mb-8">
          <h1 className="text-4xl font-bold text-gray-900 mb-2">Transaction History</h1>
          <p className="text-gray-600">View all NFT trading history on the marketplace</p>
        </div>

        {!isConnected ? (
          <div className="bg-white rounded-lg shadow p-8 text-center">
            <p className="text-gray-700 mb-4">Please connect your wallet</p>
            <p className="text-sm text-gray-500">Click the &quot;Connect Wallet&quot; button in the top right corner</p>
          </div>
        ) : (
          <div className="bg-white rounded-lg shadow p-6">
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-2xl font-bold text-gray-900">Market Events</h2>
              {isLoading && <span className="text-sm text-gray-500">Loading...</span>}
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left">
                <thead>
                  <tr className="border-b border-gray-200">
                    <th className="px-4 py-3 text-gray-700 font-medium">Type</th>
                    <th className="px-4 py-3 text-gray-700 font-medium">Listing ID</th>
                    <th className="px-4 py-3 text-gray-700 font-medium">NFT</th>
                    <th className="px-4 py-3 text-gray-700 font-medium">Price</th>
                    <th className="px-4 py-3 text-gray-700 font-medium">Seller</th>
                    <th className="px-4 py-3 text-gray-700 font-medium">Buyer</th>
                    <th className="px-4 py-3 text-gray-700 font-medium">Transaction</th>
                  </tr>
                </thead>
                <tbody>
                  {events.length === 0 ? (
                    <tr>
                      <td colSpan={7} className="px-4 py-12 text-center text-gray-500">
                        No transactions yet
                      </td>
                    </tr>
                  ) : (
                    events.map((event, index) => (
                      <tr key={index} className="border-b border-gray-100 hover:bg-gray-50">
                        <td className="px-4 py-3">
                          {getEventTypeLabel(event.type)}
                        </td>
                        <td className="px-4 py-3 text-gray-900">
                          #{event.listingId || '-'}
                        </td>
                        <td className="px-4 py-3 text-gray-900">
                          {event.tokenId ? `#${event.tokenId}` : '-'}
                        </td>
                        <td className="px-4 py-3 text-gray-900">
                          {formatPrice(event.price)}
                        </td>
                        <td className="px-4 py-3 text-gray-600 font-mono text-sm">
                          {formatAddress(event.seller)}
                        </td>
                        <td className="px-4 py-3 text-gray-600 font-mono text-sm">
                          {formatAddress(event.buyer)}
                        </td>
                        <td className="px-4 py-3">
                          {event.transactionHash && (
                            <a
                              href={`https://sepolia.etherscan.io/tx/${event.transactionHash}`}
                              className="text-blue-600 hover:text-blue-800 font-mono text-sm"
                              target="_blank"
                              rel="noopener noreferrer"
                            >
                              {formatAddress(event.transactionHash)}
                            </a>
                          )}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>

            <div className="mt-4 text-sm text-gray-500">
              Total events: {events.length}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

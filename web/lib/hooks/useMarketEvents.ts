'use client';

import { useEffect, useState } from 'react';
import { usePublicClient } from 'wagmi';
import { parseAbiItem } from 'viem';

export interface MarketEvent {
  type:
    | 'NFTListed'
    | 'NFTPurchased'
    | 'ListingCancelled'
    | 'ListingPriceUpdated'
    | 'BidPlaced'
    | 'BidCancelled'
    | 'BidAccepted';
  listingId?: string;
  seller?: string;
  buyer?: string;
  bidder?: string;
  nftContract?: string;
  tokenId?: string;
  price?: string;
  blockNumber?: bigint;
  transactionHash?: string;
  timestamp?: number;
}

export function useMarketEvents(marketAddress: string) {
  const [events, setEvents] = useState<MarketEvent[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const publicClient = usePublicClient();

  useEffect(() => {
    if (!publicClient || !marketAddress) return;

    const fetchEvents = async () => {
      try {
        setIsLoading(true);

        // Get current block
        const currentBlock = await publicClient.getBlockNumber();
        const fromBlock = currentBlock - 10000n; // Last ~10000 blocks

        // Fetch NFTListed events
        const listedLogs = await publicClient.getLogs({
          address: marketAddress as `0x${string}`,
          event: parseAbiItem('event NFTListed(uint256 indexed listingId, address indexed seller, address indexed nftContract, uint256 tokenId, uint256 price)'),
          fromBlock,
          toBlock: 'latest',
        });

        // Fetch NFTPurchased events
        const purchasedLogs = await publicClient.getLogs({
          address: marketAddress as `0x${string}`,
          event: parseAbiItem('event NFTPurchased(uint256 indexed listingId, address indexed buyer, address indexed seller, uint256 price)'),
          fromBlock,
          toBlock: 'latest',
        });

        // Fetch ListingCancelled events
        const cancelledLogs = await publicClient.getLogs({
          address: marketAddress as `0x${string}`,
          event: parseAbiItem('event ListingCancelled(uint256 indexed listingId)'),
          fromBlock,
          toBlock: 'latest',
        });

        // Fetch ListingPriceUpdated events (V2)
        const listingPriceUpdatedLogs = await publicClient.getLogs({
          address: marketAddress as `0x${string}`,
          event: parseAbiItem('event ListingPriceUpdated(uint256 indexed listingId, uint256 oldPrice, uint256 newPrice)'),
          fromBlock,
          toBlock: 'latest',
        });

        // Fetch BidPlaced events (V2)
        const bidPlacedLogs = await publicClient.getLogs({
          address: marketAddress as `0x${string}`,
          event: parseAbiItem('event BidPlaced(uint256 indexed listingId, address indexed bidder, uint256 amount)'),
          fromBlock,
          toBlock: 'latest',
        });

        // Fetch BidCancelled events (V2)
        const bidCancelledLogs = await publicClient.getLogs({
          address: marketAddress as `0x${string}`,
          event: parseAbiItem('event BidCancelled(uint256 indexed listingId, address indexed bidder, uint256 amount)'),
          fromBlock,
          toBlock: 'latest',
        });

        // Fetch BidAccepted events (V2)
        const bidAcceptedLogs = await publicClient.getLogs({
          address: marketAddress as `0x${string}`,
          event: parseAbiItem('event BidAccepted(uint256 indexed listingId, address indexed seller, address indexed bidder, uint256 amount)'),
          fromBlock,
          toBlock: 'latest',
        });

        // Process events
        const allEvents: MarketEvent[] = [];

        listedLogs.forEach((log) => {
          allEvents.push({
            type: 'NFTListed',
            listingId: log.args.listingId?.toString(),
            seller: log.args.seller,
            nftContract: log.args.nftContract,
            tokenId: log.args.tokenId?.toString(),
            price: log.args.price?.toString(),
            blockNumber: log.blockNumber,
            transactionHash: log.transactionHash,
          });
        });

        purchasedLogs.forEach((log) => {
          allEvents.push({
            type: 'NFTPurchased',
            listingId: log.args.listingId?.toString(),
            buyer: log.args.buyer,
            seller: log.args.seller,
            price: log.args.price?.toString(),
            blockNumber: log.blockNumber,
            transactionHash: log.transactionHash,
          });
        });

        cancelledLogs.forEach((log) => {
          allEvents.push({
            type: 'ListingCancelled',
            listingId: log.args.listingId?.toString(),
            blockNumber: log.blockNumber,
            transactionHash: log.transactionHash,
          });
        });

        listingPriceUpdatedLogs.forEach((log) => {
          allEvents.push({
            type: 'ListingPriceUpdated',
            listingId: log.args.listingId?.toString(),
            price: log.args.newPrice?.toString(),
            blockNumber: log.blockNumber,
            transactionHash: log.transactionHash,
          });
        });

        bidPlacedLogs.forEach((log) => {
          allEvents.push({
            type: 'BidPlaced',
            listingId: log.args.listingId?.toString(),
            bidder: log.args.bidder,
            price: log.args.amount?.toString(),
            blockNumber: log.blockNumber,
            transactionHash: log.transactionHash,
          });
        });

        bidCancelledLogs.forEach((log) => {
          allEvents.push({
            type: 'BidCancelled',
            listingId: log.args.listingId?.toString(),
            bidder: log.args.bidder,
            price: log.args.amount?.toString(),
            blockNumber: log.blockNumber,
            transactionHash: log.transactionHash,
          });
        });

        bidAcceptedLogs.forEach((log) => {
          allEvents.push({
            type: 'BidAccepted',
            listingId: log.args.listingId?.toString(),
            seller: log.args.seller,
            bidder: log.args.bidder,
            buyer: log.args.bidder,
            price: log.args.amount?.toString(),
            blockNumber: log.blockNumber,
            transactionHash: log.transactionHash,
          });
        });

        // Sort by block number (newest first)
        allEvents.sort((a, b) => Number(b.blockNumber || 0) - Number(a.blockNumber || 0));

        setEvents(allEvents);

        // Log to console
        allEvents.forEach(event => {
          console.log(`[NFT Market Event] ${event.type}:`, event);
        });

      } catch (error) {
        console.error('Error fetching events:', error);
      } finally {
        setIsLoading(false);
      }
    };

    fetchEvents();

    // Refresh events every 30 seconds
    const interval = setInterval(fetchEvents, 30000);

    return () => clearInterval(interval);
  }, [publicClient, marketAddress]);

  return { events, isLoading };
}

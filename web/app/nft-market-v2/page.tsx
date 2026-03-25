'use client';

import { useCallback, useMemo, useState } from 'react';
import {
  useAccount,
  useChainId,
  usePublicClient,
  useReadContract,
  useReadContracts,
  useWriteContract,
} from 'wagmi';
import { formatUnits, isAddress, maxUint256, parseAbi, parseUnits } from 'viem';
import { useQueryClient } from '@tanstack/react-query';
import type { Abi } from 'viem';

import { getContractAddress } from '@/lib/contracts';
import nftMarketV2Abi from '@/contracts/NFTMarketV2.json';
import baseErc20Abi from '@/contracts/BaseERC20.json';

const marketAbi = nftMarketV2Abi as Abi;
const erc20Abi = baseErc20Abi as Abi;
const erc721Abi = parseAbi(['function setApprovalForAll(address operator, bool approved) external']);

const MAX_LISTING_SCAN = 500;
const TOKEN_DECIMALS = 18;

type ListingStruct = {
  seller: `0x${string}`;
  nftContract: `0x${string}`;
  tokenId: bigint;
  price: bigint;
  active: boolean;
};

type BidStruct = {
  bidder: `0x${string}`;
  amount: bigint;
  timestamp: bigint;
};

function normalizeListing(r: any): {
  seller?: `0x${string}`;
  nftContract?: `0x${string}`;
  tokenId?: bigint;
  price?: bigint;
  active?: boolean;
} {
  // viem/wagmi tuple might come back as array or object-with-names
  if (Array.isArray(r)) {
    return {
      seller: r[0] as `0x${string}`,
      nftContract: r[1] as `0x${string}`,
      tokenId: r[2] as bigint,
      price: r[3] as bigint,
      active: r[4] as boolean,
    };
  }
  return {
    seller: r?.seller as `0x${string}`,
    nftContract: r?.nftContract as `0x${string}`,
    tokenId: r?.tokenId as bigint,
    price: r?.price as bigint,
    active: r?.active as boolean,
  };
}

function normalizeBid(r: any): {
  bidder?: `0x${string}`;
  amount?: bigint;
  timestamp?: bigint;
} {
  if (Array.isArray(r)) {
    return {
      bidder: r[0] as `0x${string}`,
      amount: r[1] as bigint,
      timestamp: r[2] as bigint,
    };
  }
  return {
    bidder: r?.bidder as `0x${string}`,
    amount: r?.amount as bigint,
    timestamp: r?.timestamp as bigint,
  };
}

function shortAddr(a: string) {
  if (!a || a.length < 10) return a;
  return `${a.slice(0, 6)}…${a.slice(-4)}`;
}

function parseBatchLines(text: string): {
  nftContracts: `0x${string}`[];
  tokenIds: bigint[];
  pricesWei: bigint[];
} | null {
  const lines = text
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter(Boolean);
  if (lines.length === 0) return null;

  const nftContracts: `0x${string}`[] = [];
  const tokenIds: bigint[] = [];
  const pricesWei: bigint[] = [];

  for (const line of lines) {
    const parts = line.split(',').map((p) => p.trim());
    if (parts.length !== 3) return null;
    const [addr, tid, priceStr] = parts;
    if (!isAddress(addr)) return null;
    const tidNum = Number(tid);
    if (!Number.isInteger(tidNum) || tidNum < 0) return null;
    let wei: bigint;
    try {
      wei = parseUnits(priceStr, TOKEN_DECIMALS);
    } catch {
      return null;
    }
    if (wei <= 0n) return null;
    nftContracts.push(addr);
    tokenIds.push(BigInt(tidNum));
    pricesWei.push(wei);
  }

  return { nftContracts, tokenIds, pricesWei };
}

export default function NFTMarketV2Page() {
  const { address, isConnected } = useAccount();
  const chainId = useChainId();
  const publicClient = usePublicClient();
  const queryClient = useQueryClient();

  const marketAddress = useMemo(() => {
    try {
      return getContractAddress(chainId, 'NFTMarketV2') as `0x${string}`;
    } catch {
      return '' as const;
    }
  }, [chainId]);

  const simpleNftAddress = useMemo(() => {
    try {
      return getContractAddress(chainId, 'SimpleNFT') as `0x${string}`;
    } catch {
      return '' as const;
    }
  }, [chainId]);

  const { data: paymentTokenAddress } = useReadContract({
    address: marketAddress || undefined,
    abi: marketAbi,
    functionName: 'paymentToken',
    query: { enabled: !!marketAddress },
  });

  const { data: listingCounter, refetch: refetchCounter } = useReadContract({
    address: marketAddress || undefined,
    abi: marketAbi,
    functionName: 'listingCounter',
    query: { enabled: !!marketAddress },
  });

  const { data: bidExpirySeconds } = useReadContract({
    address: marketAddress || undefined,
    abi: marketAbi,
    functionName: 'bidExpirySeconds',
    query: { enabled: !!marketAddress },
  });

  const { data: marketOwner } = useReadContract({
    address: marketAddress || undefined,
    abi: marketAbi,
    functionName: 'owner',
    query: { enabled: !!marketAddress },
  });

  const counterNum = listingCounter != null ? Number(listingCounter as bigint) : 0;
  const scanCount = Math.min(counterNum, MAX_LISTING_SCAN);

  const listingReads = useMemo(() => {
    if (!marketAddress || scanCount === 0) return [];
    return Array.from({ length: scanCount }, (_, i) => ({
      address: marketAddress,
      abi: marketAbi,
      functionName: 'getListing' as const,
      args: [BigInt(i)] as const,
    }));
  }, [marketAddress, scanCount]);

  const bidReads = useMemo(() => {
    if (!marketAddress || scanCount === 0) return [];
    return Array.from({ length: scanCount }, (_, i) => ({
      address: marketAddress,
      abi: marketAbi,
      functionName: 'getHighestBid' as const,
      args: [BigInt(i)] as const,
    }));
  }, [marketAddress, scanCount]);

  const { data: listingResults, refetch: refetchListings } = useReadContracts({
    contracts: listingReads,
    query: { enabled: !!marketAddress && listingReads.length > 0 },
  });

  const { data: bidResults, refetch: refetchBids } = useReadContracts({
    contracts: bidReads,
    query: { enabled: !!marketAddress && bidReads.length > 0 },
  });

  const refreshAll = useCallback(async () => {
    await queryClient.invalidateQueries();
    await refetchCounter();
    await refetchListings();
    await refetchBids();
  }, [queryClient, refetchCounter, refetchListings, refetchBids]);

  const { writeContractAsync, isPending: isWritePending } = useWriteContract();

  const [listNft, setListNft] = useState({ contract: '', tokenId: '', price: '' });
  const [batchText, setBatchText] = useState('');
  const [updateForm, setUpdateForm] = useState({ listingId: '', newPrice: '' });
  const [bidInputs, setBidInputs] = useState<Record<string, string>>({});
  const [status, setStatus] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [expiryInput, setExpiryInput] = useState<string>('');

  const listings = useMemo(() => {
    const rows: {
      id: number;
      seller: string;
      nftContract: string;
      tokenId: bigint;
      price: bigint;
      active: boolean;
    }[] = [];
    if (!listingResults) return rows;
    listingResults.forEach((res, i) => {
      if (res.status !== 'success' || res.result == null) return;
      const r = normalizeListing(res.result) as Partial<ListingStruct>;
      if (!r.seller || !r.nftContract || r.tokenId == null || r.price == null) return;
      rows.push({
        id: i,
        seller: r.seller,
        nftContract: r.nftContract,
        tokenId: r.tokenId,
        price: r.price,
        active: !!r.active,
      });
    });
    return rows;
  }, [listingResults]);

  const bidsByListingId = useMemo(() => {
    const map: Record<number, { bidder: string; amount: bigint; timestamp: bigint }> = {};
    if (!bidResults) return map;
    bidResults.forEach((res, i) => {
      if (res.status !== 'success' || res.result == null) return;
      const r = normalizeBid(res.result) as Partial<BidStruct>;
      if (!r.bidder || r.amount == null) return;
      map[i] = { bidder: r.bidder, amount: r.amount, timestamp: (r.timestamp ?? 0n) as bigint };
    });
    return map;
  }, [bidResults]);

  const activeListings = listings.filter((l) => l.active);

  const myListings = useMemo(() => {
    if (!address) return [];
    return activeListings.filter(
      (l) => l.seller.toLowerCase() === address.toLowerCase()
    );
  }, [activeListings, address]);

  const nowSec = BigInt(Math.floor(Date.now() / 1000));
  const bidExpiry = bidExpirySeconds != null ? (bidExpirySeconds as bigint) : 0n;

  const ensureErc20Allowance = async (min: bigint) => {
    if (!address || !paymentTokenAddress || !marketAddress || !publicClient) {
      throw new Error('Missing wallet, token, or network');
    }
    const token = paymentTokenAddress as `0x${string}`;
    const allowance = (await publicClient.readContract({
      address: token,
      abi: erc20Abi,
      functionName: 'allowance',
      args: [address, marketAddress],
    })) as bigint;
    if (allowance >= min) return;
    await writeContractAsync({
      address: token,
      abi: erc20Abi,
      functionName: 'approve',
      args: [marketAddress, maxUint256],
    });
  };

  const handleApproveNft = async (nftContract: `0x${string}`) => {
    if (!marketAddress) return;
    setError(null);
    setStatus('Confirm NFT approval…');
    try {
      await writeContractAsync({
        address: nftContract,
        abi: erc721Abi,
        functionName: 'setApprovalForAll',
        args: [marketAddress, true],
      });
      setStatus('NFT approval confirmed.');
      await refreshAll();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Approval failed');
      setStatus(null);
    }
  };

  const handleListNFT = async () => {
    if (!marketAddress) return;
    setError(null);
    const c = listNft.contract.trim();
    if (!isAddress(c)) {
      setError('Invalid NFT contract address');
      return;
    }
    const tid = Number(listNft.tokenId);
    if (!Number.isInteger(tid) || tid < 0) {
      setError('Invalid token ID');
      return;
    }
    let priceWei: bigint;
    try {
      priceWei = parseUnits(listNft.price.trim() || '0', TOKEN_DECIMALS);
    } catch {
      setError('Invalid price');
      return;
    }
    if (priceWei <= 0n) {
      setError('Price must be greater than 0');
      return;
    }
    setStatus('Confirm listing…');
    try {
      await writeContractAsync({
        address: marketAddress,
        abi: marketAbi,
        functionName: 'listNFT',
        args: [c as `0x${string}`, BigInt(tid), priceWei],
      });
      setStatus('Listed successfully.');
      setListNft((prev) => ({ ...prev, tokenId: '', price: '' }));
      await refreshAll();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'List failed');
      setStatus(null);
    }
  };

  const handleBatchList = async () => {
    if (!marketAddress) return;
    setError(null);
    const parsed = parseBatchLines(batchText);
    if (!parsed) {
      setError('Batch format: one line per item: 0xNFT,tokenId,price (comma-separated)');
      return;
    }
    setStatus('Confirm batch listing…');
    try {
      await writeContractAsync({
        address: marketAddress,
        abi: marketAbi,
        functionName: 'batchListNFT',
        args: [parsed.nftContracts, parsed.tokenIds, parsed.pricesWei],
      });
      setStatus('Batch listing confirmed.');
      setBatchText('');
      await refreshAll();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Batch list failed');
      setStatus(null);
    }
  };

  const handleUpdatePrice = async () => {
    if (!marketAddress) return;
    setError(null);
    const id = Number(updateForm.listingId);
    if (!Number.isInteger(id) || id < 0) {
      setError('Invalid listing ID');
      return;
    }
    let wei: bigint;
    try {
      wei = parseUnits(updateForm.newPrice.trim() || '0', TOKEN_DECIMALS);
    } catch {
      setError('Invalid new price');
      return;
    }
    if (wei <= 0n) {
      setError('Price must be greater than 0');
      return;
    }
    setStatus('Confirm price update…');
    try {
      await writeContractAsync({
        address: marketAddress,
        abi: marketAbi,
        functionName: 'updateListingPrice',
        args: [BigInt(id), wei],
      });
      setStatus('Price updated.');
      await refreshAll();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Update failed');
      setStatus(null);
    }
  };

  const handleBuy = async (listingId: number, price: bigint) => {
    if (!marketAddress) return;
    setError(null);
    setStatus('Confirm purchase…');
    try {
      await ensureErc20Allowance(price);
      await writeContractAsync({
        address: marketAddress,
        abi: marketAbi,
        functionName: 'buyNFT',
        args: [BigInt(listingId)],
      });
      setStatus('Purchase confirmed.');
      await refreshAll();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Buy failed');
      setStatus(null);
    }
  };

  const handlePlaceBid = async (listingId: number) => {
    if (!marketAddress) return;
    setError(null);
    const raw = bidInputs[String(listingId)]?.trim() ?? '';
    let bidWei: bigint;
    try {
      bidWei = parseUnits(raw || '0', TOKEN_DECIMALS);
    } catch {
      setError('Invalid bid amount');
      return;
    }
    if (bidWei <= 0n) {
      setError('Bid must be greater than 0');
      return;
    }
    setStatus('Confirm bid…');
    try {
      await ensureErc20Allowance(bidWei);
      await writeContractAsync({
        address: marketAddress,
        abi: marketAbi,
        functionName: 'placeBid',
        args: [BigInt(listingId), bidWei],
      });
      setStatus('Bid placed.');
      await refreshAll();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Bid failed');
      setStatus(null);
    }
  };

  const handleCancelListing = async (listingId: number) => {
    if (!marketAddress) return;
    setError(null);
    setStatus('Confirm cancel…');
    try {
      await writeContractAsync({
        address: marketAddress,
        abi: marketAbi,
        functionName: 'cancelListing',
        args: [BigInt(listingId)],
      });
      setStatus('Listing cancelled.');
      await refreshAll();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Cancel failed');
      setStatus(null);
    }
  };

  const handleAcceptBid = async (listingId: number) => {
    if (!marketAddress) return;
    setError(null);
    setStatus('Confirm accept bid…');
    try {
      await writeContractAsync({
        address: marketAddress,
        abi: marketAbi,
        functionName: 'acceptHighestBid',
        args: [BigInt(listingId)],
      });
      setStatus('Bid accepted.');
      await refreshAll();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Accept failed');
      setStatus(null);
    }
  };

  const handleCancelBid = async (listingId: number) => {
    if (!marketAddress) return;
    setError(null);
    setStatus('Confirm cancel bid…');
    try {
      await writeContractAsync({
        address: marketAddress,
        abi: marketAbi,
        functionName: 'cancelBid',
        args: [BigInt(listingId)],
      });
      setStatus('Bid cancelled.');
      await refreshAll();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Cancel bid failed');
      setStatus(null);
    }
  };

  const handleSetBidExpiry = async () => {
    if (!marketAddress) return;
    setError(null);
    const next = expiryInput.trim();
    if (!next) {
      setError('Please input expiry seconds');
      return;
    }
    let nextVal: bigint;
    try {
      nextVal = BigInt(next);
    } catch {
      setError('Invalid expiry seconds');
      return;
    }
    if (nextVal <= 0n) {
      setError('Expiry must be > 0');
      return;
    }
    setStatus('Confirm set bid expiry…');
    try {
      await writeContractAsync({
        address: marketAddress,
        abi: marketAbi,
        functionName: 'setBidExpirySeconds',
        args: [nextVal],
      });
      setStatus('Bid expiry updated.');
      setExpiryInput('');
      await refreshAll();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Update failed');
      setStatus(null);
    }
  };

  const fillSimpleNft = () => {
    if (simpleNftAddress) {
      setListNft((p) => ({ ...p, contract: simpleNftAddress }));
    }
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="mb-8">
          <h1 className="text-4xl font-bold text-gray-900 mb-2">NFT Market V2</h1>
          <p className="text-gray-600">
            List, batch list, update price, buy, bid, and accept bids — paid in ERC20 (MTK).
          </p>
          {marketAddress ? (
            <p className="mt-2 text-sm text-gray-500 font-mono">
              Market: {marketAddress}
            </p>
          ) : (
            <p className="mt-2 text-sm text-amber-700">
              Set <code className="bg-amber-50 px-1 rounded">NEXT_PUBLIC_NFT_MARKET_V2_ADDRESS</code> in{' '}
              <code className="bg-amber-50 px-1 rounded">.env.local</code> and switch to Sepolia.
            </p>
          )}
        </div>

        {(status || error) && (
          <div className="mb-4 space-y-1">
            {status && <p className="text-sm text-green-700">{status}</p>}
            {error && <p className="text-sm text-red-600">{error}</p>}
          </div>
        )}

        {!isConnected ? (
          <div className="bg-white rounded-lg shadow p-8 text-center">
            <p className="text-gray-700 mb-4">Please connect your wallet</p>
            <p className="text-sm text-gray-500">
              Use the Connect button in the top right corner
            </p>
          </div>
        ) : !marketAddress ? null : (
          <div className="space-y-8">
            <div className="bg-white rounded-lg shadow p-6">
              <h2 className="text-2xl font-bold text-gray-900 mb-4">List one NFT</h2>
              <p className="text-sm text-gray-600 mb-4">
                Approve the market for your NFT collection first, then list. Same collection only needs approval once.
              </p>
              <div className="space-y-4">
                <div className="flex flex-wrap gap-2">
                  {simpleNftAddress && (
                    <button
                      type="button"
                      onClick={fillSimpleNft}
                      className="px-3 py-1.5 text-sm bg-gray-100 hover:bg-gray-200 rounded-lg"
                    >
                      Use SimpleNFT from env
                    </button>
                  )}
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    NFT contract
                  </label>
                  <input
                    type="text"
                    value={listNft.contract}
                    onChange={(e) => setListNft((p) => ({ ...p, contract: e.target.value }))}
                    placeholder="0x..."
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">Token ID</label>
                    <input
                      type="number"
                      value={listNft.tokenId}
                      onChange={(e) => setListNft((p) => ({ ...p, tokenId: e.target.value }))}
                      placeholder="0"
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Price (tokens)
                    </label>
                    <input
                      type="text"
                      value={listNft.price}
                      onChange={(e) => setListNft((p) => ({ ...p, price: e.target.value }))}
                      placeholder="100"
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </div>
                </div>
                <div className="flex flex-wrap gap-2">
                  <button
                    type="button"
                    disabled={!listNft.contract || !isAddress(listNft.contract.trim()) || isWritePending}
                    onClick={() => handleApproveNft(listNft.contract.trim() as `0x${string}`)}
                    className="px-4 py-2 bg-gray-700 hover:bg-gray-800 text-white rounded-lg text-sm disabled:opacity-50"
                  >
                    Approve NFT for market
                  </button>
                  <button
                    type="button"
                    disabled={isWritePending}
                    onClick={() => void handleListNFT()}
                    className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-sm disabled:opacity-50"
                  >
                    List NFT
                  </button>
                </div>
              </div>
            </div>

            <div className="bg-white rounded-lg shadow p-6">
              <h2 className="text-2xl font-bold text-gray-900 mb-2">Batch list</h2>
              <p className="text-sm text-gray-600 mb-2">
                One line per NFT: <code className="bg-gray-100 px-1 rounded">contract,tokenId,price</code>
              </p>
              <textarea
                value={batchText}
                onChange={(e) => setBatchText(e.target.value)}
                rows={5}
                placeholder={`${simpleNftAddress || '0xYourNFT'},0,10\n${simpleNftAddress || '0xYourNFT'},1,20`}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg font-mono text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
              <button
                type="button"
                disabled={isWritePending}
                onClick={() => void handleBatchList()}
                className="mt-3 w-full sm:w-auto px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg disabled:opacity-50"
              >
                Batch list
              </button>
            </div>

            <div className="bg-white rounded-lg shadow p-6">
              <h2 className="text-2xl font-bold text-gray-900 mb-4">Update listing price</h2>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 items-end">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Listing ID</label>
                  <input
                    type="number"
                    value={updateForm.listingId}
                    onChange={(e) => setUpdateForm((p) => ({ ...p, listingId: e.target.value }))}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">New price</label>
                  <input
                    type="text"
                    value={updateForm.newPrice}
                    onChange={(e) => setUpdateForm((p) => ({ ...p, newPrice: e.target.value }))}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg"
                  />
                </div>
                <button
                  type="button"
                  disabled={isWritePending}
                  onClick={() => void handleUpdatePrice()}
                  className="px-4 py-2 bg-amber-600 hover:bg-amber-700 text-white rounded-lg disabled:opacity-50"
                >
                  Update price
                </button>
              </div>
            </div>

            <div className="bg-white rounded-lg shadow p-6">
              <h2 className="text-2xl font-bold text-gray-900 mb-4">Available listings</h2>
              {counterNum > MAX_LISTING_SCAN && (
                <p className="text-sm text-amber-700 mb-4">
                  Showing first {MAX_LISTING_SCAN} of {counterNum} listing slots (IDs 0–{MAX_LISTING_SCAN - 1}).
                </p>
              )}
              {activeListings.length === 0 ? (
                <p className="text-gray-500 text-center py-8">No active listings</p>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                  {activeListings.map((l) => {
                    const bid = bidsByListingId[l.id];
                    const isSeller =
                      !!address &&
                      !!l.seller &&
                      l.seller.toLowerCase() === address.toLowerCase();
                    const isHighBidder =
                      bid &&
                      !!bid.bidder &&
                      !!address &&
                      bid.bidder.toLowerCase() === address.toLowerCase() &&
                      bid.amount > 0n;
                    const isBidExpired =
                      !!bid &&
                      bid.amount > 0n &&
                      bid.timestamp > 0n &&
                      bidExpiry > 0n &&
                      nowSec >= bid.timestamp + bidExpiry;

                    return (
                      <div
                        key={l.id}
                        className="border border-gray-200 rounded-lg overflow-hidden flex flex-col"
                      >
                        <div className="p-4 flex-1 space-y-2">
                          <h3 className="text-lg font-semibold text-gray-900">Listing #{l.id}</h3>
                          <p className="text-sm text-gray-600">
                            NFT {shortAddr(l.nftContract)} · ID {l.tokenId.toString()}
                          </p>
                          <p className="text-sm text-gray-800">
                            Price: {formatUnits(l.price, TOKEN_DECIMALS)} MTK
                          </p>
                          <p className="text-xs text-gray-500">Seller: {shortAddr(l.seller)}</p>
                          {bid && bid.amount > 0n ? (
                            <p className="text-sm text-purple-800">
                              High bid: {formatUnits(bid.amount, TOKEN_DECIMALS)} MTK (
                              {shortAddr(bid.bidder)})
                              {isBidExpired ? (
                                <span className="ml-2 text-red-700 font-medium">(Expired)</span>
                              ) : (
                                <span className="ml-2 text-amber-700 font-medium">
                                  (Expires in {(bid.timestamp + bidExpiry - nowSec).toString()}s)
                                </span>
                              )}
                            </p>
                          ) : (
                            <p className="text-sm text-gray-500">No bids yet</p>
                          )}
                          <input
                            type="text"
                            placeholder="Bid amount (tokens)"
                            value={bidInputs[String(l.id)] ?? ''}
                            onChange={(e) =>
                              setBidInputs((prev) => ({
                                ...prev,
                                [String(l.id)]: e.target.value,
                              }))
                            }
                            className="w-full px-3 py-2 border border-gray-300 rounded text-sm"
                          />
                        </div>
                        <div className="p-4 border-t border-gray-100 space-y-2 bg-gray-50">
                          {!isSeller && (
                            <>
                              <button
                                type="button"
                                disabled={isWritePending}
                                onClick={() => void handleBuy(l.id, l.price)}
                                className="w-full py-2 bg-green-600 hover:bg-green-700 text-white rounded-lg text-sm disabled:opacity-50"
                              >
                                Buy at list price
                              </button>
                              <button
                                type="button"
                                disabled={isWritePending}
                                onClick={() => void handlePlaceBid(l.id)}
                                className="w-full py-2 bg-purple-600 hover:bg-purple-700 text-white rounded-lg text-sm disabled:opacity-50"
                              >
                                Place bid
                              </button>
                            </>
                          )}
                          {isSeller && (
                            <>
                              <button
                                type="button"
                                disabled={
                                  isWritePending || !bid || bid.amount === 0n || isBidExpired
                                }
                                onClick={() => void handleAcceptBid(l.id)}
                                className="w-full py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-sm disabled:opacity-50"
                              >
                                {isBidExpired ? 'Bid expired' : 'Accept highest bid'}
                              </button>
                              <button
                                type="button"
                                disabled={isWritePending}
                                onClick={() => void handleCancelListing(l.id)}
                                className="w-full py-2 bg-red-600 hover:bg-red-700 text-white rounded-lg text-sm disabled:opacity-50"
                              >
                                Cancel listing
                              </button>
                            </>
                          )}
                          {isHighBidder && (
                            <button
                              type="button"
                              disabled={isWritePending}
                              onClick={() => void handleCancelBid(l.id)}
                              className="w-full py-2 bg-gray-600 hover:bg-gray-700 text-white rounded-lg text-sm disabled:opacity-50"
                            >
                              Withdraw my bid
                            </button>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            <div className="bg-white rounded-lg shadow p-6">
              <h2 className="text-2xl font-bold text-gray-900 mb-4">My active listings</h2>
              {myListings.length === 0 ? (
                <p className="text-gray-500 text-center py-8">You have no active listings</p>
              ) : (
                <ul className="space-y-2 text-sm text-gray-800">
                  {myListings.map((l) => (
                    <li key={l.id} className="flex justify-between border-b border-gray-100 py-2">
                      <span>
                        #{l.id} · NFT {shortAddr(l.nftContract)} #{l.tokenId.toString()}
                      </span>
                      <span>{formatUnits(l.price, TOKEN_DECIMALS)} MTK</span>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>
        )}

        <div className="mt-8 bg-blue-50 rounded-lg p-6 border border-blue-100">
          <h3 className="text-xl font-bold text-gray-900 mb-4">V2 features</h3>
          <ul className="space-y-2 text-gray-700 text-sm">
            <li>• <strong>Bids:</strong> ERC20 is held in escrow until outbid, sale, or you withdraw / listing ends.</li>
            <li>• <strong>Buy:</strong> Approves MTK if needed, then transfers list price + fee.</li>
            <li>• <strong>Batch list:</strong> Multiple NFTs in one transaction (same rules as single list).</li>
            <li>• <strong>Bid expiry:</strong> Seller can not accept an expired bid. Current: {bidExpiry.toString()}s.</li>
          </ul>

          {marketOwner && address && marketOwner.toLowerCase() === address.toLowerCase() && (
            <div className="mt-4 grid grid-cols-1 sm:grid-cols-3 gap-3 items-end">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Set bid expiry seconds
                </label>
                <input
                  type="text"
                  value={expiryInput}
                  onChange={(e) => setExpiryInput(e.target.value)}
                  placeholder="e.g. 86400"
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
              <button
                type="button"
                disabled={isWritePending}
                onClick={() => void handleSetBidExpiry()}
                className="w-full sm:w-auto px-4 py-2 bg-blue-700 hover:bg-blue-800 text-white rounded-lg disabled:opacity-50"
              >
                Update expiry
              </button>
              <div className="text-xs text-gray-500">
                Only contract owner can update.
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

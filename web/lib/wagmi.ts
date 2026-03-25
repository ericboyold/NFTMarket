'use client';

import { http, createConfig } from 'wagmi';
import { sepolia } from 'wagmi/chains';
import { walletConnect, injected, coinbaseWallet } from 'wagmi/connectors';

const projectId = process.env.NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID || '';

export const config = createConfig({
  chains: [sepolia],
  connectors: [
    walletConnect({ projectId, showQrModal: false }),
    injected({ shimDisconnect: true }),
    coinbaseWallet({
      appName: 'NFT Market',
      appLogoUrl: 'https://nftmarket.example.com/logo.png',
    }),
  ],
  transports: {
    [sepolia.id]: http(),
  },
  ssr: true,
});

import type { Metadata } from "next";
import "./globals.css";
import { Web3Provider } from "@/components/Web3Provider";
import { Navigation } from "@/components/Navigation";

export const metadata: Metadata = {
  title: "NFT Market - Web3 DAPP Tutorial",
  description: "Learn how to build an NFT marketplace with ERC20 token payments",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body>
        <Web3Provider>
          <Navigation />
          <main className="min-h-screen">
            {children}
          </main>
        </Web3Provider>
      </body>
    </html>
  );
}

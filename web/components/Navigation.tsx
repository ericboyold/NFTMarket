'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';

const navLinks = [
  { href: '/', label: 'NFT Market' },
  { href: '/nft-market-v2', label: 'NFT Market V2' },
  { href: '/transactions', label: 'Transaction History' },
];

export function Navigation() {
  const pathname = usePathname();

  return (
    <nav className="bg-white border-b border-gray-200 shadow-sm">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between h-16">
          <div className="flex space-x-8">
            {navLinks.map((link) => {
              const isActive = pathname === link.href;
              return (
                <Link
                  key={link.href}
                  href={link.href}
                  className={`inline-flex items-center px-1 pt-1 text-sm font-medium transition-colors ${
                    isActive
                      ? 'text-blue-600 border-b-2 border-blue-600'
                      : 'text-gray-600 hover:text-gray-900 hover:border-b-2 hover:border-gray-300'
                  }`}
                >
                  {link.label}
                </Link>
              );
            })}
          </div>

          <div className="flex items-center">
            <appkit-button />
          </div>
        </div>
      </div>
    </nav>
  );
}

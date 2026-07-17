'use client';

import { useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { motion, AnimatePresence } from 'framer-motion';
import { ConnectButton } from '@rainbow-me/rainbowkit';
import { useAccount } from 'wagmi';

const LINKS = [
  { href: '/', label: 'Home' },
  { href: '/guess', label: 'Guess' },
  { href: '/leaderboard', label: 'Leaderboard' },
];

export function Navbar() {
  const pathname = usePathname();
  const { address, isConnected } = useAccount();
  const [mobileOpen, setMobileOpen] = useState(false);

  return (
    <header className="sticky top-0 z-50 border-b border-gray-800 bg-black/80 backdrop-blur-md">
      <div className="mx-auto flex max-w-5xl items-center justify-between px-4 py-3 sm:px-6 sm:py-4">
        <Link href="/" className="flex items-center gap-2">
          <motion.span
            initial={{ rotate: -20, opacity: 0 }}
            animate={{ rotate: 0, opacity: 1 }}
            transition={{ duration: 0.5 }}
            className="flex h-8 w-8 items-center justify-center rounded-lg border border-green-400/30 bg-green-400/10 font-mono text-sm text-green-400 shadow-[0_0_16px_-4px_rgba(74,222,128,0.4)]"
          >
            ⇄
          </motion.span>
          <span className="font-semibold tracking-tight text-gray-100">Ritual Pulse</span>
        </Link>

        <nav className="hidden items-center gap-1 sm:flex">
          {LINKS.map((link) => {
            const isActive = pathname === link.href;
            return (
              <Link
                key={link.href}
                href={link.href}
                className={`relative rounded-md px-3 py-1.5 text-sm transition ${
                  isActive ? 'text-green-400' : 'text-gray-400 hover:text-gray-200'
                }`}
              >
                {link.label}
                {isActive && <motion.span layoutId="nav-underline" className="absolute inset-x-2 -bottom-1 h-px bg-green-400" />}
              </Link>
            );
          })}
          {isConnected && address && (
            <Link
              href="/profile"
              className="ml-1 rounded-full border border-gray-700 px-3 py-1 font-mono text-xs text-gray-400 transition hover:border-green-400/40 hover:text-green-400"
            >
              Profile
            </Link>
          )}
        </nav>

        <div className="flex items-center gap-2">
          <div className="scale-90 sm:scale-100">
            <ConnectButton showBalance={false} accountStatus="avatar" chainStatus="none" />
          </div>
          <button
            onClick={() => setMobileOpen((v) => !v)}
            className="rounded-md border border-gray-700 p-1.5 text-gray-400 sm:hidden"
            aria-label="Toggle menu"
          >
            {mobileOpen ? '✕' : '☰'}
          </button>
        </div>
      </div>

      <AnimatePresence>
        {mobileOpen && (
          <motion.nav
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            className="overflow-hidden border-t border-gray-800 sm:hidden"
          >
            <div className="flex flex-col gap-1 px-4 py-3">
              {LINKS.map((link) => (
                <Link
                  key={link.href}
                  href={link.href}
                  onClick={() => setMobileOpen(false)}
                  className={`rounded-md px-3 py-2 text-sm ${pathname === link.href ? 'text-green-400' : 'text-gray-400'}`}
                >
                  {link.label}
                </Link>
              ))}
              {isConnected && (
                <Link
                  href="/profile"
                  onClick={() => setMobileOpen(false)}
                  className="rounded-md px-3 py-2 font-mono text-sm text-gray-400"
                >
                  Profile
                </Link>
              )}
            </div>
          </motion.nav>
        )}
      </AnimatePresence>
    </header>
  );
}
'use client';

import Link from 'next/link';

export function Footer() {
  return (
    <footer className="border-t border-gray-800 bg-black px-6 py-10">
      <div className="mx-auto flex max-w-5xl flex-col items-center justify-between gap-4 sm:flex-row">
        <div className="flex items-center gap-2">
          <span className="flex h-7 w-7 items-center justify-center rounded-lg border border-green-400/30 bg-green-400/10 font-mono text-xs text-green-400">
            ⇄
          </span>
          <span className="text-sm text-gray-500">Ritual Pulse, built on Ritual Chain</span>
        </div>
        <div className="flex flex-wrap justify-center gap-4 text-xs text-gray-500 sm:gap-5">
          <Link href="/guess" className="hover:text-gray-300">Guess</Link>
          <Link href="/leaderboard" className="hover:text-gray-300">Leaderboard</Link>
          
           <a href="https://explorer.ritualfoundation.org"
            target="_blank"
            rel="noreferrer"
            className="hover:text-gray-300"
          >
            Explorer ↗
          </a>
        </div>
      </div>
    </footer>
  );
}
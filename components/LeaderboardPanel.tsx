'use client';

import { useEffect, useState } from 'react';
import { usePublicClient } from 'wagmi';
import { fetchLeaderboard, type LeaderboardEntry } from '@/lib/leaderboard';

export function LeaderboardPanel() {
  const publicClient = usePublicClient();
  const [entries, setEntries] = useState<LeaderboardEntry[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!publicClient) return;
    fetchLeaderboard(publicClient)
      .then(setEntries)
      .finally(() => setLoading(false));
  }, [publicClient]);

  return (
    <div className="rounded-xl border border-gray-700 bg-gray-900/60 p-5">
      <p className="text-xs uppercase tracking-wider text-gray-500">Leaderboard</p>
      {loading && <p className="mt-3 text-sm text-gray-500">Loading...</p>}
      {!loading && entries.length === 0 && (
        <p className="mt-3 text-sm text-gray-500">No resolved guesses yet, be the first.</p>
      )}
      <ul className="mt-3 space-y-2">
        {entries.map((e, i) => (
          <li
            key={e.address}
            className="flex items-center justify-between rounded-lg border border-gray-800 bg-black/30 px-3 py-2"
          >
            <span className="font-mono text-xs text-gray-400">
              #{i + 1} {e.address.slice(0, 6)}...{e.address.slice(-4)}
            </span>
            <span className="font-mono text-xs">
              <span className="text-green-400">{e.wins}W</span>
              <span className="text-gray-600"> / </span>
              <span className="text-red-400">{e.losses}L</span>
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}

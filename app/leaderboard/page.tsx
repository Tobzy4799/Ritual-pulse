'use client';

import { motion } from 'framer-motion';
import { LeaderboardPanel } from '@/components/LeaderboardPanel';

export default function LeaderboardPage() {
  return (
    <main className="min-h-screen bg-black px-4 py-10 sm:px-6 sm:py-14">
      <div className="mx-auto max-w-2xl">
        <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5 }}>
          <p className="font-mono text-xs uppercase tracking-wider text-yellow-400">Hall of guesses</p>
          <h1 className="mt-2 text-2xl font-bold text-gray-100">Leaderboard</h1>
          <p className="mt-2 text-sm text-gray-400">
            Ranked by resolved wins across all players. Updates automatically as guesses are resolved
            on-chain — no signature needed to view.
          </p>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.1 }}
          className="mt-6"
        >
          <LeaderboardPanel />
        </motion.div>
      </div>
    </main>
  );
}
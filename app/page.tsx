'use client';

import Link from 'next/link';
import { motion, Variants } from 'framer-motion';
import { useEffect, useState } from 'react';
import { usePublicClient } from 'wagmi';
import { useLivePrice } from '@/lib/useLivePrice';
import { COINS } from '@/lib/coins';
import { fetchGameStats, type GameStats } from '@/lib/gameStats';

const fadeUp: Variants = {
  hidden: { opacity: 0, y: 16 },
  visible: (i: number) => ({
    opacity: 1,
    y: 0,
    transition: { delay: i * 0.08, duration: 0.5, ease: 'easeOut' as const },
  }),
};

export default function HomePage() {
  const { prices } = useLivePrice();
  const publicClient = usePublicClient();
  const [stats, setStats] = useState<GameStats | null>(null);

  useEffect(() => {
    if (!publicClient) return;
    fetchGameStats(publicClient).then(setStats).catch(() => {});
  }, [publicClient]);

  return (
    <main className="min-h-screen bg-black">
      <section className="relative overflow-hidden border-b border-gray-800 px-4 py-16 sm:px-6 sm:py-28">
        <div
          className="pointer-events-none absolute inset-0 opacity-40"
          style={{
            background:
              'radial-gradient(ellipse 60% 50% at 30% 0%, rgba(74,222,128,0.12), transparent), radial-gradient(ellipse 50% 40% at 90% 10%, rgba(248,113,113,0.08), transparent)',
          }}
        />
        <div className="relative mx-auto max-w-3xl text-center">
          <motion.p initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="font-mono text-xs uppercase tracking-[0.2em] text-green-400">
            Built on Ritual Chain · 1979
          </motion.p>
          <motion.h1
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6 }}
            className="mt-4 text-3xl font-bold tracking-tight text-gray-100 sm:text-5xl"
          >
            Prove your read on the market.
          </motion.h1>
          <motion.p
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.1 }}
            className="mx-auto mt-4 max-w-xl text-sm text-gray-400 sm:text-base"
          >
            Ritual Pulse turns live market data that is verified on-chain through Ritual&apos;s
            TEE-secured HTTP precompile into a real, stakeable prediction. Guess up or down,
            wait two hours, find out for real.
          </motion.p>
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.2 }}
            className="mt-8 flex justify-center"
          >
            <Link
              href="/guess"
              className="rounded-lg border border-yellow-400 px-8 py-3 text-sm font-semibold text-yellow-400 transition hover:bg-yellow-400/10"
            >
              Play the guessing game →
            </Link>
          </motion.div>
        </div>
      </section>
{stats && stats.totalGuesses > 0 && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.6, delay: 0.3 }}
          className="border-b border-gray-800 bg-gray-900/40 px-4 py-3 text-center"
        >
          <p className="font-mono text-xs text-gray-400">
            <span className="text-green-400">{stats.totalGuesses}</span> guesses made ·{' '}
            <span className="text-yellow-400">{stats.totalStakedEth.toFixed(3)}</span> RITUAL staked so far
          </p>
        </motion.div>
      )}

      <section className="border-b border-gray-800 px-4 py-10 sm:px-6 sm:py-12">
        <div className="mx-auto max-w-3xl">
          <p className="text-center font-mono text-xs uppercase tracking-wider text-gray-500">Live market snapshot</p>
          <div className="mt-4 grid grid-cols-3 gap-2 sm:gap-4">
            {COINS.map((c, i) => {
              const live = prices[c.id];
              return (
                <motion.div
                  key={c.id}
                  custom={i}
                  initial="hidden"
                  animate="visible"
                  variants={fadeUp}
                  className="rounded-xl border border-gray-700 bg-gray-900/60 p-3 text-center sm:p-4"
                >
                  <p className="text-[10px] uppercase tracking-wider text-gray-500 sm:text-xs">{c.symbol}</p>
                  <p className="mt-1 font-mono text-base text-gray-100 sm:text-xl">
                    {live?.usd ? `$${live.usd.toLocaleString(undefined, { maximumFractionDigits: 2 })}` : '—'}
                  </p>
                  {live?.change24h !== undefined && (
                    <span className={`font-mono text-[10px] sm:text-xs ${live.change24h >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                      {live.change24h >= 0 ? '▲' : '▼'} {Math.abs(live.change24h).toFixed(2)}%
                    </span>
                  )}
                </motion.div>
              );
            })}
          </div>
        </div>
      </section>

      <section className="border-b border-gray-800 px-4 py-14 sm:px-6 sm:py-16">
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.6 }}
          className="mx-auto max-w-2xl text-center"
        >
          <h2 className="text-xl font-bold tracking-tight text-gray-100 sm:text-3xl">
            Anyone can watch a chart. <span className="text-yellow-400">Only a few call it.</span>
          </h2>
          <p className="mt-4 text-sm text-gray-400 sm:text-base">
            Every guess is a real signature, a real stake, and a real answer two hours later, there is no
            simulation, no paper trading. Get it right and the chain pays you back and if you get it wrong
            you find out exactly how the market humbled you. Either way, you&apos;ll know for
            certain, not vibes, not a screenshot, an on-chain result with your name on it.
          </p>
          <Link
            href="/guess"
            className="mt-6 inline-block rounded-lg border border-yellow-400 px-6 py-2.5 text-sm font-semibold text-yellow-400 transition hover:bg-yellow-400/10"
          >
            Try it now →
          </Link>
        </motion.div>
      </section>

      <section className="px-4 py-14 sm:px-6 sm:py-16">
        <div className="mx-auto grid max-w-lg gap-6">
          <motion.div
            initial={{ opacity: 0, y: 16 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.5 }}
            className="rounded-xl border border-gray-700 bg-gray-900/60 p-6 text-center"
          >
            <span className="inline-flex h-9 w-9 items-center justify-center rounded-lg border border-yellow-400/30 bg-yellow-400/10 text-yellow-400">
              ▲▼
            </span>
            <h2 className="mt-4 text-lg font-semibold text-gray-100">Guess the direction</h2>
            <p className="mt-2 text-sm text-gray-400">
              Stake 0.001 RITUAL, guess up or down over the next 2 hours, come back and resolve.
              Win it back (plus a bonus), or lose it if you&apos;re wrong.
            </p>
            <Link href="/guess" className="mt-4 inline-block text-sm font-medium text-yellow-400 hover:underline">
              Play now →
            </Link>
          </motion.div>
        </div>
      </section>
    </main>
  );
}
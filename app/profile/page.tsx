'use client';

import { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ConnectButton } from '@rainbow-me/rainbowkit';
import { useAccount, usePublicClient, useSendTransaction } from 'wagmi';
import { formatEther, encodeFunctionData, decodeAbiParameters } from 'viem';
import { GUESS_GAME_ADDRESS, guessGameAbi, MIN_WAIT_SECONDS } from '@/lib/guessGame';
import { RITUAL_WALLET, ritualWalletAbi, TEE_SERVICE_REGISTRY, teeServiceRegistryAbi, HTTP_CALL_CAPABILITY } from '@/lib/contracts';
import { COINS, priceUrl } from '@/lib/coins';

interface GuessRow {
  id: bigint;
  direction: number;
  baselinePrice: bigint;
  guessedAt: number;
  status: number;
  resolved: boolean;
  symbol: string;
}

const STATUS_LABEL = ['Open', 'Won', 'Lost'];

function formatDuration(seconds: number): string {
  if (seconds <= 0) return 'Ready to resolve';
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  return `${h}h ${m}m remaining`;
}

type RawReceiptWithSpc = { spcCalls?: Array<{ output: `0x${string}` }> } | null;

async function decodePriceFromReceipt(publicClient: any, hash: `0x${string}`, coinId: string): Promise<number> {
  let rawReceipt: RawReceiptWithSpc = null;
  for (let attempt = 0; attempt < 20; attempt++) {
    const result = await publicClient.request({ method: 'eth_getTransactionReceipt', params: [hash] });
    rawReceipt = result as RawReceiptWithSpc;
    if (rawReceipt) break;
    await new Promise((r) => setTimeout(r, 1500));
  }
  const spcCalls = rawReceipt?.spcCalls;
  if (!spcCalls || spcCalls.length === 0) throw new Error('No settled data found in receipt');
  const [, , , body] = decodeAbiParameters(
    [{ type: 'uint16' }, { type: 'string[]' }, { type: 'string[]' }, { type: 'bytes' }, { type: 'string' }],
    spcCalls[0].output,
  );
  const text = new TextDecoder().decode(Buffer.from((body as string).slice(2), 'hex'));
  const parsed = JSON.parse(text);
  const usd = parsed[coinId]?.usd;
  if (typeof usd !== 'number') throw new Error('Could not find price in response');
  return usd;
}

export default function ProfilePage() {
  const { address, isConnected } = useAccount();
  const publicClient = usePublicClient();
  const { sendTransactionAsync } = useSendTransaction();

  const [wins, setWins] = useState<bigint | null>(null);
  const [losses, setLosses] = useState<bigint | null>(null);
  const [escrow, setEscrow] = useState<bigint | null>(null);
  const [myGuesses, setMyGuesses] = useState<GuessRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [now, setNow] = useState(Math.floor(Date.now() / 1000));
  const [busyId, setBusyId] = useState<bigint | null>(null);
  const [error, setError] = useState('');

  useEffect(() => {
    const t = setInterval(() => setNow(Math.floor(Date.now() / 1000)), 1000);
    return () => clearInterval(t);
  }, []);

  async function load() {
    if (!address || !publicClient) return;
    setLoading(true);
    const [w, l, bal, nextId] = await Promise.all([
      publicClient.readContract({ address: GUESS_GAME_ADDRESS, abi: guessGameAbi, functionName: 'wins', args: [address] }),
      publicClient.readContract({ address: GUESS_GAME_ADDRESS, abi: guessGameAbi, functionName: 'losses', args: [address] }),
      publicClient.readContract({ address: RITUAL_WALLET, abi: ritualWalletAbi, functionName: 'balanceOf', args: [address] }),
      publicClient.readContract({ address: GUESS_GAME_ADDRESS, abi: guessGameAbi, functionName: 'nextGuessId' }),
    ]);

    setWins(w);
    setLosses(l);
    setEscrow(bal);

    const rows: GuessRow[] = [];
    const scanFrom = nextId > 200n ? nextId - 200n : 0n;
    for (let id = scanFrom; id < nextId; id++) {
      const g = await publicClient.readContract({ address: GUESS_GAME_ADDRESS, abi: guessGameAbi, functionName: 'guesses', args: [id] });
      const [user, direction, baselinePrice, guessedAt, status, resolved, symbol] = g;
      if (user.toLowerCase() === address.toLowerCase()) {
        // Ritual's block.timestamp returns milliseconds, not the EVM-standard seconds.
        rows.push({ id, direction, baselinePrice, guessedAt: Math.floor(Number(guessedAt) / 1000), status, resolved, symbol });
      }
    }
    setMyGuesses(rows.reverse());
    setLoading(false);
  }

  useEffect(() => {
    load();
  }, [address, publicClient]);

  async function getExecutor() {
    const services = await publicClient!.readContract({
      address: TEE_SERVICE_REGISTRY,
      abi: teeServiceRegistryAbi,
      functionName: 'getServicesByCapability',
      args: [HTTP_CALL_CAPABILITY, true],
    });
    if (!services || services.length === 0) throw new Error('No HTTP executors available');
    return services[0].node.teeAddress;
  }

  async function handleResolve(g: GuessRow) {
    if (!address || !publicClient) return;
    setError('');
    setBusyId(g.id);
    try {
      const guessCoin = COINS.find((c) => c.symbol === g.symbol)!;
      const executor = await getExecutor();

      const fetchData = encodeFunctionData({
        abi: guessGameAbi,
        functionName: 'fetchPrice',
        args: [executor, 150n, priceUrl(guessCoin.id), g.symbol],
      });
      const fetchHash = await sendTransactionAsync({ to: GUESS_GAME_ADDRESS, data: fetchData, gas: 4_000_000n });
      const fetchReceipt = await publicClient.waitForTransactionReceipt({ hash: fetchHash });
      if (fetchReceipt.status !== 'success') throw new Error('Final price fetch reverted — check the explorer');

      const finalPriceNum = await decodePriceFromReceipt(publicClient, fetchHash, guessCoin.id);
      const finalPrice = BigInt(Math.round(finalPriceNum));

      const resolveData = encodeFunctionData({
        abi: guessGameAbi,
        functionName: 'resolve',
        args: [g.id, finalPrice, g.symbol],
      });
      const resolveHash = await sendTransactionAsync({ to: GUESS_GAME_ADDRESS, data: resolveData, gas: 500_000n });
      const resolveReceipt = await publicClient.waitForTransactionReceipt({ hash: resolveHash });
      if (resolveReceipt.status !== 'success') throw new Error('Resolve reverted — check the explorer');

      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Resolve failed');
    } finally {
      setBusyId(null);
    }
  }

  if (!isConnected) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-black px-6">
        <div className="text-center">
          <p className="text-gray-400">Connect your wallet to view your profile.</p>
          <div className="mt-4 flex justify-center">
            <ConnectButton showBalance={false} />
          </div>
        </div>
      </main>
    );
  }

  const winRate = wins !== null && losses !== null && wins + losses > 0n ? Number((wins * 100n) / (wins + losses)) : null;

  return (
    <main className="min-h-screen bg-black px-4 py-10 sm:px-6 sm:py-14">
      <div className="mx-auto max-w-2xl">
        <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5 }}>
          <p className="font-mono text-xs uppercase tracking-wider text-green-400">Your profile</p>
          <h1 className="mt-2 break-all font-mono text-base text-gray-100 sm:text-lg">
            {address?.slice(0, 8)}...{address?.slice(-6)}
          </h1>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.1 }}
          className="mt-6 grid grid-cols-3 gap-2 sm:gap-4"
        >
          <div className="rounded-xl border border-gray-700 bg-gray-900/60 p-3 text-center sm:p-4">
            <p className="text-[10px] uppercase tracking-wider text-gray-500 sm:text-xs">Wins</p>
            <p className="mt-1 font-mono text-xl text-green-400 sm:text-2xl">{wins?.toString() ?? '—'}</p>
          </div>
          <div className="rounded-xl border border-gray-700 bg-gray-900/60 p-3 text-center sm:p-4">
            <p className="text-[10px] uppercase tracking-wider text-gray-500 sm:text-xs">Losses</p>
            <p className="mt-1 font-mono text-xl text-red-400 sm:text-2xl">{losses?.toString() ?? '—'}</p>
          </div>
          <div className="rounded-xl border border-gray-700 bg-gray-900/60 p-3 text-center sm:p-4">
            <p className="text-[10px] uppercase tracking-wider text-gray-500 sm:text-xs">Win rate</p>
            <p className="mt-1 font-mono text-xl text-gray-100 sm:text-2xl">{winRate !== null ? `${winRate}%` : '—'}</p>
          </div>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.15 }}
          className="mt-4 rounded-xl border border-gray-700 bg-gray-900/60 p-4"
        >
          <p className="text-xs uppercase tracking-wider text-gray-500">Escrow balance</p>
          <p className="mt-1 font-mono text-base text-gray-100 sm:text-lg">
            {escrow !== null ? `${formatEther(escrow)} RITUAL` : '—'}
          </p>
        </motion.div>

        {error && <p className="mt-4 text-sm text-red-400">✗ {error}</p>}

        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.2 }}
          className="mt-6"
        >
          <p className="text-xs uppercase tracking-wider text-gray-500">Your guesses</p>
          {loading && <p className="mt-3 text-sm text-gray-500">Loading...</p>}
          {!loading && myGuesses.length === 0 && (
            <p className="mt-3 text-sm text-gray-500">No guesses yet — head to the Guess page to start.</p>
          )}
          <div className="mt-3 space-y-2">
            <AnimatePresence>
              {myGuesses.map((g) => {
                const remaining = Math.max(0, g.guessedAt + MIN_WAIT_SECONDS - now);
                const canResolve = !g.resolved && remaining === 0;
                return (
                  <motion.div
                    key={g.id.toString()}
                    initial={{ opacity: 0, x: -8 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0 }}
                    className="rounded-lg border border-gray-700 bg-black/30 px-4 py-3"
                  >
                    <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
                      <span className="text-sm text-gray-300">
                        {g.symbol} · {g.direction === 0 ? '▲ Up' : '▼ Down'} from ${g.baselinePrice.toString()}
                      </span>
                      <span
                        className={`text-xs ${
                          g.status === 1 ? 'text-green-400' : g.status === 2 ? 'text-red-400' : 'text-yellow-400'
                        }`}
                      >
                        {STATUS_LABEL[g.status]}
                      </span>
                    </div>
                    {!g.resolved && (
                      canResolve ? (
                        <button
                          onClick={() => handleResolve(g)}
                          disabled={busyId === g.id}
                          className="mt-2 w-full rounded border border-yellow-400 py-1.5 text-xs text-yellow-400 disabled:opacity-40"
                        >
                          {busyId === g.id ? 'Resolving...' : 'Resolve now'}
                        </button>
                      ) : (
                        <p className="mt-1 font-mono text-[11px] text-gray-600">{formatDuration(remaining)}</p>
                      )
                    )}
                  </motion.div>
                );
              })}
            </AnimatePresence>
          </div>
        </motion.div>
      </div>
    </main>
  );
}
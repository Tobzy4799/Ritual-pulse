'use client';

import { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { ConnectButton } from '@rainbow-me/rainbowkit';
import { useAccount, usePublicClient, useSendTransaction } from 'wagmi';
import { encodeFunctionData, parseEther, formatEther } from 'viem';
import { GUESS_GAME_ADDRESS, guessGameAbi, MIN_WAIT_SECONDS, RESOLVE_GRACE_SECONDS } from '@/lib/guessGame';

const EXPLORER_BASE = 'https://explorer.ritualfoundation.org';
const AVG_FEE_PER_FETCH = 0.0000053; // conservative estimate from observed executor fees
const LOW_FEE_THRESHOLD_FETCHES = 500;

interface RecentEvent {
  type: 'RewardPoolFunded' | 'HouseFundsWithdrawn';
  amount: bigint;
  txHash: string;
  blockNumber: bigint;
}
interface StaleGuess {
  id: bigint;
  user: string;
  symbol: string;
  direction: number;
  guessedAt: number;
}

export default function AdminPage() {
  const { address, isConnected } = useAccount();
  const publicClient = usePublicClient();
  const { sendTransactionAsync } = useSendTransaction();

  const [isOwner, setIsOwner] = useState<boolean | null>(null);
  const [rewardPool, setRewardPool] = useState<bigint | null>(null);
  const [houseFunds, setHouseFunds] = useState<bigint | null>(null);
  const [feeBalance, setFeeBalance] = useState<bigint | null>(null);
  const [totalGuesses, setTotalGuesses] = useState<number | null>(null);
  const [totalWins, setTotalWins] = useState<number | null>(null);
  const [totalLosses, setTotalLosses] = useState<number | null>(null);
  const [recentEvents, setRecentEvents] = useState<RecentEvent[]>([]);

  const [depositAmount, setDepositAmount] = useState('0.05');
  const [staleGuesses, setStaleGuesses] = useState<StaleGuess[]>([]);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  async function loadState() {
    if (!address || !publicClient) return;
    const [owner, pool, house, fees, nextGuessId] = await Promise.all([
      publicClient.readContract({ address: GUESS_GAME_ADDRESS, abi: guessGameAbi, functionName: 'owner' }),
      publicClient.readContract({ address: GUESS_GAME_ADDRESS, abi: guessGameAbi, functionName: 'rewardPool' }),
      publicClient.readContract({ address: GUESS_GAME_ADDRESS, abi: guessGameAbi, functionName: 'houseFunds' }),
      publicClient.readContract({ address: GUESS_GAME_ADDRESS, abi: guessGameAbi, functionName: 'gameFeeBalance' }),
      publicClient.readContract({ address: GUESS_GAME_ADDRESS, abi: guessGameAbi, functionName: 'nextGuessId' }),
    ]);
    setIsOwner(owner.toLowerCase() === address.toLowerCase());
    setRewardPool(pool);
    setHouseFunds(house);
    setFeeBalance(fees);

    // Platform-wide totals: scan resolved guesses for win/loss counts.
    const latest = await publicClient.getBlockNumber();
    const lookback = 90_000n;
    const fromBlock = latest > lookback ? latest - lookback : 0n;

    const [resolvedLogs, rewardLogs, withdrawLogs] = await Promise.all([
      publicClient.getContractEvents({
        address: GUESS_GAME_ADDRESS,
        abi: guessGameAbi,
        eventName: 'GuessResolved',
        fromBlock,
        toBlock: latest,
      }),
      publicClient.getContractEvents({
        address: GUESS_GAME_ADDRESS,
        abi: guessGameAbi,
        eventName: 'RewardPoolFunded',
        fromBlock,
        toBlock: latest,
      }),
      publicClient.getContractEvents({
        address: GUESS_GAME_ADDRESS,
        abi: guessGameAbi,
        eventName: 'HouseFundsWithdrawn',
        fromBlock,
        toBlock: latest,
      }),
    ]);

    let wins = 0;
    let losses = 0;
    for (const log of resolvedLogs) {
      const won = (log.args as { won?: boolean }).won;
      if (won) wins++;
      else losses++;
    }
    setTotalWins(wins);
    setTotalLosses(losses);
    setTotalGuesses(Number(nextGuessId));
    // Scan for unresolved guesses past their window — candidates for admin refund.
    const stale: StaleGuess[] = [];
    const scanFrom = nextGuessId > 300n ? nextGuessId - 300n : 0n;
    const nowSec = Math.floor(Date.now() / 1000);
    for (let id = scanFrom; id < nextGuessId; id++) {
      const g = await publicClient.readContract({ address: GUESS_GAME_ADDRESS, abi: guessGameAbi, functionName: 'guesses', args: [id] });
      const [user, direction, , guessedAtRaw, , resolved, symbol] = g;
      const guessedAt = Math.floor(Number(guessedAtRaw) / 1000);
      const isStale = !resolved && nowSec > guessedAt + MIN_WAIT_SECONDS + RESOLVE_GRACE_SECONDS;
      if (isStale) {
        stale.push({ id, user, symbol, direction, guessedAt });
      }
    }
    setStaleGuesses(stale.reverse());

    const events: RecentEvent[] = [
      ...rewardLogs.map((l) => ({
        type: 'RewardPoolFunded' as const,
        amount: (l.args as { amount?: bigint }).amount ?? 0n,
        txHash: l.transactionHash!,
        blockNumber: l.blockNumber!,
      })),
      ...withdrawLogs.map((l) => ({
        type: 'HouseFundsWithdrawn' as const,
        amount: (l.args as { amount?: bigint }).amount ?? 0n,
        txHash: l.transactionHash!,
        blockNumber: l.blockNumber!,
      })),
    ].sort((a, b) => Number(b.blockNumber - a.blockNumber)).slice(0, 8);

    setRecentEvents(events);
  }

  useEffect(() => {
    loadState();
  }, [address, publicClient]);

  async function handleFundRewardPool() {
    setBusy('reward');
    setError('');
    setSuccess('');
    try {
      const data = encodeFunctionData({ abi: guessGameAbi, functionName: 'fundRewardPool', args: [] });
      const hash = await sendTransactionAsync({ to: GUESS_GAME_ADDRESS, data, value: parseEther(depositAmount) });
      await publicClient!.waitForTransactionReceipt({ hash });
      setSuccess(`Reward pool funded with ${depositAmount} RITUAL`);
      await loadState();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Fund reward pool failed');
    } finally {
      setBusy(null);
    }
  }

  async function handleFundGameFees() {
    setBusy('fees');
    setError('');
    setSuccess('');
    try {
      const data = encodeFunctionData({ abi: guessGameAbi, functionName: 'fundGameFees', args: [] });
      const hash = await sendTransactionAsync({ to: GUESS_GAME_ADDRESS, data, value: parseEther(depositAmount) });
      await publicClient!.waitForTransactionReceipt({ hash });
      setSuccess(`Game fee balance topped up with ${depositAmount} RITUAL`);
      await loadState();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Top up fees failed');
    } finally {
      setBusy(null);
    }
  }

  async function handleAdminRefund(guessId: bigint) {
    setBusy(`refund-${guessId}`);
    setError('');
    setSuccess('');
    try {
      const data = encodeFunctionData({ abi: guessGameAbi, functionName: 'adminRefund', args: [guessId] });
      const hash = await sendTransactionAsync({ to: GUESS_GAME_ADDRESS, data });
      await publicClient!.waitForTransactionReceipt({ hash });
      setSuccess(`Refunded guess #${guessId.toString()}`);
      await loadState();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Refund failed');
    } finally {
      setBusy(null);
    }
  }

  async function handleWithdrawHouseFunds() {
    setBusy('withdraw');
    setError('');
    setSuccess('');
    try {
      const data = encodeFunctionData({ abi: guessGameAbi, functionName: 'withdrawHouseFunds', args: [] });
      const hash = await sendTransactionAsync({ to: GUESS_GAME_ADDRESS, data });
      await publicClient!.waitForTransactionReceipt({ hash });
      setSuccess('House funds withdrawn to your wallet');
      await loadState();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Withdraw failed');
    } finally {
      setBusy(null);
    }
  }

  if (!isConnected) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-black px-6">
        <div className="text-center">
          <p className="text-gray-400">Connect the owner wallet to access admin tools.</p>
          <div className="mt-4 flex justify-center">
            <ConnectButton showBalance={false} />
          </div>
        </div>
      </main>
    );
  }

  if (isOwner === false) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-black px-6">
        <p className="text-center text-red-400">✗ This wallet is not the contract owner.</p>
      </main>
    );
  }

  const feeEth = feeBalance !== null ? Number(formatEther(feeBalance)) : null;
  const fetchesRemaining = feeEth !== null ? Math.floor(feeEth / AVG_FEE_PER_FETCH) : null;
  const feeIsLow = fetchesRemaining !== null && fetchesRemaining < LOW_FEE_THRESHOLD_FETCHES;

  const winRate = totalWins !== null && totalLosses !== null && totalWins + totalLosses > 0
    ? Math.round((totalWins / (totalWins + totalLosses)) * 100)
    : null;

  return (
    <main className="min-h-screen bg-black px-4 py-10 sm:px-6 sm:py-14">
      <div className="mx-auto max-w-lg">
        <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5 }}>
          <p className="font-mono text-xs uppercase tracking-wider text-yellow-400">Owner only</p>
          <h1 className="mt-2 text-2xl font-bold text-gray-100">Admin</h1>
          
          <a  href={`${EXPLORER_BASE}/address/${GUESS_GAME_ADDRESS}`}
            target="_blank"
            rel="noreferrer"
            className="mt-1 block break-all font-mono text-xs text-gray-500 underline hover:text-green-400"
          >
            {GUESS_GAME_ADDRESS} ↗
          </a>
        </motion.div>

        {feeIsLow && (
          <motion.div
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            className="mt-4 rounded-lg border border-red-400/40 bg-red-400/5 px-4 py-3 text-sm text-red-400"
          >
            ⚠ Fee balance is low — only ~{fetchesRemaining?.toLocaleString()} fetches left. Top up soon so
            player guesses don&apos;t start failing.
          </motion.div>
        )}

        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.1 }}
          className="mt-6 grid grid-cols-3 gap-3"
        >
          <div className="rounded-xl border border-gray-700 bg-gray-900/60 p-3 text-center">
            <p className="text-[10px] uppercase tracking-wider text-gray-500">Reward pool</p>
            <p className="mt-1 font-mono text-sm text-green-400">
              {rewardPool !== null ? formatEther(rewardPool) : '—'}
            </p>
          </div>
          <div className="rounded-xl border border-gray-700 bg-gray-900/60 p-3 text-center">
            <p className="text-[10px] uppercase tracking-wider text-gray-500">House funds</p>
            <p className="mt-1 font-mono text-sm text-yellow-400">
              {houseFunds !== null ? formatEther(houseFunds) : '—'}
            </p>
          </div>
          <div className="rounded-xl border border-gray-700 bg-gray-900/60 p-3 text-center">
            <p className="text-[10px] uppercase tracking-wider text-gray-500">Fee balance</p>
            <p className={`mt-1 font-mono text-sm ${feeIsLow ? 'text-red-400' : 'text-gray-100'}`}>
              {feeBalance !== null ? formatEther(feeBalance) : '—'}
            </p>
          </div>
        </motion.div>

        {feeEth !== null && (
          <p className="mt-2 text-center font-mono text-[11px] text-gray-500">
            ≈ {fetchesRemaining?.toLocaleString()} fetches remaining at current balance
          </p>
        )}

        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.15 }}
          className="mt-6 grid grid-cols-3 gap-3"
        >
          <div className="rounded-xl border border-gray-700 bg-gray-900/60 p-3 text-center">
            <p className="text-[10px] uppercase tracking-wider text-gray-500">Total guesses</p>
            <p className="mt-1 font-mono text-lg text-gray-100">{totalGuesses ?? '—'}</p>
          </div>
          <div className="rounded-xl border border-gray-700 bg-gray-900/60 p-3 text-center">
            <p className="text-[10px] uppercase tracking-wider text-gray-500">Platform win rate</p>
            <p className="mt-1 font-mono text-lg text-gray-100">{winRate !== null ? `${winRate}%` : '—'}</p>
          </div>
          <div className="rounded-xl border border-gray-700 bg-gray-900/60 p-3 text-center">
            <p className="text-[10px] uppercase tracking-wider text-gray-500">W / L</p>
            <p className="mt-1 font-mono text-lg text-gray-100">
              <span className="text-green-400">{totalWins ?? '—'}</span>
              <span className="text-gray-600"> / </span>
              <span className="text-red-400">{totalLosses ?? '—'}</span>
            </p>
          </div>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.2 }}
          className="mt-6 rounded-xl border border-gray-700 bg-gray-900/60 p-5"
        >
          <label className="text-xs uppercase tracking-wider text-gray-500">Amount (RITUAL)</label>
          <input
            type="number"
            step="0.001"
            value={depositAmount}
            onChange={(e) => setDepositAmount(e.target.value)}
            className="mt-1 w-full rounded-lg border border-gray-700 bg-black/40 px-3 py-2 font-mono text-gray-100 focus:border-green-400 focus:outline-none"
          />

          <button
            onClick={handleFundRewardPool}
            disabled={busy !== null}
            className="mt-4 w-full rounded-lg border border-green-400 py-2.5 text-sm text-green-400 transition hover:bg-green-400/10 disabled:opacity-40"
          >
            {busy === 'reward' ? 'Funding...' : 'Fund reward pool (pays win bonuses)'}
          </button>

          <button
            onClick={handleFundGameFees}
            disabled={busy !== null}
            className="mt-3 w-full rounded-lg border border-gray-600 py-2.5 text-sm text-gray-300 transition hover:border-gray-400 disabled:opacity-40"
          >
            {busy === 'fees' ? 'Topping up...' : 'Top up fee balance (pays precompile fetches)'}
          </button>

          <button
            onClick={handleWithdrawHouseFunds}
            disabled={busy !== null || !houseFunds || houseFunds === 0n}
            className="mt-3 w-full rounded-lg border border-yellow-400 py-2.5 text-sm text-yellow-400 transition hover:bg-yellow-400/10 disabled:opacity-40"
          >
            {busy === 'withdraw' ? 'Withdrawing...' : 'Withdraw house funds (lost stakes) to my wallet'}
          </button>

          {error && <p className="mt-4 text-sm text-red-400">✗ {error}</p>}
          {success && <p className="mt-4 text-sm text-green-400">✓ {success}</p>}
        </motion.div>
<motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.22 }}
          className="mt-6"
        >
          <p className="text-xs uppercase tracking-wider text-gray-500">Stale guesses (refund candidates)</p>
          {staleGuesses.length === 0 && <p className="mt-2 text-sm text-gray-500">None right now.</p>}
          <div className="mt-2 space-y-2">
            {staleGuesses.map((g) => (
              <div key={g.id.toString()} className="rounded-lg border border-gray-800 bg-black/30 px-3 py-2">
                <p className="font-mono text-xs text-gray-400">
                  #{g.id.toString()} · {g.symbol} {g.direction === 0 ? '▲' : '▼'} ·{' '}
                  {g.user.slice(0, 6)}...{g.user.slice(-4)}
                </p>
                <button
                  onClick={() => handleAdminRefund(g.id)}
                  disabled={busy !== null}
                  className="mt-1 w-full rounded border border-gray-600 py-1 text-xs text-gray-300 hover:border-red-400 hover:text-red-400 disabled:opacity-40"
                >
                  {busy === `refund-${g.id}` ? 'Refunding...' : 'Refund stake'}
                </button>
              </div>
            ))}
          </div>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.25 }}
          className="mt-6"
        >
          <p className="text-xs uppercase tracking-wider text-gray-500">Recent activity</p>
          {recentEvents.length === 0 && <p className="mt-2 text-sm text-gray-500">Nothing yet.</p>}
          <div className="mt-2 space-y-2">
            {recentEvents.map((e) => (
              
               <a key={e.txHash}
                href={`${EXPLORER_BASE}/tx/${e.txHash}`}
                target="_blank"
                rel="noreferrer"
                className="flex items-center justify-between rounded-lg border border-gray-800 bg-black/30 px-3 py-2 hover:border-gray-600"
              >
                <span className={`text-xs ${e.type === 'RewardPoolFunded' ? 'text-green-400' : 'text-yellow-400'}`}>
                  {e.type === 'RewardPoolFunded' ? 'Funded reward pool' : 'Withdrew house funds'}
                </span>
                <span className="font-mono text-xs text-gray-400">{formatEther(e.amount)} RITUAL</span>
              </a>
            ))}
          </div>
        </motion.div>
      </div>
    </main>
  );
}
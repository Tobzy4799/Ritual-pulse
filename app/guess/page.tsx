'use client';

import { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useAccount, usePublicClient, useSendTransaction, useReadContract } from 'wagmi';
import { encodeFunctionData, parseEther, formatEther, decodeAbiParameters } from 'viem';
import {
  TEE_SERVICE_REGISTRY,
  teeServiceRegistryAbi,
  HTTP_CALL_CAPABILITY,
  RITUAL_WALLET,
  ritualWalletAbi,
  DEPOSIT_LOCK_DURATION,
} from '@/lib/contracts';
import { GUESS_GAME_ADDRESS, guessGameAbi, Direction, STAKE_AMOUNT_ETH, MIN_WAIT_SECONDS, RESOLVE_GRACE_SECONDS } from '@/lib/guessGame';
import { COINS, priceUrl } from '@/lib/coins';
import { WinCelebration } from '@/components/WinCelebration';
import { HowItWorks } from '@/components/HowItWorks';

type Stage = 'idle' | 'working' | 'error';

interface ActiveGuess {
  guessId: bigint;
  baselinePrice: bigint;
  direction: number;
  guessedAt: number;
  symbol: string;
}

function formatDuration(seconds: number): string {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  return `${h}h ${m}m`;
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

export default function GuessPage() {
  const { address, isConnected } = useAccount();
  const publicClient = usePublicClient();
  const { sendTransactionAsync } = useSendTransaction();

  const { data: escrowBalance, refetch: refetchEscrow } = useReadContract({
    address: RITUAL_WALLET,
    abi: ritualWalletAbi,
    functionName: 'balanceOf',
    args: address ? [address] : undefined,
    query: { enabled: !!address, refetchInterval: 6000 },
  });
  const escrowEth = escrowBalance !== undefined ? Number(formatEther(escrowBalance)) : 0;
  const escrowLow = escrowEth < 0.001;
  const [depositBusy, setDepositBusy] = useState(false);

  const [coinId, setCoinId] = useState(COINS[0].id);
  const coin = COINS.find((c) => c.id === coinId)!;

  const [stage, setStage] = useState<Stage>('idle');
  const [statusText, setStatusText] = useState('');
  const [error, setError] = useState('');
  const [activeGuesses, setActiveGuesses] = useState<ActiveGuess[]>([]);
  const [loadingGuesses, setLoadingGuesses] = useState(true);
  const [now, setNow] = useState(Math.floor(Date.now() / 1000));
  const [resultMessage, setResultMessage] = useState<{ won: boolean; text: string } | null>(null);
  const [celebrate, setCelebrate] = useState(false);

  const [isOwner, setIsOwner] = useState(false);
  const [feeBalance, setFeeBalance] = useState<bigint | null>(null);
  const [topUpBusy, setTopUpBusy] = useState(false);

  useEffect(() => {
    const t = setInterval(() => setNow(Math.floor(Date.now() / 1000)), 1000);
    return () => clearInterval(t);
  }, []);

  // Load real open guesses straight from the contract — survives refreshes,
  // unlike keeping this only in React state.
  async function loadActiveGuesses() {
    if (!address || !publicClient) return;
    setLoadingGuesses(true);
    try {
      const nextId = await publicClient.readContract({
        address: GUESS_GAME_ADDRESS,
        abi: guessGameAbi,
        functionName: 'nextGuessId',
      });
      const scanFrom = nextId > 300n ? nextId - 300n : 0n;
      const rows: ActiveGuess[] = [];
      for (let id = scanFrom; id < nextId; id++) {
        const g = await publicClient.readContract({
          address: GUESS_GAME_ADDRESS,
          abi: guessGameAbi,
          functionName: 'guesses',
          args: [id],
        });
        const [user, direction, baselinePrice, guessedAt, , resolved, symbol] = g;
        if (user.toLowerCase() === address.toLowerCase() && !resolved) {
            rows.push({ guessId: id, baselinePrice, direction, guessedAt: Math.floor(Number(guessedAt) / 1000), symbol });
        }
      }
      setActiveGuesses(rows.reverse());
    } finally {
      setLoadingGuesses(false);
    }
  }

  useEffect(() => {
    loadActiveGuesses();
  }, [address, publicClient]);

  useEffect(() => {
    if (!address || !publicClient) return;
    publicClient
      .readContract({ address: GUESS_GAME_ADDRESS, abi: guessGameAbi, functionName: 'owner' })
      .then((owner) => setIsOwner(owner.toLowerCase() === address.toLowerCase()))
      .catch(() => setIsOwner(false));
  }, [address, publicClient]);

  async function refreshFeeBalance() {
    if (!publicClient) return;
    const bal = await publicClient.readContract({ address: GUESS_GAME_ADDRESS, abi: guessGameAbi, functionName: 'gameFeeBalance' });
    setFeeBalance(bal);
  }

  useEffect(() => {
    if (isOwner) refreshFeeBalance();
  }, [isOwner]);

  async function handleTopUp() {
    setTopUpBusy(true);
    try {
      const data = encodeFunctionData({ abi: guessGameAbi, functionName: 'fundGameFees', args: [] });
      const hash = await sendTransactionAsync({ to: GUESS_GAME_ADDRESS, data, value: parseEther('0.05') });
      await publicClient!.waitForTransactionReceipt({ hash });
      await refreshFeeBalance();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Top-up failed');
    } finally {
      setTopUpBusy(false);
    }
  }

  async function handleDepositEscrow() {
    if (!address) return;
    setDepositBusy(true);
    try {
      const data = encodeFunctionData({ abi: ritualWalletAbi, functionName: 'deposit', args: [DEPOSIT_LOCK_DURATION] });
      const hash = await sendTransactionAsync({ to: RITUAL_WALLET, data, value: parseEther('0.05') });
      await publicClient!.waitForTransactionReceipt({ hash });
      await refetchEscrow();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Deposit failed');
    } finally {
      setDepositBusy(false);
    }
  }

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

  async function handleStartGuess(direction: number) {
    if (!address || !publicClient) return;
    setError('');
    setResultMessage(null);
    setStage('working');

    try {
      const executor = await getExecutor();
      setStatusText(`Fetching baseline ${coin.symbol} price on-chain...`);
      const fetchData = encodeFunctionData({
        abi: guessGameAbi,
        functionName: 'fetchPrice',
        args: [executor, 150n, priceUrl(coinId), coin.symbol],
      });
      const fetchHash = await sendTransactionAsync({ to: GUESS_GAME_ADDRESS, data: fetchData, gas: 4_000_000n });
      const fetchReceipt = await publicClient.waitForTransactionReceipt({ hash: fetchHash });
      if (fetchReceipt.status !== 'success') throw new Error('Price fetch reverted — check the explorer');

      const baselinePriceNum = await decodePriceFromReceipt(publicClient, fetchHash, coinId);
      const baselinePrice = BigInt(Math.round(baselinePriceNum));

      setStatusText('Staking your guess...');
      const stakeData = encodeFunctionData({
        abi: guessGameAbi,
        functionName: 'stake',
        args: [baselinePrice, direction, coin.symbol],
      });
      const stakeHash = await sendTransactionAsync({
        to: GUESS_GAME_ADDRESS,
        data: stakeData,
        value: parseEther(STAKE_AMOUNT_ETH),
        gas: 500_000n,
      });
      const stakeReceipt = await publicClient.waitForTransactionReceipt({ hash: stakeHash });
      if (stakeReceipt.status !== 'success') throw new Error('Stake reverted — check the explorer');

      await loadActiveGuesses();
      setStage('idle');
      setStatusText('');
    } catch (err) {
      setStage('error');
      setError(err instanceof Error ? err.message : 'Something went wrong');
    }
  }

  async function handleResolve(guess: ActiveGuess) {
    if (!address || !publicClient) return;
    setError('');
    setResultMessage(null);
    setStage('working');

    try {
      const guessCoin = COINS.find((c) => c.symbol === guess.symbol)!;
      const executor = await getExecutor();

      setStatusText(`Fetching final ${guess.symbol} price on-chain...`);
      const fetchData = encodeFunctionData({
        abi: guessGameAbi,
        functionName: 'fetchPrice',
        args: [executor, 150n, priceUrl(guessCoin.id), guess.symbol],
      });
      const fetchHash = await sendTransactionAsync({ to: GUESS_GAME_ADDRESS, data: fetchData, gas: 4_000_000n });
      const fetchReceipt = await publicClient.waitForTransactionReceipt({ hash: fetchHash });
      if (fetchReceipt.status !== 'success') throw new Error('Final price fetch reverted — check the explorer');

      const finalPriceNum = await decodePriceFromReceipt(publicClient, fetchHash, guessCoin.id);
      const finalPrice = BigInt(Math.round(finalPriceNum));

      setStatusText('Resolving your guess...');
      const resolveData = encodeFunctionData({
        abi: guessGameAbi,
        functionName: 'resolve',
        args: [guess.guessId, finalPrice, guess.symbol],
      });
      const resolveHash = await sendTransactionAsync({ to: GUESS_GAME_ADDRESS, data: resolveData, gas: 500_000n });
      const resolveReceipt = await publicClient.waitForTransactionReceipt({ hash: resolveHash });
      if (resolveReceipt.status !== 'success') throw new Error('Resolve reverted — check the explorer');

      const wentUp = finalPrice > guess.baselinePrice;
      const won = (guess.direction === Direction.Up && wentUp) || (guess.direction === Direction.Down && !wentUp);

      setResultMessage({
        won,
        text: `${guess.symbol}: ${won ? 'You won!' : 'You lost.'} Price went from $${guess.baselinePrice} to $${finalPrice}.`,
      });
      if (won) {
        setCelebrate(true);
        setTimeout(() => setCelebrate(false), 1800);
      }
      await loadActiveGuesses();
      setStage('idle');
      setStatusText('');
    } catch (err) {
      setStage('error');
      setError(err instanceof Error ? err.message : 'Something went wrong');
    }
  }

  const isBusy = stage === 'working';

  return (
    <>
      <WinCelebration show={celebrate} />
      <main className="min-h-screen bg-black px-4 py-8 sm:px-6 sm:py-14">
      <div className="mx-auto max-w-3xl">
        <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5 }}>
          <p className="font-mono text-xs uppercase tracking-wider text-yellow-400">Prediction game</p>
          <h1 className="mt-2 text-2xl font-bold text-gray-100">Guess the Direction</h1>
        </motion.div>

        <HowItWorks />
        {isOwner && (
          <motion.div
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.1 }}
            className="mt-4 rounded-xl border border-yellow-400/30 bg-yellow-400/5 p-4"
          >
            <p className="text-xs uppercase tracking-wider text-yellow-400">Owner panel</p>
            <p className="mt-1 text-sm text-gray-300">
              Game fee balance: {feeBalance !== null ? `${formatEther(feeBalance)} RITUAL` : 'Loading...'}
            </p>
            <button
              onClick={handleTopUp}
              disabled={topUpBusy}
              className="mt-2 rounded border border-yellow-400 px-3 py-1.5 text-xs text-yellow-400 disabled:opacity-40"
            >
              {topUpBusy ? 'Topping up...' : 'Top up 0.05 RITUAL'}
            </button>
          </motion.div>
        )}

        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.15 }}
          className="mx-auto mt-6 max-w-lg rounded-xl border border-gray-700 bg-gray-900/60 p-6"
        >
          <div className="mb-4 flex items-center justify-between rounded-lg border border-gray-700 bg-black/40 px-4 py-3">
            <div>
              <p className="text-xs uppercase tracking-wider text-gray-500">Escrow balance</p>
              <p className="font-mono text-lg text-gray-100">
                {isConnected ? escrowEth.toFixed(6) : '—'} <span className="text-sm text-gray-500">RITUAL</span>
              </p>
            </div>
            {escrowLow && isConnected ? (
              <button
                onClick={handleDepositEscrow}
                disabled={depositBusy}
                className="rounded border border-yellow-400 px-3 py-1.5 text-xs text-yellow-400 disabled:opacity-40"
              >
                {depositBusy ? 'Depositing...' : 'Fund 0.05 RITUAL'}
              </button>
            ) : (
              isConnected && <p className="text-xs text-gray-500">Enough for many fetches</p>
            )}
          </div>
          <p className="text-xs uppercase tracking-wider text-gray-500">
            Guess up or down over the next {MIN_WAIT_SECONDS / 60} minutes
          </p>
         <p className="mt-1 text-xs text-gray-500">
            Stake {STAKE_AMOUNT_ETH} RITUAL per guess, win it back (plus bonus if funded), or lose it if wrong.
          </p>
          <p className="mt-1 text-xs text-gray-500">
            If you don&apos;t resolve within 20 minutes of the 30-minute window opening, your guess
            goes stale and your stake is automatically refunded during the next daily admin refund
            cycle, no funds are ever lost to a missed window.
          </p>
          {escrowLow && isConnected && (
            <p className="mt-2 rounded-lg border border-yellow-400/30 bg-yellow-400/5 px-3 py-2 text-xs text-yellow-400">
              ⚠ New here? Fund your escrow balance above first, it covers the small fee for each
              on-chain price fetch. Without it, your guess transaction will fail.
            </p>
          )}

          <div className="mt-4 flex gap-2">
            {COINS.map((c) => (
              <button
                key={c.id}
                onClick={() => setCoinId(c.id)}
                disabled={isBusy}
                className={`flex-1 rounded-lg border py-2 font-mono text-sm transition disabled:opacity-40 ${
                  coinId === c.id ? 'border-green-400 bg-green-400/10 text-green-400' : 'border-gray-700 text-gray-400 hover:border-gray-500'
                }`}
              >
                {c.symbol}
              </button>
            ))}
          </div>

          <div className="mt-4 flex gap-3">
            <button
              onClick={() => handleStartGuess(Direction.Up)}
              disabled={!isConnected || isBusy}
              className="flex-1 rounded-lg border border-green-400 py-3 text-green-400 transition hover:bg-green-400/10 disabled:opacity-40"
            >
              ▲ Guess Up
            </button>
            <button
              onClick={() => handleStartGuess(Direction.Down)}
              disabled={!isConnected || isBusy}
              className="flex-1 rounded-lg border border-red-400 py-3 text-red-400 transition hover:bg-red-400/10 disabled:opacity-40"
            >
              ▼ Guess Down
            </button>
          </div>

          {isBusy && statusText && <p className="mt-4 text-sm text-gray-400">{statusText}</p>}
          {stage === 'error' && <p className="mt-4 text-sm text-red-400">✗ {error}</p>}
          <AnimatePresence>
            {resultMessage && (
              <motion.p
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0 }}
                className={`mt-4 text-sm ${resultMessage.won ? 'text-green-400' : 'text-red-400'}`}
              >
                {resultMessage.won ? '✓' : '✗'} {resultMessage.text}
              </motion.p>
            )}
          </AnimatePresence>

          <div className="mt-5">
            <p className="text-xs uppercase tracking-wider text-gray-500">Your active guesses</p>
            {loadingGuesses && <p className="mt-2 text-sm text-gray-500">Loading...</p>}
            {!loadingGuesses && activeGuesses.length === 0 && (
              <p className="mt-2 text-sm text-gray-500">No open guesses right now.</p>
            )}
            <div className="mt-3 space-y-2">
              <AnimatePresence>
                {activeGuesses.map((g) => {
                 
                  const remaining = Math.max(0, g.guessedAt + MIN_WAIT_SECONDS - now);
                  const canResolve = remaining === 0;
                  const isStale = now > g.guessedAt + MIN_WAIT_SECONDS + RESOLVE_GRACE_SECONDS;
                  return (
                    <motion.div
                      key={g.guessId.toString()}
                      initial={{ opacity: 0, x: -8 }}
                      animate={{ opacity: 1, x: 0 }}
                      exit={{ opacity: 0 }}
                      className="rounded-lg border border-gray-700 bg-black/40 p-3"
                    >
                      <p className="text-sm text-gray-300">
                        {g.symbol} · {g.direction === 0 ? '▲ Up' : '▼ Down'} from{' '}
                        <span className="font-mono text-gray-100">${g.baselinePrice.toString()}</span>
                      </p>
                     {isStale ? (
                        <p className="mt-2 rounded border border-gray-700 bg-black/30 px-2 py-1.5 text-center text-xs text-gray-500">
                          Window closed, your stake will be refunded within 24 hours.
                        </p>
                      ) : canResolve ? (
                        <button
                          onClick={() => handleResolve(g)}
                          disabled={isBusy}
                          className="mt-2 w-full rounded border border-yellow-400 py-1.5 text-xs text-yellow-400 disabled:opacity-40"
                        >
                          {isBusy ? 'Working...' : 'Resolve now'}
                        </button>
                      ) : (
                        <p className="mt-2 font-mono text-xs text-gray-500">{formatDuration(remaining)} remaining</p>
                      )}
                    </motion.div>
                  );
                })}
              </AnimatePresence>
            </div>
          </div>
        </motion.div>
 </div>
      </main>
    </>
  );
}
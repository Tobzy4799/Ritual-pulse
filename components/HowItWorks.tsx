'use client';

import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';

const STEPS = [
  { label: 'Fetch', detail: 'Sign once to pull a real, verified baseline price on-chain.' },
  { label: 'Stake', detail: 'Sign again to lock in 0.001 RITUAL and your Up/Down call.' },
  { label: 'Wait', detail: 'A 30 minutes window passes, no rush, resolve between 20 minutes after.' },
  { label: 'Resolve', detail: 'Sign twice more: fetch the new price, then settle the bet.' },
];

export function HowItWorks() {
  const [open, setOpen] = useState(false);

  return (
    <div className="mx-auto mt-4 max-w-lg rounded-xl border border-gray-700 bg-gray-900/40">
      <button
        onClick={() => setOpen((v) => !v)}
        className="flex w-full items-center justify-between px-5 py-3 text-left"
      >
        <span className="text-xs uppercase tracking-wider text-gray-400">How it works</span>
        <motion.span animate={{ rotate: open ? 180 : 0 }} className="text-gray-500">
          ▾
        </motion.span>
      </button>
      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            className="overflow-hidden"
          >
            <div className="grid grid-cols-1 gap-3 px-5 pb-5 sm:grid-cols-4 sm:gap-2">
              {STEPS.map((step, i) => (
                <div key={step.label} className="rounded-lg border border-gray-800 bg-black/30 p-3">
                  <p className="font-mono text-xs text-yellow-400">{i + 1}. {step.label}</p>
                  <p className="mt-1 text-[11px] text-gray-500">{step.detail}</p>
                </div>
              ))}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
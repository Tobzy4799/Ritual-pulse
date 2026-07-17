'use client';

import { motion, AnimatePresence } from 'framer-motion';

const PARTICLE_COUNT = 24;
const COLORS = ['#4ade80', '#facc15', '#f472b6', '#60a5fa'];

interface Props {
  show: boolean;
}

export function WinCelebration({ show }: Props) {
  return (
    <AnimatePresence>
      {show && (
        <div className="pointer-events-none fixed inset-0 z-[100] overflow-hidden">
          {Array.from({ length: PARTICLE_COUNT }).map((_, i) => {
            const startX = 50 + (Math.random() - 0.5) * 30;
            const drift = (Math.random() - 0.5) * 60;
            const size = 6 + Math.random() * 6;
            const color = COLORS[i % COLORS.length];
            const duration = 1.2 + Math.random() * 0.8;
            const delay = Math.random() * 0.15;

            return (
              <motion.span
                key={i}
                initial={{ opacity: 1, x: `${startX}vw`, y: '35vh', scale: 0, rotate: 0 }}
                animate={{
                  opacity: [1, 1, 0],
                  y: '-10vh',
                  x: `${startX + drift}vw`,
                  scale: 1,
                  rotate: 360,
                }}
                transition={{ duration, delay, ease: 'easeOut' }}
                style={{
                  position: 'absolute',
                  width: size,
                  height: size,
                  backgroundColor: color,
                  borderRadius: i % 3 === 0 ? '9999px' : '2px',
                }}
              />
            );
          })}
        </div>
      )}
    </AnimatePresence>
  );
}
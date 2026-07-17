'use client';

import { useState } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { WagmiProvider, http } from 'wagmi';
import { RainbowKitProvider, getDefaultConfig, darkTheme } from '@rainbow-me/rainbowkit';
import '@rainbow-me/rainbowkit/styles.css';
import { ritualChain } from '@/lib/chain';

const wagmiConfig = getDefaultConfig({
  appName: 'Ritual Pulse',
  projectId: 'ritual-pulse-dapp',
  chains: [ritualChain],
  transports: { [ritualChain.id]: http() },
  ssr: true,
});

const ritualTheme = darkTheme({
  accentColor: '#19D184',
  accentColorForeground: '#000000',
  borderRadius: 'medium',
});

export function Providers({ children }: { children: React.ReactNode }) {
  const [queryClient] = useState(() => new QueryClient());

  return (
    <WagmiProvider config={wagmiConfig}>
      <QueryClientProvider client={queryClient}>
        <RainbowKitProvider theme={ritualTheme} initialChain={ritualChain}>
          {children}
        </RainbowKitProvider>
      </QueryClientProvider>
    </WagmiProvider>
  );
}

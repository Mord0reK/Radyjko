import { memo } from 'react';
import { StationsProvider } from '@/contexts/StationsContext';
import { PlayerProvider } from '@/contexts/PlayerContext';
import { FavoritesProvider } from '@/contexts/FavoritesContext';
import { AppProvider } from '@/contexts/AppContext';
import { AppShell } from '@/components/layout/AppShell';

const ProvidersInner = memo(function ProvidersInner({ children }: { children: React.ReactNode }) {
  return (
    <StationsProvider>
      <PlayerProvider>
        <FavoritesProvider>
          <AppProvider>
            <AppShell>{children}</AppShell>
          </AppProvider>
        </FavoritesProvider>
      </PlayerProvider>
    </StationsProvider>
  );
});

ProvidersInner.displayName = 'ProvidersInner';

export function Providers({ children }: { children: React.ReactNode }) {
  return <ProvidersInner>{children}</ProvidersInner>;
}

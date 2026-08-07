import { createContext, useContext, useCallback, useMemo, useSyncExternalStore, useEffect, type ReactNode } from 'react';
import { isTauriAndroid } from '@/lib/platform';

const FAVORITES_KEY = 'radyjko_favorites';
const FAVORITES_CHANGE_EVENT = 'radyjko:favorites-change';

function subscribeToFavorites(onStoreChange: () => void): () => void {
  const handleStorage = (event: StorageEvent) => {
    if (event.key === FAVORITES_KEY) onStoreChange();
  };
  window.addEventListener('storage', handleStorage);
  window.addEventListener(FAVORITES_CHANGE_EVENT, onStoreChange);

  return () => {
    window.removeEventListener('storage', handleStorage);
    window.removeEventListener(FAVORITES_CHANGE_EVENT, onStoreChange);
  };
}

function getFavoritesSnapshot(): string {
  return window.localStorage.getItem(FAVORITES_KEY) ?? '[]';
}

function getServerFavoritesSnapshot(): string {
  return '[]';
}

interface FavoritesContextType {
  favorites: number[];
  toggleFavorite: (stationId: number) => void;
  isFavorite: (stationId: number) => boolean;
}

const FavoritesContext = createContext<FavoritesContextType | null>(null);

export function useFavorites(): FavoritesContextType {
  const ctx = useContext(FavoritesContext);
  if (!ctx) throw new Error('useFavorites must be used within FavoritesProvider');
  return ctx;
}

async function loadAndroidFavorites(): Promise<number[] | null> {
  if (!isTauriAndroid()) return null;
  try {
    const { invoke } = await import('@tauri-apps/api/core');
    const result = await invoke<{ favorites: number[] }>('load_android_auto_favorites');
    return result?.favorites ?? [];
  } catch {
    return null;
  }
}

async function saveAndroidFavorites(favorites: number[]): Promise<void> {
  if (!isTauriAndroid()) return;
  try {
    const { invoke } = await import('@tauri-apps/api/core');
    await invoke('sync_android_auto_favorites', { favorites });
  } catch {
    // Ignore Android sync failures — favorites still work locally.
  }
}

async function listenFavoritesChanges(onChange: (favorites: number[]) => void): Promise<() => void> {
  if (!isTauriAndroid()) return () => {};
  try {
    const { addPluginListener } = await import('@tauri-apps/api/core');
    const listener = await addPluginListener<{ favorites: number[] }>(
      'radyjko-auto',
      'favoritesChanged',
      (event) => onChange(event.favorites ?? []),
    );
    return () => { void listener.unregister(); };
  } catch {
    return () => {};
  }
}

function useFavoritesState(): FavoritesContextType {
  const serializedFavorites = useSyncExternalStore(
    subscribeToFavorites,
    getFavoritesSnapshot,
    getServerFavoritesSnapshot,
  );
  const favorites = useMemo(() => {
    try {
      const parsed = JSON.parse(serializedFavorites) as unknown;
      return Array.isArray(parsed) && parsed.every((id) => typeof id === 'number') ? parsed : [];
    } catch {
      return [];
    }
  }, [serializedFavorites]);

  const toggleFavorite = useCallback((stationId: number) => {
    const next = favorites.includes(stationId)
      ? favorites.filter((id) => id !== stationId)
      : [...favorites, stationId];
    try {
      localStorage.setItem(FAVORITES_KEY, JSON.stringify(next));
      window.dispatchEvent(new Event(FAVORITES_CHANGE_EVENT));
    } catch { /* ignore */ }
    saveAndroidFavorites(next);
  }, [favorites]);

  const isFavorite = useCallback((stationId: number) => favorites.includes(stationId), [favorites]);

  return { favorites, toggleFavorite, isFavorite };
}

export function FavoritesProvider({ children }: { children: ReactNode }) {
  const value = useFavoritesState();

  useEffect(() => {
    let mounted = true;
    loadAndroidFavorites().then((androidFavorites) => {
      if (!mounted) return;
      if (androidFavorites !== null) {
        try {
          localStorage.setItem(FAVORITES_KEY, JSON.stringify(androidFavorites));
          window.dispatchEvent(new Event(FAVORITES_CHANGE_EVENT));
        } catch { /* ignore */ }
      }
    });
    return () => { mounted = false; };
  }, []);

  useEffect(() => {
    let mounted = true
    let unlistenFavorites: (() => void) | null = null

    listenFavoritesChanges((androidFavorites) => {
      if (!mounted) return
      try {
        localStorage.setItem(FAVORITES_KEY, JSON.stringify(androidFavorites))
        window.dispatchEvent(new Event(FAVORITES_CHANGE_EVENT))
      } catch { /* ignore */ }
    }).then((unlisten) => {
      if (!mounted) return
      unlistenFavorites = unlisten
    })

    return () => {
      mounted = false
      if (unlistenFavorites) {
        unlistenFavorites()
      }
    }
  }, [])

  return (
    <FavoritesContext.Provider value={value}>
      {children}
    </FavoritesContext.Provider>
  );
}

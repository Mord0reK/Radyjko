import { createContext, useContext, useState, useEffect, type ReactNode } from 'react';
import type { Station, SongInfo } from '@/lib/types';
import { connectNowPlayingStream, fetchStations } from '@/lib/api';

export function getStationGroup(station: Station): string {
  if (station.shortName.includes('rmf')) return 'Grupa RMF';
  if (station.shortName.includes('radio-zet') || station.shortName.includes('radiozet') || station.shortName.includes('antyradio') || station.shortName.includes('meloradio')) return 'Eurozet';
  if (station.shortName.includes('eska')) return 'Eska';
  if (station.shortName.includes('voxfm')) return 'VoxFM';
  if (station.shortName.includes('openfm')) return 'OpenFM';
  if (station.shortName.includes('radio-cmp')) return 'Radio CMP';
  if (station.shortName.includes('rp-')) return 'RadioParty';
  return 'Inne';
}

export function getOrderedStations(stations: Station[], favorites: number[], searchQuery = ''): Station[] {
  const normalizedQuery = searchQuery.trim().toLowerCase();
  const matchesQuery = (station: Station): boolean => {
    if (!normalizedQuery) return true;

    return (
      station.name.toLowerCase().includes(normalizedQuery) ||
      station.shortName.toLowerCase().includes(normalizedQuery) ||
      (station.Opis?.toLowerCase().includes(normalizedQuery) ?? false)
    );
  };

  const favoriteStations = stations.filter((station) => favorites.includes(station.id) && matchesQuery(station));
  const groupedStations = stations.filter((station) => !favorites.includes(station.id) && matchesQuery(station));

  const groups: Record<string, Station[]> = {};
  groupedStations.forEach((station) => {
    const group = getStationGroup(station);
    if (!groups[group]) groups[group] = [];
    groups[group].push(station);
  });

  const orderedStations: Station[] = [...favoriteStations];

  Object.values(groups).forEach((groupStations) => {
    orderedStations.push(...groupStations);
  });

  return orderedStations;
}

export function getIconPath(shortName: string): string {
  return `/ikony/${shortName}.webp`;
}

interface StationsContextType {
  stations: Station[];
  stationsLoading: boolean;
  nowPlaying: Record<number, SongInfo>;
  nowPlayingLoading: boolean;
  searchQuery: string;
  setSearchQuery: (q: string) => void;
}

const StationsContext = createContext<StationsContextType | null>(null);

export function useStations(): StationsContextType {
  const ctx = useContext(StationsContext);
  if (!ctx) throw new Error('useStations must be used within StationsProvider');
  return ctx;
}

export function StationsProvider({ children }: { children: ReactNode }) {
  const [stations, setStations] = useState<Station[]>([]);
  const [stationsLoading, setStationsLoading] = useState(true);
  const [nowPlaying, setNowPlaying] = useState<Record<number, SongInfo>>({});
  const [nowPlayingLoading, setNowPlayingLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');

  useEffect(() => {
    let mounted = true;
    const load = async () => {
      try {
        const data = await fetchStations();
        if (mounted) setStations(data);
      } catch { /* handled in fetcher */ }
      finally { if (mounted) setStationsLoading(false); }
    };
    load();
    return () => { mounted = false; };
  }, []);

  useEffect(() => {
    const disconnect = connectNowPlayingStream({
      onSnapshot: (data) => {
        setNowPlaying(data.nowPlaying || {});
        setNowPlayingLoading(false);
      },
      onUpdate: () => {
        // No-op: snapshots already contain the full state.
      },
      onFailure: (failure) => {
        console.error('Błąd źródła nowplaying:', failure.source, failure.error);
      },
      onError: () => {
        setNowPlayingLoading(false);
      },
    });

    return () => {
      disconnect();
    };
  }, []);

  return (
    <StationsContext.Provider value={{ stations, stationsLoading, nowPlaying, nowPlayingLoading, searchQuery, setSearchQuery }}>
      {children}
    </StationsContext.Provider>
  );
}

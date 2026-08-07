import { useCallback, useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { Calendar, ChevronLeft, ChevronRight, Loader2, Radio, User } from 'lucide-react';
import type { SongInfo, Station } from '@/lib/types';
import { getMobileDayMenuPosition, type MobileDayMenuPosition } from './mobileDayMenuPosition';
import { getApiUrl } from '@/lib/apiUrls';

interface ScheduleItem {
  time: string;
  timeEnd?: string;
  presenter: string;
  show?: string;
  isBreak?: boolean;
  avatar?: string;
  status?: 'current' | 'past' | 'upcoming';
}

interface RadioPartyScheduleWidgetProps {
  station: Station;
  currentTrack?: SongInfo | null;
  isPlaying: boolean;
  color: string;
  scheduleEndpoint?: string;
}

const WEEKDAYS = [
  { label: 'Poniedziałek', value: 1 },
  { label: 'Wtorek', value: 2 },
  { label: 'Środa', value: 3 },
  { label: 'Czwartek', value: 4 },
  { label: 'Piątek', value: 5 },
  { label: 'Sobota', value: 6 },
  { label: 'Niedziela', value: 0 },
];

function timeToMinutes(timeStr: string): number | null {
  const parts = timeStr.split(':');
  if (parts.length !== 2) return null;
  return Number.parseInt(parts[0], 10) * 60 + Number.parseInt(parts[1], 10);
}

function normalizeEndMinutes(startMinutes: number, endMinutes: number): number {
  return endMinutes <= startMinutes ? 24 * 60 : endMinutes;
}

function enrichScheduleWithStatus(schedule: ScheduleItem[], targetDay: number): ScheduleItem[] {
  const today = new Date().getDay();
  const isToday = targetDay === today;

  if (!isToday) {
    return schedule.map((item) => ({
      ...item,
      status: 'upcoming' as const,
    }));
  }

  const now = new Date();
  const currentMinutes = now.getHours() * 60 + now.getMinutes();

  return schedule.map((item) => {
    const startMinutes = timeToMinutes(item.time);
    const endMinutes = timeToMinutes(item.timeEnd || '');

    let status: 'current' | 'past' | 'upcoming' = 'upcoming';

    if (startMinutes !== null && endMinutes !== null) {
      const normalizedEnd = normalizeEndMinutes(startMinutes, endMinutes);
      if (currentMinutes >= startMinutes && currentMinutes < normalizedEnd) status = 'current';
      else if (currentMinutes >= normalizedEnd) status = 'past';
    }

    return { ...item, status };
  });
}

export function RadioPartyScheduleWidget({
  station,
  currentTrack,
  isPlaying,
  color,
  scheduleEndpoint,
}: RadioPartyScheduleWidgetProps) {
  const today = new Date().getDay();
  const [selectedDay, setSelectedDay] = useState(today);
  const [schedule, setSchedule] = useState<ScheduleItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const [dayMenuPosition, setDayMenuPosition] = useState<MobileDayMenuPosition | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const dayMenuButtonRef = useRef<HTMLButtonElement>(null);
  const dayMenuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const fetchSchedule = async () => {
      setLoading(true);
      setError(null);
      setNotice(null);

      try {
        const url = new URL(getApiUrl(scheduleEndpoint || '/schedule/radioparty'));
        url.searchParams.set('day', String(selectedDay));
        const response = await fetch(url);
        if (!response.ok) {
          const isToday = selectedDay === today;
          throw new Error(isToday ? 'Brak ramówki na dzisiaj' : 'Brak ramówki na wybrany dzień');
        }

        const data = await response.json() as { schedule?: ScheduleItem[]; notice?: string };
        const enriched = enrichScheduleWithStatus(data.schedule || [], selectedDay);
        setSchedule(enriched);
        setNotice(data.notice || null);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Błąd pobierania ramówki');
        setSchedule([]);
      } finally {
        setLoading(false);
      }
    };

    fetchSchedule();
  }, [selectedDay, scheduleEndpoint, today]);

  const handlePrevDay = () => {
    setSelectedDay((prev) => (prev - 1 + 7) % 7);
  };

  const handleNextDay = () => {
    setSelectedDay((prev) => (prev + 1) % 7);
  };

  const updateDayMenuPosition = useCallback(() => {
    const button = dayMenuButtonRef.current;
    if (!button) return;

    const rect = button.getBoundingClientRect();
    setDayMenuPosition(getMobileDayMenuPosition(rect, window.innerHeight));
  }, []);

  useEffect(() => {
    if (!isDropdownOpen) return;

    const button = dayMenuButtonRef.current;
    const scrollContainer = button?.closest<HTMLElement>('.overflow-y-auto');
    const handleViewportChange = () => updateDayMenuPosition();

    window.addEventListener('resize', handleViewportChange);
    scrollContainer?.addEventListener('scroll', handleViewportChange, { passive: true });

    return () => {
      window.removeEventListener('resize', handleViewportChange);
      scrollContainer?.removeEventListener('scroll', handleViewportChange);
    };
  }, [isDropdownOpen, updateDayMenuPosition]);

  return (
    <div className="space-y-4" data-station={station.shortName} aria-label={`Ramówka ${station.name}`}>
      <div className="pt-8 hidden md:block">
        <div
          className="relative rounded-lg border border-neutral-800/30 bg-neutral-800/10 p-1 overflow-hidden"
          style={{ display: 'grid', gridTemplateColumns: '2.5rem 1fr 2.5rem' }}
        >
          <button
            onClick={handlePrevDay}
            className="p-2 rounded-md transition-colors z-10 text-neutral-400"
            aria-label="Poprzedni dzień"
          >
            <ChevronLeft className="w-5 h-5" />
          </button>

          <div className="flex gap-0.5 relative z-10">
            {WEEKDAYS.map((day) => (
              <button
                key={day.value}
                onClick={() => setSelectedDay(day.value)}
                className={`flex-1 px-2 py-2 rounded-md font-medium text-xs transition-all ${
                  selectedDay === day.value
                    ? `${color} bg-opacity-100 text-white`
                    : 'text-neutral-400 hover:text-neutral-300 bg-transparent'
                } ${day.value === today ? 'ring-1 ring-inset ring-neutral-600' : ''}`}
              >
                {day.label}
              </button>
            ))}
          </div>

          <button
            onClick={handleNextDay}
            className="p-2 rounded-md transition-colors z-10 text-neutral-400"
            aria-label="Następny dzień"
          >
            <ChevronRight className="w-5 h-5" />
          </button>
        </div>

        {selectedDay !== today && (
          <div className="mt-3 flex justify-center">
            <button
              onClick={() => setSelectedDay(today)}
              className="text-xs px-4 py-2 rounded-lg bg-neutral-800/50 text-neutral-400 hover:bg-neutral-800 hover:text-neutral-300 transition-all border border-neutral-700/50"
            >
              ← Dzisiaj
            </button>
          </div>
        )}
      </div>

      <div className="relative md:hidden">
        <div className="space-y-2">
          <button
            type="button"
            ref={dayMenuButtonRef}
            onClick={() => {
              if (!isDropdownOpen) updateDayMenuPosition();
              setIsDropdownOpen(!isDropdownOpen);
            }}
            aria-expanded={isDropdownOpen}
            aria-controls="mobile-schedule-day-menu"
            className={`w-full px-4 py-3 rounded-lg border transition-all flex items-center justify-between ${
              isDropdownOpen
                ? `${color} border-transparent text-white`
                : 'border-neutral-800/30 bg-neutral-800/10 text-neutral-300 hover:bg-neutral-800/20'
            }`}
          >
            <span className="flex items-center gap-2">
              <Calendar className="w-4 h-4" />
              {WEEKDAYS.find((d) => d.value === selectedDay)?.label}
            </span>
            <ChevronLeft className={`w-4 h-4 transition-transform ${isDropdownOpen ? 'rotate-90' : '-rotate-90'}`} />
          </button>

          {isDropdownOpen && dayMenuPosition && typeof document !== 'undefined' && createPortal(
            <div
              ref={dayMenuRef}
              id="mobile-schedule-day-menu"
              className="fixed z-30 touch-pan-y overflow-y-auto overscroll-contain rounded-lg border border-neutral-700 bg-neutral-900 shadow-2xl [-webkit-overflow-scrolling:touch]"
              style={dayMenuPosition}
              onTouchStart={(event) => event.stopPropagation()}
              onTouchEnd={(event) => event.stopPropagation()}
              onWheel={(event) => event.stopPropagation()}
            >
              {WEEKDAYS.map((day) => (
                <button
                  type="button"
                  key={day.value}
                  onClick={() => {
                    setSelectedDay(day.value);
                    setIsDropdownOpen(false);
                  }}
                  className={`w-full px-4 py-2.5 text-left transition-all border-b border-neutral-800/20 last:border-b-0 ${
                    selectedDay === day.value
                      ? `${color} text-white`
                      : 'text-neutral-400 hover:bg-neutral-800/30 hover:text-neutral-300'
                  } ${day.value === today ? 'font-medium' : ''}`}
                >
                  {day.label} {day.value === today && '(dzisiaj)'}
                </button>
              ))}
            </div>,
            document.body,
          )}

          {selectedDay !== today && (
            <button
              onClick={() => setSelectedDay(today)}
              className="w-full text-xs px-4 py-2 rounded-lg bg-neutral-800/50 text-neutral-400 hover:bg-neutral-800 hover:text-neutral-300 transition-all border border-neutral-700/50"
            >
              ← Wróć do dzisiaj
            </button>
          )}
        </div>
      </div>

      <div className="bg-neutral-900/50 rounded-2xl border border-neutral-800/50 overflow-hidden">
        {loading && (
          <div className="flex items-center justify-center py-12 gap-2 text-neutral-500">
            <Loader2 className="w-5 h-5 animate-spin" />
            <span>Ładowanie ramówki...</span>
          </div>
        )}

        {error && <div className="p-4 text-center text-red-400 text-sm">{error}</div>}

        {!loading && !error && schedule.length === 0 && notice && (
          <div className="p-4 text-center text-neutral-400 text-sm leading-relaxed">{notice}</div>
        )}

        {!loading && !error && schedule.length === 0 && !notice && (
          <div className="p-4 text-center text-neutral-500 text-sm">Brak ramówki na wybrany dzień</div>
        )}

        {!loading && !error && schedule.length > 0 && (
          <div className="divide-y divide-neutral-800">
            {schedule.map((item, idx) => {
              const isCurrent = item.status === 'current';
              const isPast = item.status === 'past';
              const isBreak = item.isBreak;

              return (
                <div
                  key={idx}
                  className={`p-4 flex items-center gap-4 transition-all ${
                    isCurrent ? 'bg-neutral-800/30' : isPast ? 'opacity-50' : 'hover:bg-neutral-800/30 group'
                  }`}
                >
                  <div
                    className={`text-sm font-mono w-16 text-center flex-shrink-0 ${
                      isCurrent ? 'text-green-400 font-bold animate-pulse' : 'text-neutral-500'
                    }`}
                  >
                    {isCurrent ? <span className="block text-xs leading-tight">TERAZ</span> : <span>{item.time}</span>}
                  </div>

                  <div
                    className={`w-10 h-10 rounded flex items-center justify-center flex-shrink-0 overflow-hidden ${
                      isCurrent && item.avatar
                        ? 'bg-neutral-800'
                        : isCurrent
                        ? `${color} text-white text-xs font-bold`
                        : isBreak
                        ? 'bg-neutral-800 text-neutral-600'
                        : 'bg-neutral-800 text-neutral-600'
                    }`}
                  >
                    {isCurrent && item.avatar ? (
                      <img src={item.avatar} alt={item.presenter} className="w-full h-full object-cover" />
                    ) : isBreak ? (
                      <Radio className="w-5 h-5" />
                    ) : (
                      <User className="w-5 h-5" />
                    )}
                  </div>

                  <div className="flex-1 min-w-0">
                    <div className={`font-medium truncate ${isCurrent ? 'text-green-400' : 'text-white'}`}>
                      {isCurrent && !isBreak ? currentTrack?.title || 'Brak informacji' : item.presenter}
                    </div>
                    <div className="text-sm text-neutral-400 truncate">
                      {isBreak
                        ? `do ${item.timeEnd}`
                        : `${item.show ? `${item.show} • ` : ''}${item.time}${item.timeEnd ? `-${item.timeEnd}` : ''}`}
                    </div>
                  </div>

                  {isCurrent && isPlaying && (
                    <div className="flex items-end gap-1 h-4 animate-eq flex-shrink-0">
                      <div className="w-0.5 bg-green-500 rounded-t-sm eq-bar h-1/2" />
                      <div className="w-0.5 bg-green-500 rounded-t-sm eq-bar h-3/4" />
                      <div className="w-0.5 bg-green-500 rounded-t-sm eq-bar h-1/2" />
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}

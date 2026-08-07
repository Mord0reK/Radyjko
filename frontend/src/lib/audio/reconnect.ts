const INITIAL_RECONNECT_DELAY_MS = 1_000;
const MAX_RECONNECT_DELAY_MS = 15_000;

export function getReconnectDelay(attempt: number): number {
  return Math.min(
    INITIAL_RECONNECT_DELAY_MS * 2 ** Math.max(0, attempt),
    MAX_RECONNECT_DELAY_MS,
  );
}

export function shouldSchedulePollingAlarm(
  currentAlarm: number | null,
  nextPoll: number,
): boolean {
  return currentAlarm === null || currentAlarm > nextPoll;
}

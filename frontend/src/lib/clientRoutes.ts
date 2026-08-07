export function getRouteStationName(pathname: string): string | null {
  const segments = pathname.split("/").filter(Boolean);
  if (segments.length === 0) return null;
  if (segments.length !== 1) return null;

  try {
    return decodeURIComponent(segments[0]);
  } catch {
    return null;
  }
}

export function getStationPath(shortName: string): string {
  return `/${encodeURIComponent(shortName)}`;
}

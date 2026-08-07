function toProxyUrl(
  value: string,
  manifestUrl: URL,
  createResourceUrl: (resourceUrl: string) => string,
): string {
  if (!value || value.startsWith("#")) return value;
  if (value.startsWith("data:")) return value;

  const absoluteUrl = new URL(value, manifestUrl).toString();
  return createResourceUrl(absoluteUrl);
}

export function rewriteM3U8Manifest(
  manifest: string,
  sourceUrl: string,
  createResourceUrl: (resourceUrl: string) => string,
): string {
  const manifestUrl = new URL(sourceUrl);

  return manifest
    .split("\n")
    .map((line) => {
      if (!line || line.startsWith("#")) {
        if (line.includes('URI="')) {
          return line.replace(/URI="([^"]+)"/g, (_match, uri: string) => {
            const proxied = toProxyUrl(uri, manifestUrl, createResourceUrl);
            return `URI="${proxied}"`;
          });
        }
        return line;
      }

      return toProxyUrl(line.trim(), manifestUrl, createResourceUrl);
    })
    .join("\n");
}

import type { FetchResult } from "@/lib/types";

export function withTimeout<T>(
  promise: Promise<T>,
  ms: number,
  sourceName: string
): Promise<FetchResult<T>> {
  return Promise.race([
    promise.then((data) => ({ success: true, data, source: sourceName })),
    new Promise<FetchResult<T>>((resolve) =>
      setTimeout(
        () =>
          resolve({
            success: false,
            data: null,
            source: sourceName,
            error: "timeout",
          }),
        ms
      )
    ),
  ]).catch((error) => ({
    success: false,
    data: null,
    source: sourceName,
    error: error.message,
  }));
}

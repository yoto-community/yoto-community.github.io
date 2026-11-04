export interface FetchJsonOptions {
  token?: string;
  retries?: number;
  timeoutMs?: number;
}

export class HttpError extends Error {
  constructor(
    public readonly status: number,
    url: string,
  ) {
    super(`HTTP ${status} for ${url}`);
  }
}

function retryDelaySeconds(header: string, resetHeader: string | null): number {
  const numeric = Number(header);
  const parsedDate = header !== '' && Number.isNaN(numeric) ? Date.parse(header) : Number.NaN;
  const reset = Number(resetHeader ?? '0') - Date.now() / 1000;

  if (header !== '' && Number.isFinite(numeric)) return numeric;
  if (Number.isFinite(parsedDate)) return (parsedDate - Date.now()) / 1000;
  if (Number.isFinite(reset) && reset > 0) return reset;
  return 1;
}

export async function fetchJson<T>(
  url: string,
  options: FetchJsonOptions = {},
  fetchImpl: typeof fetch = fetch,
): Promise<T> {
  const requested = options.retries ?? 3;
  // Non-finite values (NaN, Infinity) fall back to the default so the loop always terminates.
  const retries = Number.isFinite(requested) ? Math.max(0, Math.trunc(requested)) : 3;
  for (let attempt = 0; ; attempt += 1) {
    const response = await fetchImpl(url, {
      headers: {
        Accept: 'application/vnd.github+json',
        'User-Agent': 'awesome-yoto',
        ...(options.token ? { Authorization: `Bearer ${options.token}` } : {}),
      },
      signal: AbortSignal.timeout(options.timeoutMs ?? 10_000),
    });

    if (response.status === 403 || response.status === 429) {
      if (attempt >= retries) throw new HttpError(response.status, url);
      const seconds = retryDelaySeconds(
        response.headers.get('retry-after') ?? '',
        response.headers.get('x-ratelimit-reset'),
      );
      await new Promise((resolve) =>
        setTimeout(resolve, Math.max(0, Math.min(seconds, 30)) * 1000),
      );
      continue;
    }
    if (!response.ok) throw new HttpError(response.status, url);
    return (await response.json()) as T;
  }
}

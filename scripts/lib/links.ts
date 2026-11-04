export interface LinkResult {
  url: string;
  ok: boolean;
  status: number;
}

// Some hosts refuse HEAD (403/405/501) or answer it unreliably (429/5xx); a GET
// settles those cases. Anything else is taken at face value.
const RETRY_WITH_GET = new Set([403, 405, 429, 500, 501, 502, 503, 504]);
const TIMEOUT_MS = 10_000;

export async function checkUrl(url: string, fetchImpl: typeof fetch = fetch): Promise<LinkResult> {
  const request = (method: string) =>
    fetchImpl(url, {
      redirect: 'follow',
      method,
      // A fresh signal per request: a slow HEAD must not eat the GET's budget.
      signal: AbortSignal.timeout(TIMEOUT_MS),
      headers: { 'user-agent': 'awesome-yoto-link-check' },
    });

  try {
    let response = await request('HEAD');
    if (RETRY_WITH_GET.has(response.status)) {
      response = await request('GET');
    }
    return { url, ok: response.status < 400, status: response.status };
  } catch {
    return { url, ok: false, status: 0 };
  }
}

export function buildTargets(
  projects: Array<{ name: string; url: string; repo?: string }>,
): Map<string, string[]> {
  const targets = new Map<string, string[]>();
  for (const project of projects) {
    for (const url of [project.url, project.repo].filter((value): value is string =>
      Boolean(value),
    )) {
      targets.set(url, [...(targets.get(url) ?? []), project.name]);
    }
  }
  return targets;
}

// A cell must never break the table: `|` would split it and a newline would end it.
const cell = (value: string) => value.replace(/\|/g, '\\|').replace(/[\r\n]+/g, ' ');

export function renderReport(
  results: LinkResult[],
  targets: Map<string, string[]>,
  date: string,
): { content: string; dead: number } {
  const dead = results.filter((result) => !result.ok);
  const rows = dead.map(
    (result) =>
      `| ${cell([...new Set(targets.get(result.url) ?? [])].join(', '))} | ${cell(result.url)} | ${result.status || 'network error'} |`,
  );
  const table = ['| Project | URL | Status |', '|---|---|---|', ...rows].join('\n');
  return {
    content: `# Dead links\n\n${dead.length} of ${results.length} links failed on ${date}.\n\n${table}\n`,
    dead: dead.length,
  };
}

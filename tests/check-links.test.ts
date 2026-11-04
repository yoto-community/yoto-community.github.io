import { describe, expect, it } from 'vitest';
import { buildTargets, renderReport, type LinkResult } from '../scripts/lib/links';

const sharedUrl = 'https://example.com/shared';
const dead: LinkResult = { url: sharedUrl, ok: false, status: 404 };
const alive: LinkResult = { url: 'https://example.com/alive', ok: true, status: 200 };

const tableRows = (content: string) =>
  content.split('\n').filter((line) => line.startsWith('| ') && !line.startsWith('| Project'));

describe('buildTargets', () => {
  it('checks a shared URL once and keeps every project name', () => {
    const targets = buildTargets([
      { name: 'Alpha', url: sharedUrl },
      { name: 'Beta', url: sharedUrl },
    ]);
    expect([...targets]).toEqual([[sharedUrl, ['Alpha', 'Beta']]]);
  });

  it('collects the repo URL and skips an absent one', () => {
    const targets = buildTargets([
      { name: 'Alpha', url: 'https://alpha.example.com', repo: 'https://github.com/alpha/alpha' },
      { name: 'Beta', url: 'https://beta.example.com' },
    ]);
    expect([...targets.keys()]).toEqual([
      'https://alpha.example.com',
      'https://github.com/alpha/alpha',
      'https://beta.example.com',
    ]);
  });
});

describe('renderReport', () => {
  it('lists one row per dead URL, naming every project that shares it', () => {
    const targets = buildTargets([
      { name: 'Alpha', url: sharedUrl },
      { name: 'Beta', url: sharedUrl },
    ]);
    const { content, dead: count } = renderReport([dead, alive], targets, '2026-11-04');

    expect(count).toBe(1);
    const rows = tableRows(content);
    expect(rows).toHaveLength(1);
    expect(rows[0]).toContain('Alpha, Beta');
    expect(rows[0]).toContain(sharedUrl);
    expect(rows[0]).toContain('404');
  });

  it('escapes pipes and newlines in a project name', () => {
    const targets = buildTargets([{ name: 'Pipe | Name\nSplit', url: sharedUrl }]);
    const { content } = renderReport([dead], targets, '2026-11-04');
    const rows = tableRows(content);

    expect(rows).toHaveLength(1);
    expect(rows[0]).toContain('Pipe \\| Name Split');
  });

  it('renders a status of 0 as a network error', () => {
    const targets = buildTargets([{ name: 'Alpha', url: sharedUrl }]);
    const { content } = renderReport(
      [{ url: sharedUrl, ok: false, status: 0 }],
      targets,
      '2026-11-04',
    );
    expect(tableRows(content)[0]).toContain('network error');
  });

  it('counts dead links over the total in the header', () => {
    const targets = buildTargets([{ name: 'Alpha', url: sharedUrl }]);
    const { content } = renderReport([dead, alive, alive], targets, '2026-11-04');
    expect(content).toContain('# Dead links');
    expect(content).toContain('1 of 3 links failed on 2026-11-04.');
  });

  it('still renders a valid table when every link is healthy', () => {
    const { content, dead: count } = renderReport([alive], new Map(), '2026-11-04');
    expect(count).toBe(0);
    expect(content).toContain('0 of 1 links failed on 2026-11-04.');
    expect(content).toContain('| Project | URL | Status |');
    expect(tableRows(content)).toHaveLength(0);
  });
});

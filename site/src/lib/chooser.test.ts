import { describe, expect, it } from 'vitest';
import type { Project } from '../../../scripts/lib/types';
import {
  GOALS,
  LEVELS,
  PLATFORMS,
  goalFilterHref,
  myoStep,
  parseChooserState,
  projectsFilterHref,
  reasonLabels,
  recommendProjects,
  scoreProject,
  serializeChooserState,
  type ChooserState,
} from './chooser';

const state = (overrides: Partial<ChooserState> = {}): ChooserState => ({
  goal: 'youtube',
  platform: 'any',
  level: 'advanced',
  ...overrides,
});

function project(overrides: Partial<Project> & { slug: string }): Project {
  return {
    name: overrides.slug,
    url: `https://example.com/${overrides.slug}`,
    description: `A test tool called ${overrides.slug}.`,
    category: 'create',
    tags: [],
    author: 'Test',
    license: 'MIT',
    status: 'active',
    official: false,
    platforms: ['web'],
    added: '2026-01-01',
    ...overrides,
  };
}

describe('scoreProject', () => {
  it('rewards the goal category and tags', () => {
    const tagged = project({ slug: 'tagged', tags: ['youtube'] });
    const untagged = project({ slug: 'untagged' });
    expect(scoreProject(tagged, state())).toBeGreaterThan(scoreProject(untagged, state()));
  });

  it('treats web and CLI tools as usable on desktop platforms', () => {
    const mobile = project({ slug: 'mobile', platforms: ['ios'] });
    const web = project({ slug: 'web', platforms: ['web'] });
    const cli = project({ slug: 'cli', platforms: ['cli'] });
    expect(scoreProject(web, state({ platform: 'macos' }))).toBeGreaterThan(
      scoreProject(mobile, state({ platform: 'macos' })),
    );
    expect(scoreProject(cli, state({ platform: 'windows' }))).toBeGreaterThan(
      scoreProject(mobile, state({ platform: 'windows' })),
    );
  });

  it('penalises terminal, self-hosted and API-key tools in simple mode', () => {
    const basic = project({ slug: 'basic' });
    const cli = project({ slug: 'cli', platforms: ['cli'] });
    const api = project({ slug: 'api', requires: ['yoto-api-key'] });
    const hosted = project({ slug: 'hosted', requires: ['self-hosted'] });
    expect(scoreProject(basic, state({ level: 'simple' }))).toBeGreaterThan(
      scoreProject(cli, state({ level: 'simple' })),
    );
    expect(scoreProject(basic, state({ level: 'simple' }))).toBeGreaterThan(
      scoreProject(api, state({ level: 'simple' })),
    );
    expect(scoreProject(basic, state({ level: 'simple' }))).toBeGreaterThan(
      scoreProject(hosted, state({ level: 'simple' })),
    );
  });

  it('penalises stale projects', () => {
    expect(scoreProject(project({ slug: 'old', status: 'stale' }), state())).toBeLessThan(
      scoreProject(project({ slug: 'new' }), state()),
    );
  });

  it('does not score a platform match alone', () => {
    const unrelated = project({ slug: 'unrelated', category: 'automate', platforms: ['web'] });
    expect(scoreProject(unrelated, state({ goal: 'youtube', platform: 'macos' }))).toBe(0);
  });

  it('matches only the selected platform family', () => {
    const web = project({ slug: 'web' });
    expect(scoreProject(web, state({ platform: 'macos' }))).toBeGreaterThan(
      scoreProject(web, state({ platform: 'ios' })),
    );
  });
});

describe('recommendProjects', () => {
  it('ranks the tagged, browser-first tool first for a simple YouTube task', () => {
    const projects = [
      project({ slug: 'louis', tags: ['youtube', 'myo'], platforms: ['web'] }),
      project({ slug: 'cli-tool', tags: ['youtube'], platforms: ['cli'] }),
      project({ slug: 'api-tool', tags: ['youtube'], requires: ['yoto-api-key'] }),
      project({ slug: 'unrelated', category: 'audio', tags: ['podcast'] }),
    ];
    const recs = recommendProjects(
      projects,
      state({ goal: 'youtube', platform: 'web', level: 'simple' }),
    );
    expect(recs[0]?.project.slug).toBe('louis');
    expect(recs).toHaveLength(3);
  });

  it('never recommends archived or deprecated projects', () => {
    const projects = [
      project({ slug: 'archived', tags: ['youtube'], status: 'archived' }),
      project({ slug: 'deprecated', tags: ['youtube'], status: 'deprecated' }),
      project({ slug: 'active', tags: ['youtube'] }),
    ];
    expect(recommendProjects(projects, state()).map((rec) => rec.project.slug)).toEqual(['active']);
  });

  it('does not pad results with unrelated categories', () => {
    const projects = [
      project({ slug: 'only', category: 'automate' }),
      project({ slug: 'elsewhere', category: 'create' }),
    ];
    expect(recommendProjects(projects, state({ goal: 'automate' }))).toHaveLength(1);
  });

  it('breaks ties by stars then name', () => {
    const projects = [
      project({ slug: 'beta', name: 'Beta' }),
      project({ slug: 'alpha', name: 'Alpha' }),
      project({ slug: 'starred', name: 'Zulu', meta: { stars: 10 } }),
    ];
    expect(recommendProjects(projects, state()).map((rec) => rec.project.slug)).toEqual([
      'starred',
      'alpha',
      'beta',
    ]);
  });

  it('respects the limit and does not mutate its input', () => {
    const projects = [
      project({ slug: 'one' }),
      project({ slug: 'two' }),
      project({ slug: 'three' }),
    ];
    const before = projects.map((item) => item.slug);
    expect(recommendProjects(projects, state(), 2)).toHaveLength(2);
    expect(projects.map((item) => item.slug)).toEqual(before);
  });

  it('always attaches at least one reason', () => {
    const recs = recommendProjects([project({ slug: 'one', tags: ['youtube'] })], state());
    expect(recs[0]?.reasons.length).toBeGreaterThan(0);
  });
});

describe('chooser state', () => {
  it('round-trips a complete state', () => {
    const value = { goal: 'audiobook', platform: 'macos', level: 'simple' } as const;
    expect(parseChooserState(`?${serializeChooserState(value)}`)).toEqual(value);
  });

  it('returns null when an answer is missing or unknown', () => {
    expect(parseChooserState('')).toBeNull();
    expect(parseChooserState('?goal=youtube&platform=any')).toBeNull();
    expect(parseChooserState('?goal=nope&platform=any&level=simple')).toBeNull();
    expect(parseChooserState('?goal=youtube&platform=nope&level=simple')).toBeNull();
  });

  it('exposes exactly the three question sets', () => {
    expect(GOALS).toHaveLength(7);
    expect(PLATFORMS).toHaveLength(8);
    expect(LEVELS).toHaveLength(2);
  });
});

describe('reasonLabels', () => {
  const rec = {
    project: project({ slug: 'louis', tags: ['youtube'] }),
    score: 10,
    reasons: ['goal', 'platform', 'simple'] as const,
  };

  it('explains the choice in English without a score', () => {
    expect(
      reasonLabels(
        { ...rec, reasons: [...rec.reasons] },
        state({ goal: 'youtube', platform: 'macos', level: 'simple' }),
        'en',
      ),
    ).toEqual(['Made for YouTube', 'Works on macOS', 'No terminal or API key']);
  });

  it('localises the reasons', () => {
    expect(
      reasonLabels(
        { ...rec, reasons: [...rec.reasons] },
        state({ goal: 'youtube', platform: 'macos', level: 'simple' }),
        'fr',
      ),
    ).toEqual(['Pensé pour YouTube', 'Fonctionne sur macOS', 'Sans terminal ni clé API']);
  });
});

describe('filter links', () => {
  it('prefills the category and the first goal tag', () => {
    expect(goalFilterHref('youtube')).toBe('/projects/?cat=create&tag=youtube');
    expect(projectsFilterHref({ goal: 'backup', platform: 'any', level: 'simple' })).toBe(
      '/projects/?cat=backup',
    );
    expect(goalFilterHref('youtube', '/fr/projects/')).toBe('/fr/projects/?cat=create&tag=youtube');
  });
});

describe('myoStep', () => {
  it('maps source goals to the MYO step where the tool is used', () => {
    expect(myoStep('youtube')).toBe(1);
    expect(myoStep('files')).toBe(2);
    expect(myoStep('podcast')).toBe(1);
    expect(myoStep('audiobook')).toBe(1);
    expect(myoStep('backup')).toBeUndefined();
  });
});

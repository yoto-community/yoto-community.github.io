import { describe, expect, it } from 'vitest';
import { createLoader } from '../scripts/lib/load';
import {
  recommendProjects,
  type ChooserPlatform,
  type ChooserState,
  type Goal,
  type Level,
} from '../site/src/lib/chooser';

const projects = createLoader().projects();
const slugsFor = (state: ChooserState) =>
  recommendProjects(projects, state).map((rec) => rec.project.slug);
const categoryOf = (slug: string) => projects.find((project) => project.slug === slug)?.category;

describe('chooser personas', () => {
  it('parent: YouTube on macOS, no install', () => {
    const slugs = slugsFor({ goal: 'youtube', platform: 'macos', level: 'simple' });
    expect(slugs[0]).toBe('louis');
    for (const slug of slugs) expect(categoryOf(slug), slug).toBe('create');
  });

  it('Windows user: YouTube, no install', () => {
    const slugs = slugsFor({ goal: 'youtube', platform: 'windows', level: 'simple' });
    expect(slugs[0]).toBe('louis');
    expect(slugs).toContain('yoto-media-manager');
  });

  it('Mac user: audiobook, no install', () => {
    expect(slugsFor({ goal: 'audiobook', platform: 'macos', level: 'simple' })[0]).toBe(
      'yoto-book-maker',
    );
  });

  it('self-hoster: podcast', () => {
    const slugs = slugsFor({ goal: 'podcast', platform: 'self-hosted', level: 'advanced' });
    expect(slugs[0]).toBe('podcast-catalogue');
    for (const slug of slugs) expect(categoryOf(slug), slug).toBe('audio');
  });

  it('developer: API tools', () => {
    const slugs = slugsFor({ goal: 'develop', platform: 'any', level: 'advanced' });
    expect(slugs[0]).toBe('yoto-api');
    for (const slug of slugs) expect(categoryOf(slug), slug).toBe('develop');
  });

  it('backup: only backup tools, never a stale one first', () => {
    const slugs = slugsFor({ goal: 'backup', platform: 'any', level: 'simple' });
    expect(slugs[0]).toBe('yoto-tools');
    for (const slug of slugs) expect(categoryOf(slug), slug).toBe('backup');
  });

  it('automation: never recommends the deprecated integration', () => {
    const slugs = slugsFor({ goal: 'automate', platform: 'any', level: 'simple' });
    expect(slugs.length).toBeGreaterThan(0);
    for (const slug of slugs) expect(categoryOf(slug), slug).toBe('automate');
    expect(slugs).not.toContain('yoto-ha');
  });

  it('never returns archived or deprecated projects for any answer combination', () => {
    const goals: Goal[] = [
      'youtube',
      'files',
      'podcast',
      'audiobook',
      'backup',
      'automate',
      'develop',
    ];
    const platforms: ChooserPlatform[] = [
      'any',
      'web',
      'windows',
      'macos',
      'linux',
      'android',
      'ios',
      'self-hosted',
    ];
    const levels: Level[] = ['simple', 'advanced'];

    for (const goal of goals) {
      for (const platform of platforms) {
        for (const level of levels) {
          const recs = recommendProjects(projects, { goal, platform, level });
          const slugs = recs.map((rec) => rec.project.slug);
          expect(recs.length).toBeLessThanOrEqual(3);
          expect(new Set(slugs).size).toBe(slugs.length);
          for (const rec of recs) {
            expect(['archived', 'deprecated']).not.toContain(rec.project.status);
            expect(rec.reasons.length).toBeGreaterThan(0);
            expect(rec.score).toBeGreaterThan(0);
          }
        }
      }
    }
  });

  it('computes a recommendation in well under 50 ms', () => {
    const start = performance.now();
    for (let index = 0; index < 100; index += 1) {
      recommendProjects(projects, { goal: 'youtube', platform: 'macos', level: 'simple' });
    }
    expect(performance.now() - start).toBeLessThan(50);
  });
});

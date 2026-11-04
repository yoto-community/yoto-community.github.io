import { describe, expect, it } from 'vitest';
import { langFromPath, localePath, otherLang, stripLocale } from '../site/src/lib/routes';

describe('localePath', () => {
  it('leaves English paths unchanged', () => {
    expect(localePath('en', '/projects/')).toBe('/projects/');
  });
  it('prefixes French paths', () => {
    expect(localePath('fr', '/projects/')).toBe('/fr/projects/');
  });
  it('handles the home path', () => {
    expect(localePath('fr', '/')).toBe('/fr/');
    expect(localePath('en', '/')).toBe('/');
  });
});

describe('langFromPath', () => {
  it('detects French', () => {
    expect(langFromPath('/fr/projects/')).toBe('fr');
    expect(langFromPath('/fr/')).toBe('fr');
  });
  it('defaults to English', () => {
    expect(langFromPath('/projects/')).toBe('en');
    expect(langFromPath('/french/')).toBe('en');
  });
});

describe('stripLocale', () => {
  it('removes the French prefix', () => {
    expect(stripLocale('/fr/p/louis/')).toBe('/p/louis/');
  });
  it('maps the French home to the root', () => {
    expect(stripLocale('/fr')).toBe('/');
    expect(stripLocale('/fr/')).toBe('/');
  });
  it('keeps English paths', () => {
    expect(stripLocale('/p/louis/')).toBe('/p/louis/');
  });
});

describe('otherLang', () => {
  it('toggles the locale', () => {
    expect(otherLang('en')).toBe('fr');
    expect(otherLang('fr')).toBe('en');
  });
});

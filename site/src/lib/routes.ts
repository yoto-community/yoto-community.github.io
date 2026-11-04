export type Lang = 'en' | 'fr';

export function localePath(lang: Lang, path: string): string {
  const clean = path.startsWith('/') ? path : `/${path}`;
  if (lang === 'en') return clean;
  return clean === '/' ? '/fr/' : `/fr${clean}`;
}

export function stripLocale(path: string): string {
  if (path === '/fr' || path === '/fr/') return '/';
  return path.startsWith('/fr/') ? path.slice(3) : path;
}

export function langFromPath(path: string): Lang {
  return path === '/fr' || path.startsWith('/fr/') ? 'fr' : 'en';
}

export function otherLang(lang: Lang): Lang {
  return lang === 'en' ? 'fr' : 'en';
}

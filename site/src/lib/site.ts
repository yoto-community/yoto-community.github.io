import { localePath, type Lang } from './routes';

export const SITE_URL = import.meta.env.SITE ?? 'https://yoto-community.github.io';
export const REPO_URL = 'https://github.com/yoto-community/yoto-community.github.io';

export function absoluteUrl(lang: Lang, path: string): string {
  return new URL(localePath(lang, path), SITE_URL).href;
}

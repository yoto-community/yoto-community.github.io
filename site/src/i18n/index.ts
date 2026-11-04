import { en, type MessageKey } from './en';
import { fr } from './fr';
import type { Lang } from '../lib/routes';

const dictionaries: Record<Lang, Record<MessageKey, string>> = { en, fr };

export function translate(dict: Record<string, string>, key: MessageKey): string {
  return dict[key] || en[key];
}

export function t(lang: Lang, key: MessageKey): string {
  return translate(dictionaries[lang], key);
}

export { en, fr };
export type { MessageKey };

import { en, type MessageKey } from './en';
import { fr } from './fr';
import type { Lang } from '../lib/routes';

const dictionaries: Record<Lang, Record<MessageKey, string>> = { en, fr };

export function translate(dict: Record<string, string>, key: MessageKey): string {
  return dict[key] || en[key];
}

export function t(lang: Lang, key: MessageKey, ...args: string[]): string {
  const translated = translate(dictionaries[lang], key);
  return args.length > 0 ? translated.replace('{0}', args[0]) : translated;
}

export { en, fr };
export type { MessageKey };

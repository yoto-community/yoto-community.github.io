import raw from '../generated/changelog.json';
import type { Changelog } from '../../../scripts/lib/types';

export const changelog = raw as unknown as Changelog;

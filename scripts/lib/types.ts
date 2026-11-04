export type Status = 'active' | 'maintained' | 'stale' | 'archived' | 'deprecated';
export type Platform =
  | 'web'
  | 'ios'
  | 'android'
  | 'macos'
  | 'windows'
  | 'linux'
  | 'cli'
  | 'home-assistant'
  | 'hardware'
  | 'api';
export type Requirement =
  'yoto-account' | 'yoto-api-key' | 'self-hosted' | 'nfc-writer' | 'paid-hardware';
export type Warning = 'legal-backup' | 'unofficial-api' | 'experimental' | 'paid';
export interface LocalizedText {
  en: string;
  fr: string;
}
export interface Category {
  slug: string;
  label: LocalizedText;
  description: LocalizedText;
  icon: string;
  order: number;
}
export interface Collection {
  slug: string;
  title: LocalizedText;
  description: LocalizedText;
  items: string[];
}
export interface ProjectFile {
  name: string;
  url: string;
  repo?: string;
  description: string;
  descriptionFr?: string;
  category: string;
  tags: string[];
  author: string;
  license: string;
  status: Status;
  official: boolean;
  platforms: Platform[];
  requires?: Requirement[];
  warning?: Warning;
  deprecatedBy?: string;
  featured?: boolean;
  featuredReason?: string;
  added: string;
}
export interface ProjectMeta {
  stars?: number;
  lastCommit?: string;
  archived?: boolean;
  licenseDetected?: string;
}
export interface Project extends ProjectFile {
  slug: string;
  meta?: ProjectMeta;
}

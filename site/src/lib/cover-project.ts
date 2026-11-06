import { LABEL_PRESETS, countLabels, presetById, type LabelSheetConfig } from './label-sheet';

export type CardLayout = 'square-cover-title' | 'fill-card';

export const DEFAULT_TITLE_FONT_SIZE = 14;
export const MIN_ZOOM = 0.2;
export const MAX_ZOOM = 8;
export const MAX_TITLE_LENGTH = 200;

export interface CoverImage {
  id: string;
  fileName: string;
  mimeType: string;
  blob: Blob;
}

export interface CoverSlot {
  image: CoverImage | null;
  zoom: number;
  panX: number;
  panY: number;
  title: string;
}

export interface CoverProject {
  format: 1;
  name: string;
  sheetId: string;
  sheet: LabelSheetConfig;
  layout: CardLayout;
  roundedCorners: boolean;
  printCutLine: boolean;
  titleFontSize: number;
  offsetXMm: number;
  offsetYMm: number;
  slots: CoverSlot[];
}

export function emptySlot(): CoverSlot {
  return { image: null, zoom: 1, panX: 0, panY: 0, title: '' };
}

function clamp(value: number, min: number, max: number, fallback: number): number {
  return Math.min(max, Math.max(min, Number.isFinite(value) ? value : fallback));
}

export function clampZoom(value: number): number {
  return clamp(value, MIN_ZOOM, MAX_ZOOM, 1);
}

export function clampPan(value: number): number {
  return clamp(value, -1, 1, 0);
}

export function createProject(presetId = LABEL_PRESETS[0].id): CoverProject {
  const preset = presetById(presetId) ?? LABEL_PRESETS[0];
  return {
    format: 1,
    name: '',
    sheetId: preset.id,
    sheet: { ...preset.config },
    layout: 'square-cover-title',
    roundedCorners: true,
    printCutLine: true,
    titleFontSize: DEFAULT_TITLE_FONT_SIZE,
    offsetXMm: 0,
    offsetYMm: 0,
    slots: Array.from({ length: countLabels(preset.config) }, emptySlot),
  };
}

export function resizeSlots(project: CoverProject, count: number): CoverProject {
  return {
    ...project,
    slots: Array.from({ length: count }, (_, index) => project.slots[index] ?? emptySlot()),
  };
}

export function setSheet(
  project: CoverProject,
  sheetId: string,
  sheet: LabelSheetConfig,
): CoverProject {
  return {
    ...project,
    sheetId,
    sheet: { ...sheet },
    slots: Array.from(
      { length: countLabels(sheet) },
      (_, index) => project.slots[index] ?? emptySlot(),
    ),
  };
}

export function setSlotImage(
  project: CoverProject,
  index: number,
  image: CoverImage,
): CoverProject {
  if (index < 0 || index >= project.slots.length) return project;
  const slots = project.slots.slice();
  slots[index] = { ...slots[index], image, zoom: 1, panX: 0, panY: 0 };
  return { ...project, slots };
}

export function clearSlot(project: CoverProject, index: number): CoverProject {
  if (index < 0 || index >= project.slots.length) return project;
  const slots = project.slots.slice();
  slots[index] = emptySlot();
  return { ...project, slots };
}

export function clearAll(project: CoverProject): CoverProject {
  return { ...project, slots: project.slots.map(emptySlot) };
}

export function resetSlotPosition(project: CoverProject, index: number): CoverProject {
  return updateSlot(project, index, { zoom: 1, panX: 0, panY: 0 });
}

export function updateSlot(
  project: CoverProject,
  index: number,
  patch: Partial<Pick<CoverSlot, 'zoom' | 'panX' | 'panY' | 'title'>>,
): CoverProject {
  if (index < 0 || index >= project.slots.length) return project;
  const slot = project.slots[index];
  const next: CoverSlot = {
    ...slot,
    zoom: patch.zoom === undefined ? slot.zoom : clampZoom(patch.zoom),
    panX: patch.panX === undefined ? slot.panX : clampPan(patch.panX),
    panY: patch.panY === undefined ? slot.panY : clampPan(patch.panY),
    title: patch.title === undefined ? slot.title : patch.title.slice(0, MAX_TITLE_LENGTH),
  };
  const slots = project.slots.slice();
  slots[index] = next;
  return { ...project, slots };
}

export function filledCount(project: CoverProject): number {
  return project.slots.filter((slot) => slot.image !== null).length;
}

export function fillEmptySlots(
  project: CoverProject,
  images: CoverImage[],
): { project: CoverProject; added: number; skipped: number } {
  let next = project;
  let added = 0;
  for (const image of images) {
    const index = next.slots.findIndex((slot) => slot.image === null);
    if (index === -1) break;
    next = setSlotImage(next, index, image);
    added += 1;
  }
  return { project: next, added, skipped: images.length - added };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function isSheetConfig(value: unknown): value is LabelSheetConfig {
  if (!isRecord(value)) return false;
  return (
    (value.paper === 'a4' || value.paper === 'letter') &&
    [
      'columns',
      'rows',
      'labelWidthMm',
      'labelHeightMm',
      'marginXMm',
      'marginYMm',
      'gapXMm',
      'gapYMm',
    ].every((key) => typeof value[key] === 'number' && Number.isFinite(value[key] as number))
  );
}

function isImage(value: unknown): value is CoverImage {
  return (
    isRecord(value) &&
    typeof value.id === 'string' &&
    /^[A-Za-z0-9-]+$/.test(value.id) &&
    typeof value.fileName === 'string' &&
    typeof value.mimeType === 'string' &&
    value.blob instanceof Blob
  );
}

function isSlot(value: unknown): value is CoverSlot {
  return (
    isRecord(value) &&
    (value.image === null || isImage(value.image)) &&
    typeof value.zoom === 'number' &&
    typeof value.panX === 'number' &&
    typeof value.panY === 'number' &&
    typeof value.title === 'string'
  );
}

export function isCoverProject(value: unknown): value is CoverProject {
  if (!isRecord(value)) return false;
  const sheet = value.sheet;
  return (
    value.format === 1 &&
    typeof value.name === 'string' &&
    typeof value.sheetId === 'string' &&
    isSheetConfig(sheet) &&
    (value.layout === 'square-cover-title' || value.layout === 'fill-card') &&
    typeof value.roundedCorners === 'boolean' &&
    typeof value.printCutLine === 'boolean' &&
    typeof value.titleFontSize === 'number' &&
    typeof value.offsetXMm === 'number' &&
    typeof value.offsetYMm === 'number' &&
    Array.isArray(value.slots) &&
    value.slots.length === countLabels(sheet) &&
    value.slots.every(isSlot)
  );
}

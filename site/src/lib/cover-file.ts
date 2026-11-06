import {
  DEFAULT_TITLE_FONT_SIZE,
  MAX_TITLE_LENGTH,
  clampPan,
  clampZoom,
  emptySlot,
  type CardLayout,
  type CoverImage,
  type CoverProject,
  type CoverSlot,
} from './cover-project';
import {
  LABEL_PRESETS,
  countLabels,
  presetById,
  validateSheetConfig,
  type LabelSheetConfig,
} from './label-sheet';

export const NATIVE_FORMAT_VERSION = 1;

export type NativeLayout = 'SquareCoverWithTitle' | 'FillCard';

export interface NativeSlotDto {
  image?: string | null;
  zoom: number;
  panX: number;
  panY: number;
  title?: string | null;
}

export interface NativeCoverDto {
  format: number;
  sheet?: string | null;
  layout: NativeLayout;
  roundedCorners: boolean;
  printCutLine: boolean;
  titleFontSize: number;
  offsetXmm: number;
  offsetYmm: number;
  slots: NativeSlotDto[];
  sheetConfig?: LabelSheetConfig;
  name?: string;
}

export type CoverFileErrorCode = 'invalid' | 'newer-format';

export class CoverFileError extends Error {
  readonly code: CoverFileErrorCode;

  constructor(code: CoverFileErrorCode) {
    super(code);
    this.name = 'CoverFileError';
    this.code = code;
  }
}

const NATIVE_LAYOUT: Record<CardLayout, NativeLayout> = {
  'square-cover-title': 'SquareCoverWithTitle',
  'fill-card': 'FillCard',
};

const CARD_LAYOUT: Record<string, CardLayout> = {
  SquareCoverWithTitle: 'square-cover-title',
  FillCard: 'fill-card',
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function finite(value: unknown, fallback: number, min: number, max: number): number {
  return typeof value === 'number' && Number.isFinite(value)
    ? Math.min(max, Math.max(min, value))
    : fallback;
}

function positive(value: unknown, fallback: number): number {
  return typeof value === 'number' && Number.isFinite(value) && value > 0 ? value : fallback;
}

export function isSafeImagePath(path: string): boolean {
  return /^images\/[A-Za-z0-9][A-Za-z0-9._-]*$/.test(path) && !path.includes('..');
}

export function extensionForMime(mimeType: string, fileName: string): string {
  const byMime: Record<string, string> = {
    'image/png': 'png',
    'image/jpeg': 'jpg',
    'image/webp': 'webp',
    'image/gif': 'gif',
  };
  const fromMime = byMime[mimeType.toLowerCase()];
  if (fromMime) return fromMime;
  const fromName = fileName.split('.').pop()?.toLowerCase() ?? '';
  return ['png', 'jpg', 'jpeg', 'webp', 'gif'].includes(fromName) ? fromName : 'png';
}

export function mimeForPath(path: string): string {
  const ext = path.split('.').pop()?.toLowerCase() ?? '';
  const byExt: Record<string, string> = {
    png: 'image/png',
    jpg: 'image/jpeg',
    jpeg: 'image/jpeg',
    webp: 'image/webp',
    gif: 'image/gif',
    svg: 'image/svg+xml',
  };
  return byExt[ext] ?? 'application/octet-stream';
}

export function imagePathFor(image: CoverImage): string {
  return `images/${image.id}.${extensionForMime(image.mimeType, image.fileName)}`;
}

export function projectToDto(
  project: CoverProject,
  imagePaths: Map<string, string>,
): NativeCoverDto {
  return {
    format: NATIVE_FORMAT_VERSION,
    sheet: project.sheetId,
    layout: NATIVE_LAYOUT[project.layout],
    roundedCorners: project.roundedCorners,
    printCutLine: project.printCutLine,
    titleFontSize: project.titleFontSize,
    offsetXmm: project.offsetXMm,
    offsetYmm: project.offsetYMm,
    slots: project.slots.map((slot) => ({
      image: slot.image ? (imagePaths.get(slot.image.id) ?? null) : null,
      zoom: slot.zoom,
      panX: slot.panX,
      panY: slot.panY,
      title: slot.title,
    })),
    sheetConfig: { ...project.sheet },
    name: project.name,
  };
}

export function dtoToProject(
  value: unknown,
  imagesByPath: Map<string, CoverImage>,
): { project: CoverProject; notes: string[] } {
  if (!isRecord(value)) throw new CoverFileError('invalid');

  const format = typeof value.format === 'number' ? value.format : 0;
  if (format > NATIVE_FORMAT_VERSION) throw new CoverFileError('newer-format');

  const notes: string[] = [];
  const requestedSheet = typeof value.sheet === 'string' ? value.sheet : '';
  let sheet = presetById(requestedSheet)?.config;
  let sheetId = requestedSheet;

  if (
    !sheet &&
    isRecord(value.sheetConfig) &&
    validateSheetConfig(value.sheetConfig as unknown as LabelSheetConfig).length === 0
  ) {
    sheet = { ...(value.sheetConfig as unknown as LabelSheetConfig) };
    sheetId = 'custom';
  }
  if (!sheet) {
    sheet = LABEL_PRESETS[0].config;
    sheetId = LABEL_PRESETS[0].id;
    notes.push('sheet-fallback');
  }

  const rawSlots = Array.isArray(value.slots) ? value.slots : [];
  let missingImage = false;
  const slots: CoverSlot[] = Array.from({ length: countLabels(sheet) }, (_, index) => {
    const raw = rawSlots[index];
    if (!isRecord(raw)) return emptySlot();

    const path = typeof raw.image === 'string' ? raw.image : null;
    let image: CoverImage | null = null;
    if (path && isSafeImagePath(path)) {
      image = imagesByPath.get(path) ?? null;
      if (!image) missingImage = true;
    }

    return {
      image,
      zoom: clampZoom(positive(raw.zoom, 1)),
      panX: clampPan(finite(raw.panX, 0, -1, 1)),
      panY: clampPan(finite(raw.panY, 0, -1, 1)),
      title: typeof raw.title === 'string' ? raw.title.slice(0, MAX_TITLE_LENGTH) : '',
    };
  });
  if (missingImage) notes.push('missing-image');

  return {
    project: {
      format: 1,
      name: typeof value.name === 'string' ? value.name.slice(0, 100) : '',
      sheetId,
      sheet: { ...sheet },
      layout:
        typeof value.layout === 'string' && CARD_LAYOUT[value.layout]
          ? CARD_LAYOUT[value.layout]
          : 'square-cover-title',
      roundedCorners: value.roundedCorners !== false,
      printCutLine: value.printCutLine !== false,
      titleFontSize: finite(
        positive(value.titleFontSize, DEFAULT_TITLE_FONT_SIZE),
        DEFAULT_TITLE_FONT_SIZE,
        6,
        48,
      ),
      offsetXMm: finite(value.offsetXmm, 0, -20, 20),
      offsetYMm: finite(value.offsetYmm, 0, -20, 20),
      slots,
    },
    notes,
  };
}

export function parseProjectJson(
  text: string,
  imagesByPath: Map<string, CoverImage>,
): { project: CoverProject; notes: string[] } {
  let value: unknown;
  try {
    value = JSON.parse(text);
  } catch {
    throw new CoverFileError('invalid');
  }
  return dtoToProject(value, imagesByPath);
}

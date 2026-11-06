# YotoCover Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add YotoCover, a browser-only label-sheet workshop at `/myo/covers/` that lays out ten card covers at true size, supports per-label zoom/pan, printing, calibration and native `.yotolabels` files.

**Architecture:** Pure TypeScript modules under `site/src/lib/` hold geometry, project state, transforms, file mapping, ZIP and autosave. An Astro component renders the markup and a framework-free controller (`scripts/yoto-cover.ts`) projects state onto the DOM. The controller and the file codec are lazy chunks with dedicated JS budgets.

**Tech Stack:** Astro 7 (static), TypeScript 5, Vitest 5, Playwright, pnpm 10, browsers with `CompressionStream`/`DecompressionStream` and IndexedDB.

**Spec:** `docs/superpowers/specs/2026-11-06-yotocover-design.md`

## Global Constraints

- 100 % static, GitHub Pages: no backend, no account, no analytics, no runtime network request from the browser.
- The public name is **YotoCover**; routes are `/myo/covers/` and `/fr/myo/covers/`; autosave uses the IndexedDB database `yoto-community-covers`.
- The native file extension stays `.yotolabels` and the native JSON DTO must round-trip with `YotoLabels.exe`.
- Initial portal JavaScript stays under **30 KB gzip**. `yoto-cover` gets **20 KB gzip**, `yoto-cover-file` gets **10 KB gzip**.
- EN/FR route parity is mandatory (`pnpm check:i18n`). Every new i18n key exists in both `site/src/i18n/en.ts` and `site/src/i18n/fr.ts`.
- Never write to `localStorage` for covers; images go to IndexedDB.
- Node `>=22.23.4`, pnpm `10.11.0`.
- Commit after every task with Conventional Commits (`feat:`, `test:`, `docs:`, `chore:`).

## File Structure

| Path                                            | Responsibility                                             |
| ----------------------------------------------- | ---------------------------------------------------------- |
| `site/src/lib/label-sheet.ts`                   | Extend with presets, card zone, trim strip and validation. |
| `site/src/lib/cover-project.ts`                 | Immutable project/slot model and validation.               |
| `site/src/lib/cover-transform.ts`               | Zoom/pan math and CSS transform string.                    |
| `site/src/lib/cover-images.ts`                  | Convert picked files into `CoverImage` values.             |
| `site/src/lib/cover-file.ts`                    | Native DTO mapping, image paths, file errors.              |
| `site/src/lib/cover-zip.ts`                     | Stored/deflated ZIP reader and stored ZIP writer.          |
| `site/src/lib/cover-io.ts`                      | Build/read a complete `.yotolabels` archive.               |
| `site/src/lib/cover-autosave.ts`                | Autosave contract and IndexedDB backend.                   |
| `site/src/components/YotoCover.astro`           | Markup, bilingual copy, lazy mount.                        |
| `site/src/scripts/yoto-cover.ts`                | DOM controller.                                            |
| `site/src/styles/yoto-cover.css`                | Screen and print styles.                                   |
| `site/src/views/YotoCoverView.astro`            | Page shell and editorial copy.                             |
| `site/src/pages/myo/covers/index.astro` + `fr/` | Routes.                                                    |
| `site/e2e/yoto-cover.spec.ts`                   | Browser coverage.                                          |

---

### Task 1: Sheet geometry, presets and validation

**Files:**

- Modify: `site/src/lib/label-sheet.ts`
- Modify: `site/src/lib/label-sheet.test.ts`

**Interfaces:**

- Produces: `MM_PER_INCH`, `CARD_WIDTH_MM`, `CARD_HEIGHT_MM`, `LabelSheetPreset`, `LABEL_PRESETS`, `presetById(id)`, `countLabels(config)`, `cardZoneWidthMm(config)`, `trimWidthMm(config)`, `SheetValidationError`, `validateSheetConfig(config)`.

- [ ] **Step 1: Add the failing tests**

Append to `site/src/lib/label-sheet.test.ts`:

```ts
import {
  CARD_HEIGHT_MM,
  CARD_WIDTH_MM,
  LABEL_PRESETS,
  cardZoneWidthMm,
  countLabels,
  presetById,
  trimWidthMm,
  validateSheetConfig,
} from './label-sheet';

describe('presets', () => {
  it('ships the TownStix US-10 geometry exactly', () => {
    const preset = presetById('townstix-us10');
    expect(preset?.config).toEqual({
      paper: 'letter',
      columns: 2,
      rows: 5,
      labelWidthMm: 101.6,
      labelHeightMm: 50.8,
      marginXMm: 3.81,
      marginYMm: 12.7,
      gapXMm: 5.08,
      gapYMm: 0,
    });
    expect(countLabels(preset!.config)).toBe(10);
  });

  it('keeps both presets inside their paper', () => {
    for (const preset of LABEL_PRESETS) {
      expect(validateSheetConfig(preset.config)).toEqual([]);
    }
  });

  it('reserves a 3.375 inch card zone and a trim strip', () => {
    const us10 = presetById('townstix-us10')!.config;
    expect(CARD_WIDTH_MM).toBeCloseTo(85.725, 3);
    expect(CARD_HEIGHT_MM).toBeCloseTo(53.975, 3);
    expect(cardZoneWidthMm(us10)).toBeCloseTo(85.725, 3);
    expect(trimWidthMm(us10)).toBeCloseTo(15.875, 3);
  });

  it('never lets the card zone exceed a narrow label', () => {
    const narrow = { ...presetById('a4-2x5')!.config, labelWidthMm: 70 };
    expect(cardZoneWidthMm(narrow)).toBe(70);
    expect(trimWidthMm(narrow)).toBe(0);
  });
});

describe('validateSheetConfig', () => {
  const base = presetById('a4-2x5')!.config;

  it('accepts a custom geometry that fits', () => {
    expect(validateSheetConfig({ ...base, labelWidthMm: 90, labelHeightMm: 55 })).toEqual([]);
  });

  it('rejects labels that overflow the paper', () => {
    expect(validateSheetConfig({ ...base, columns: 3 })).toContain('overflow');
  });

  it('rejects bad counts, sizes and margins', () => {
    expect(validateSheetConfig({ ...base, columns: 0 })).toContain('columns');
    expect(validateSheetConfig({ ...base, rows: 2.5 })).toContain('rows');
    expect(validateSheetConfig({ ...base, labelWidthMm: 5 })).toContain('label-width');
    expect(validateSheetConfig({ ...base, gapXMm: -1 })).toContain('margin');
  });
});
```

- [ ] **Step 2: Run the tests and watch them fail**

Run: `pnpm test -- site/src/lib/label-sheet.test.ts`
Expected: FAIL because the new exports do not exist.

- [ ] **Step 3: Extend `label-sheet.ts`**

Keep the existing `Paper`, `LabelSheetConfig`, `LabelPosition`, `paperSizeMm` and `labelPositions`. Add:

```ts
export const MM_PER_INCH = 25.4;
export const CARD_WIDTH_MM = 3.375 * MM_PER_INCH; // 85.725 mm
export const CARD_HEIGHT_MM = 2.125 * MM_PER_INCH; // 53.975 mm

export interface LabelSheetPreset {
  id: string;
  name: string;
  config: LabelSheetConfig;
}

export const LABEL_PRESETS: readonly LabelSheetPreset[] = [
  {
    id: 'townstix-us10',
    name: 'TownStix US-10 (Letter, 4 × 2 in)',
    config: {
      paper: 'letter',
      columns: 2,
      rows: 5,
      labelWidthMm: 101.6,
      labelHeightMm: 50.8,
      marginXMm: 3.81,
      marginYMm: 12.7,
      gapXMm: 5.08,
      gapYMm: 0,
    },
  },
  {
    id: 'a4-2x5',
    name: 'A4, 2 × 5 (100 × 55 mm)',
    config: {
      paper: 'a4',
      columns: 2,
      rows: 5,
      labelWidthMm: 100,
      labelHeightMm: 55,
      marginXMm: 3,
      marginYMm: 11,
      gapXMm: 4,
      gapYMm: 0,
    },
  },
];

export function presetById(id: string | null | undefined): LabelSheetPreset | undefined {
  return LABEL_PRESETS.find((preset) => preset.id === id);
}

export function countLabels(config: LabelSheetConfig): number {
  return config.columns * config.rows;
}

export function cardZoneWidthMm(config: LabelSheetConfig): number {
  return Math.min(CARD_WIDTH_MM, config.labelWidthMm);
}

export function trimWidthMm(config: LabelSheetConfig): number {
  return Math.max(0, config.labelWidthMm - cardZoneWidthMm(config));
}

export type SheetValidationError =
  'paper' | 'columns' | 'rows' | 'label-width' | 'label-height' | 'margin' | 'overflow';

export function validateSheetConfig(config: LabelSheetConfig): SheetValidationError[] {
  const errors: SheetValidationError[] = [];

  if (!(config.paper in PAPER_MM)) errors.push('paper');
  if (!Number.isInteger(config.columns) || config.columns < 1 || config.columns > 10) {
    errors.push('columns');
  }
  if (!Number.isInteger(config.rows) || config.rows < 1 || config.rows > 10) {
    errors.push('rows');
  }
  if (
    !Number.isFinite(config.labelWidthMm) ||
    config.labelWidthMm < 10 ||
    config.labelWidthMm > 300
  ) {
    errors.push('label-width');
  }
  if (
    !Number.isFinite(config.labelHeightMm) ||
    config.labelHeightMm < 10 ||
    config.labelHeightMm > 300
  ) {
    errors.push('label-height');
  }
  if (
    ![config.marginXMm, config.marginYMm, config.gapXMm, config.gapYMm].every(
      (value) => Number.isFinite(value) && value >= 0,
    )
  ) {
    errors.push('margin');
  }

  if (errors.length === 0) {
    const paper = paperSizeMm(config.paper);
    const last = labelPositions(config).at(-1);
    if (
      last &&
      (last.xMm + last.widthMm > paper.widthMm + 0.01 ||
        last.yMm + last.heightMm > paper.heightMm + 0.01)
    ) {
      errors.push('overflow');
    }
  }

  return errors;
}
```

- [ ] **Step 4: Run the tests**

Run: `pnpm test -- site/src/lib/label-sheet.test.ts && pnpm check:types`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add site/src/lib/label-sheet.ts site/src/lib/label-sheet.test.ts
git commit -m "feat(covers): add label sheet presets and validation"
```

---

### Task 2: Project and slot model

**Files:**

- Create: `site/src/lib/cover-project.ts`
- Create: `site/src/lib/cover-project.test.ts`

**Interfaces:**

- Consumes: `LabelSheetConfig`, `countLabels`, `presetById`, `LABEL_PRESETS`.
- Produces: `CardLayout`, `CoverImage`, `CoverSlot`, `CoverProject`, `DEFAULT_TITLE_FONT_SIZE`, `MIN_ZOOM`, `MAX_ZOOM`, `MAX_TITLE_LENGTH`, `emptySlot()`, `createProject(presetId?)`, `clampZoom`, `clampPan`, `resizeSlots`, `setSheet`, `setSlotImage`, `clearSlot`, `clearAll`, `resetSlotPosition`, `updateSlot`, `filledCount`, `fillEmptySlots`, `isCoverProject`.

- [ ] **Step 1: Write the failing tests**

```ts
import { describe, expect, it } from 'vitest';
import {
  clearAll,
  clearSlot,
  createProject,
  fillEmptySlots,
  filledCount,
  isCoverProject,
  setSheet,
  setSlotImage,
  updateSlot,
  type CoverImage,
} from './cover-project';
import { presetById } from './label-sheet';

const image = (id: string): CoverImage => ({
  id,
  fileName: `${id}.png`,
  mimeType: 'image/png',
  blob: new Blob(['x'], { type: 'image/png' }),
});

describe('createProject', () => {
  it('creates ten empty slots for the default US-10 preset', () => {
    const project = createProject();
    expect(project.sheetId).toBe('townstix-us10');
    expect(project.slots).toHaveLength(10);
    expect(project.slots.every((slot) => slot.image === null && slot.zoom === 1)).toBe(true);
    expect(isCoverProject(project)).toBe(true);
  });
});

describe('slot mutations', () => {
  it('sets an image and resets its position', () => {
    let project = createProject();
    project = updateSlot(project, 0, { zoom: 2, panX: 0.4, panY: -0.3 });
    project = setSlotImage(project, 0, image('a'));
    expect(project.slots[0].image?.id).toBe('a');
    expect(project.slots[0].zoom).toBe(1);
    expect(project.slots[0].panX).toBe(0);
  });

  it('clamps zoom and pan and truncates titles', () => {
    const project = updateSlot(createProject(), 0, {
      zoom: 99,
      panX: -9,
      panY: 9,
      title: 'x'.repeat(300),
    });
    expect(project.slots[0].zoom).toBe(8);
    expect(project.slots[0].panX).toBe(-1);
    expect(project.slots[0].panY).toBe(1);
    expect(project.slots[0].title).toHaveLength(200);
  });

  it('fills empty slots in order and reports skipped images', () => {
    const result = fillEmptySlots(createProject(), [image('a'), image('b'), image('c')]);
    expect(result.added).toBe(3);
    expect(result.skipped).toBe(0);
    expect(result.project.slots[0].image?.id).toBe('a');
    expect(result.project.slots[2].image?.id).toBe('c');
    expect(filledCount(result.project)).toBe(3);
  });

  it('clears one slot and the whole sheet', () => {
    let project = setSlotImage(createProject(), 0, image('a'));
    project = updateSlot(project, 0, { title: 'Mila' });
    expect(clearSlot(project, 0).slots[0]).toMatchObject({ image: null, title: '' });
    expect(filledCount(clearAll(project))).toBe(0);
  });

  it('keeps existing slots when the sheet grows and drops extras when it shrinks', () => {
    let project = setSlotImage(createProject(), 0, image('a'));
    project = setSheet(project, 'a4-2x5', presetById('a4-2x5')!.config);
    expect(project.slots).toHaveLength(10);
    expect(project.slots[0].image?.id).toBe('a');
    project = setSheet(project, 'custom', { ...presetById('a4-2x5')!.config, columns: 1, rows: 2 });
    expect(project.slots).toHaveLength(2);
  });
});
```

- [ ] **Step 2: Run the tests and watch them fail**

Run: `pnpm test -- site/src/lib/cover-project.test.ts`
Expected: FAIL because `cover-project.ts` does not exist.

- [ ] **Step 3: Write `cover-project.ts`**

```ts
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
```

- [ ] **Step 4: Run the tests**

Run: `pnpm test -- site/src/lib/cover-project.test.ts && pnpm check:types`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add site/src/lib/cover-project.ts site/src/lib/cover-project.test.ts
git commit -m "feat(covers): add immutable cover project model"
```

---

### Task 3: Zoom/pan math and image intake

**Files:**

- Create: `site/src/lib/cover-transform.ts`
- Create: `site/src/lib/cover-transform.test.ts`
- Create: `site/src/lib/cover-images.ts`
- Create: `site/src/lib/cover-images.test.ts`

**Interfaces:**

- Consumes: `clampPan`, `clampZoom`, `MAX_ZOOM`, `MIN_ZOOM`, `CoverImage`.
- Produces: `zoomAtPoint(state, ux, uy, deltaY)`, `panBy(state, dx, dy)`, `transformStyle(state)`, `MAX_IMAGE_BYTES`, `ImageImportResult`, `filesToImages(files)`.

- [ ] **Step 1: Write the failing tests**

`cover-transform.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { panBy, transformStyle, zoomAtPoint } from './cover-transform';

describe('zoomAtPoint', () => {
  it('keeps the pan unchanged when zooming at the centre', () => {
    const next = zoomAtPoint({ zoom: 1, panX: 0.2, panY: -0.1 }, 0.5, 0.5, -120);
    expect(next.zoom).toBeCloseTo(1.1, 5);
    expect(next.panX).toBeCloseTo(0.2, 5);
    expect(next.panY).toBeCloseTo(-0.1, 5);
  });

  it('moves the pan when zooming away from the centre', () => {
    const next = zoomAtPoint({ zoom: 1, panX: 0, panY: 0 }, 0.25, 0.75, -120);
    expect(next.panX).toBeGreaterThan(0);
    expect(next.panY).toBeLessThan(0);
  });

  it('clamps zoom between 0.2 and 8', () => {
    expect(zoomAtPoint({ zoom: 1, panX: 0, panY: 0 }, 0.5, 0.5, -10000).zoom).toBe(8);
    expect(zoomAtPoint({ zoom: 1, panX: 0, panY: 0 }, 0.5, 0.5, 10000).zoom).toBe(0.2);
  });
});

describe('panBy', () => {
  it('adds a fraction and clamps to [-1, 1]', () => {
    expect(panBy({ panX: 0.5, panY: 0.5 }, 0.1, -1.2)).toEqual({ panX: 0.6, panY: -0.7 });
    expect(panBy({ panX: 0, panY: 0 }, 5, -5)).toEqual({ panX: 1, panY: -1 });
  });
});

describe('transformStyle', () => {
  it('serialises a CSS transform', () => {
    expect(transformStyle({ zoom: 2, panX: 0.25, panY: -0.5 })).toBe(
      'translate(25%, -50%) scale(2)',
    );
  });
});
```

`cover-images.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { MAX_IMAGE_BYTES, filesToImages } from './cover-images';

const file = (name: string, type: string, size = 4) =>
  new File([new Uint8Array(size)], name, { type });

describe('filesToImages', () => {
  it('accepts supported images and creates stable ids', () => {
    const result = filesToImages([file('cover.png', 'image/png')]);
    expect(result.images).toHaveLength(1);
    expect(result.images[0].fileName).toBe('cover.png');
    expect(result.images[0].id).not.toBe('');
    expect(result.rejected).toBe(0);
  });

  it('rejects unsupported types and files over the limit', () => {
    const huge = {
      name: 'huge.png',
      type: 'image/png',
      size: MAX_IMAGE_BYTES + 1,
    } as File;
    const result = filesToImages([file('notes.txt', 'text/plain'), huge]);
    expect(result.images).toHaveLength(0);
    expect(result.rejected).toBe(1);
    expect(result.tooLarge).toBe(1);
  });
});
```

- [ ] **Step 2: Run the tests and watch them fail**

Run: `pnpm test -- site/src/lib/cover-transform.test.ts site/src/lib/cover-images.test.ts`
Expected: FAIL because the modules do not exist.

- [ ] **Step 3: Write `cover-transform.ts`**

```ts
import { clampPan, clampZoom } from './cover-project';

export interface TransformState {
  zoom: number;
  panX: number;
  panY: number;
}

export function zoomAtPoint(
  state: TransformState,
  ux: number,
  uy: number,
  deltaY: number,
): TransformState {
  const oldZoom = clampZoom(state.zoom);
  const newZoom = clampZoom(oldZoom * Math.pow(1.1, -deltaY / 120));
  if (newZoom === oldZoom) return { ...state, zoom: newZoom };

  const ratio = newZoom / oldZoom;
  return {
    zoom: newZoom,
    panX: clampPan(ux - 0.5 - (ux - 0.5 - state.panX) * ratio),
    panY: clampPan(uy - 0.5 - (uy - 0.5 - state.panY) * ratio),
  };
}

export function panBy(
  state: Pick<TransformState, 'panX' | 'panY'>,
  dx: number,
  dy: number,
): Pick<TransformState, 'panX' | 'panY'> {
  return {
    panX: clampPan(state.panX + dx),
    panY: clampPan(state.panY + dy),
  };
}

export function transformStyle(state: TransformState): string {
  return `translate(${state.panX * 100}%, ${state.panY * 100}%) scale(${clampZoom(state.zoom)})`;
}
```

- [ ] **Step 4: Write `cover-images.ts`**

```ts
import type { CoverImage } from './cover-project';

export const MAX_IMAGE_BYTES = 20 * 1024 * 1024;

const ALLOWED_TYPES = new Set(['image/png', 'image/jpeg', 'image/webp', 'image/gif']);

export interface ImageImportResult {
  images: CoverImage[];
  rejected: number;
  tooLarge: number;
}

export function filesToImages(files: File[]): ImageImportResult {
  const images: CoverImage[] = [];
  let rejected = 0;
  let tooLarge = 0;

  for (const file of files) {
    if (!ALLOWED_TYPES.has(file.type)) {
      rejected += 1;
      continue;
    }
    if (file.size > MAX_IMAGE_BYTES) {
      tooLarge += 1;
      continue;
    }
    images.push({
      id: crypto.randomUUID(),
      fileName: file.name,
      mimeType: file.type,
      blob: file,
    });
  }

  return { images, rejected, tooLarge };
}
```

- [ ] **Step 5: Run the tests**

Run: `pnpm test -- site/src/lib/cover-transform.test.ts site/src/lib/cover-images.test.ts && pnpm check:types`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add site/src/lib/cover-transform.ts site/src/lib/cover-transform.test.ts \
  site/src/lib/cover-images.ts site/src/lib/cover-images.test.ts
git commit -m "feat(covers): add zoom math and image intake"
```

---

### Task 4: Native `.yotolabels` JSON mapping

**Files:**

- Create: `site/src/lib/cover-file.ts`
- Create: `site/src/lib/cover-file.test.ts`

**Interfaces:**

- Consumes: `CoverImage`, `CoverProject`, `CoverSlot`, `DEFAULT_TITLE_FONT_SIZE`, `MAX_TITLE_LENGTH`, `clampPan`, `clampZoom`, `emptySlot`; `LabelSheetConfig`, `LABEL_PRESETS`, `countLabels`, `presetById`, `validateSheetConfig`.
- Produces: `NATIVE_FORMAT_VERSION`, `NativeLayout`, `NativeSlotDto`, `NativeCoverDto`, `CoverFileErrorCode`, `CoverFileError`, `isSafeImagePath(path)`, `extensionForMime(mimeType, fileName)`, `mimeForPath(path)`, `imagePathFor(image)`, `projectToDto(project, imagePaths)`, `dtoToProject(value, imagesByPath)`, `parseProjectJson(text, imagesByPath)`.

- [ ] **Step 1: Write the failing tests**

```ts
import { describe, expect, it } from 'vitest';
import {
  CoverFileError,
  dtoToProject,
  imagePathFor,
  isSafeImagePath,
  parseProjectJson,
  projectToDto,
} from './cover-file';
import { createProject, setSlotImage, updateSlot, type CoverImage } from './cover-project';

const image: CoverImage = {
  id: 'abc',
  fileName: 'Mila.png',
  mimeType: 'image/png',
  blob: new Blob(['x'], { type: 'image/png' }),
};

const dto = {
  format: 1,
  sheet: 'townstix-us10',
  layout: 'SquareCoverWithTitle',
  roundedCorners: true,
  printCutLine: true,
  titleFontSize: 14,
  offsetXmm: 0.2,
  offsetYmm: -0.4,
  slots: [
    { image: 'images/abc.png', zoom: 1.25, panX: 0.05, panY: -0.1, title: 'Mila' },
    ...Array.from({ length: 9 }, () => ({
      image: null,
      zoom: 1,
      panX: 0,
      panY: 0,
      title: '',
    })),
  ],
};

describe('native mapping', () => {
  it('round-trips a project through the native DTO', () => {
    let project = setSlotImage(createProject(), 0, image);
    project = updateSlot(project, 0, { zoom: 1.25, panX: 0.05, panY: -0.1, title: 'Mila' });
    project = { ...project, name: 'School', offsetXMm: 0.2 };
    const paths = new Map([['abc', imagePathFor(image)]]);
    const value = projectToDto(project, paths);

    expect(value.layout).toBe('SquareCoverWithTitle');
    expect(value.slots[0].image).toBe('images/abc.png');

    const reopened = dtoToProject(value, new Map([['images/abc.png', image]]));
    expect(reopened.project.slots[0].title).toBe('Mila');
    expect(reopened.project.slots[0].zoom).toBe(1.25);
    expect(reopened.project.name).toBe('School');
    expect(reopened.notes).toEqual([]);
  });

  it('rejects a file made by a newer format', () => {
    expect(() => dtoToProject({ ...dto, format: 2 }, new Map())).toThrow(CoverFileError);
    try {
      dtoToProject({ ...dto, format: 2 }, new Map());
    } catch (error) {
      expect((error as CoverFileError).code).toBe('newer-format');
    }
  });

  it('ignores unsafe image paths and reports missing images', () => {
    const unsafe = dtoToProject(
      {
        ...dto,
        slots: [{ ...dto.slots[0], image: 'images/../secret.png' }, ...dto.slots.slice(1)],
      },
      new Map(),
    );
    expect(unsafe.project.slots[0].image).toBeNull();

    const missing = dtoToProject(
      { ...dto, slots: [{ ...dto.slots[0], image: 'images/missing.png' }, ...dto.slots.slice(1)] },
      new Map(),
    );
    expect(missing.notes).toContain('missing-image');
  });

  it('uses sheetConfig for a custom sheet and falls back for an unknown one', () => {
    const custom = dtoToProject(
      {
        ...dto,
        sheet: 'custom',
        sheetConfig: {
          paper: 'a4',
          columns: 2,
          rows: 5,
          labelWidthMm: 100,
          labelHeightMm: 55,
          marginXMm: 3,
          marginYMm: 11,
          gapXMm: 4,
          gapYMm: 0,
        },
      },
      new Map(),
    );
    expect(custom.project.sheetId).toBe('custom');
    expect(custom.project.sheet.labelWidthMm).toBe(100);

    const fallback = dtoToProject({ ...dto, sheet: 'unknown' }, new Map());
    expect(fallback.project.sheetId).toBe('townstix-us10');
    expect(fallback.notes).toContain('sheet-fallback');
  });

  it('rejects invalid JSON', () => {
    expect(() => parseProjectJson('{', new Map())).toThrow(CoverFileError);
  });
});

describe('image paths', () => {
  it('builds a safe path from the image id and extension', () => {
    expect(imagePathFor(image)).toBe('images/abc.png');
    expect(isSafeImagePath('images/abc.png')).toBe(true);
    expect(isSafeImagePath('images/../abc.png')).toBe(false);
    expect(isSafeImagePath('/etc/passwd')).toBe(false);
    expect(isSafeImagePath('images/a/b.png')).toBe(false);
  });
});
```

- [ ] **Step 2: Run the tests and watch them fail**

Run: `pnpm test -- site/src/lib/cover-file.test.ts`
Expected: FAIL because `cover-file.ts` does not exist.

- [ ] **Step 3: Write `cover-file.ts`**

```ts
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
```

- [ ] **Step 4: Run the tests**

Run: `pnpm test -- site/src/lib/cover-file.test.ts && pnpm check:types`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add site/src/lib/cover-file.ts site/src/lib/cover-file.test.ts
git commit -m "feat(covers): map native .yotolabels project JSON"
```

---

### Task 5: Native-compatible ZIP codec

**Files:**

- Create: `site/src/lib/cover-zip.ts`
- Create: `site/src/lib/cover-zip.test.ts`

**Interfaces:**

- Produces: `ZipEntry { path: string; data: Uint8Array }`, `crc32(data)`, `zipEntries(entries, now?)`, `readZip(data): Promise<Map<string, Uint8Array>>`.

- [ ] **Step 1: Write the failing tests**

```ts
import { describe, expect, it } from 'vitest';
import { crc32, readZip, zipEntries } from './cover-zip';

const NATIVE_FIXTURE =
  'UEsDBBQAAAAIAISWZl0PG+hqzwAAAEgDAAAMAAAAcHJvamVjdC5qc29u7Y7NbgIxDIRfZZUzbJMKLr2uxAlOIBWEOETghUhZGxKn5Ue8O3Gh7L4D3Dwznk9zUTWFxrL6KkyvUHEHILdi+sXI7thP0WiVE29PlP6i6SHZABX9QPh2vJs59iAfgRJuYFNRQAgxf3JIkP19cMhV4rFDaF2W2oiQp+4sthlkk+o6As+bJhv6qRdPHT2xkJcX5Rq7ld79iB9r2VPucStTzkRSMeXnUAZYnAug1A+1yKqvS/M/QzAT56269oqWjMn7DqsDaim6i3jXX7W+ut4AUEsDBBQAAAAAAISWZl1ZqVCQRAAAAEQAAAAQAAAAaW1hZ2VzL2NvdmVyLnBuZ4lQTkcNChoKAAAADUlIRFIAAAABAAAAAQgEAAAAtRwMAgAAAAtJREFUeNpj/P8fAAMDAgDvv6fbAAAAAElFTkSuQmCCUEsBAhQDFAAAAAgAhJZmXQ8b6GrPAAAASAMAAAwAAAAAAAAAAAAAAIABAAAAAHByb2plY3QuanNvblBLAQIUAxQAAAAAAISWZl1ZqVCQRAAAAEQAAAAQAAAAAAAAAAAAAACAAfkAAABpbWFnZXMvY292ZXIucG5nUEsFBgAAAAACAAIAeAAAAGsBAAAAAA==';

const base64 = (value: string): Uint8Array => new Uint8Array(Buffer.from(value, 'base64'));

describe('zipEntries', () => {
  it('round-trips stored entries and UTF-8 names', async () => {
    const zip = zipEntries([
      { path: 'project.json', data: new TextEncoder().encode('{"format":1}') },
      { path: 'images/café.png', data: new Uint8Array([1, 2, 3]) },
    ]);
    const entries = await readZip(zip);
    expect(new TextDecoder().decode(entries.get('project.json'))).toBe('{"format":1}');
    expect([...entries.get('images/café.png')!]).toEqual([1, 2, 3]);
  });

  it('rejects duplicates and unsafe paths', () => {
    const data = new Uint8Array([1]);
    expect(() =>
      zipEntries([
        { path: 'a', data },
        { path: 'a', data },
      ]),
    ).toThrow();
    expect(() => zipEntries([{ path: '../a', data }])).toThrow();
  });
});

describe('readZip', () => {
  it('reads the native fixture with deflate and stored entries', async () => {
    const entries = await readZip(base64(NATIVE_FIXTURE));
    expect([...entries.keys()]).toEqual(['project.json', 'images/cover.png']);
    const project = JSON.parse(new TextDecoder().decode(entries.get('project.json')));
    expect(project.layout).toBe('SquareCoverWithTitle');
    expect(project.slots[0].title).toBe('Mila');
    expect(entries.get('images/cover.png')).toHaveLength(68);
  });

  it('rejects a truncated archive', async () => {
    await expect(readZip(base64(NATIVE_FIXTURE).slice(0, 40))).rejects.toThrow();
  });
});

describe('crc32', () => {
  it('matches the standard check value', () => {
    expect(crc32(new TextEncoder().encode('123456789'))).toBe(0xcbf43926);
  });
});
```

- [ ] **Step 2: Run the tests and watch them fail**

Run: `pnpm test -- site/src/lib/cover-zip.test.ts`
Expected: FAIL because `cover-zip.ts` does not exist.

- [ ] **Step 3: Write `cover-zip.ts`**

```ts
export interface ZipEntry {
  path: string;
  data: Uint8Array;
}

const LOCAL_SIG = 0x04034b50;
const CENTRAL_SIG = 0x02014b50;
const EOCD_SIG = 0x06054b50;
const FLAG_UTF8 = 0x0800;
const METHOD_STORE = 0;
const METHOD_DEFLATE = 8;
const MAX32 = 0xffffffff;

const encoder = new TextEncoder();
const decoder = new TextDecoder();

let table: Uint32Array | null = null;

function crcTable(): Uint32Array {
  if (table) return table;
  table = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let value = n;
    for (let bit = 0; bit < 8; bit++) {
      value = value & 1 ? 0xedb88320 ^ (value >>> 1) : value >>> 1;
    }
    table[n] = value >>> 0;
  }
  return table;
}

export function crc32(data: Uint8Array): number {
  const values = crcTable();
  let crc = 0xffffffff;
  for (let index = 0; index < data.length; index++) {
    crc = values[(crc ^ data[index]) & 0xff] ^ (crc >>> 8);
  }
  return (crc ^ 0xffffffff) >>> 0;
}

function assertSafePath(path: string): void {
  if (
    path === '' ||
    path.startsWith('/') ||
    path.includes('\\') ||
    path.includes('\0') ||
    path.split('/').includes('..')
  ) {
    throw new Error(`Unsafe ZIP path: ${path}`);
  }
}

function dosDateTime(now: Date): { time: number; date: number } {
  return {
    time: (now.getHours() << 11) | (now.getMinutes() << 5) | (now.getSeconds() >> 1),
    date:
      ((Math.max(1980, now.getFullYear()) - 1980) << 9) |
      ((now.getMonth() + 1) << 5) |
      now.getDate(),
  };
}

export function zipEntries(entries: ZipEntry[], now = new Date()): Uint8Array {
  const { time, date } = dosDateTime(now);
  const seen = new Set<string>();
  const locals: Uint8Array[] = [];
  const central: { name: Uint8Array; crc: number; size: number; offset: number }[] = [];
  let offset = 0;

  for (const entry of entries) {
    assertSafePath(entry.path);
    if (seen.has(entry.path)) throw new Error(`Duplicate ZIP entry: ${entry.path}`);
    seen.add(entry.path);

    const name = encoder.encode(entry.path);
    const crc = crc32(entry.data);
    const local = new Uint8Array(30 + name.length + entry.data.length);
    const view = new DataView(local.buffer);
    view.setUint32(0, LOCAL_SIG, true);
    view.setUint16(4, 20, true);
    view.setUint16(6, FLAG_UTF8, true);
    view.setUint16(8, METHOD_STORE, true);
    view.setUint16(10, time, true);
    view.setUint16(12, date, true);
    view.setUint32(14, crc, true);
    view.setUint32(18, entry.data.length, true);
    view.setUint32(22, entry.data.length, true);
    view.setUint16(26, name.length, true);
    view.setUint16(28, 0, true);
    local.set(name, 30);
    local.set(entry.data, 30 + name.length);

    locals.push(local);
    central.push({ name, crc, size: entry.data.length, offset });
    offset += local.length;
  }

  const centralSize = central.reduce((sum, item) => sum + 46 + item.name.length, 0);
  const out = new Uint8Array(offset + centralSize + 22);
  let cursor = 0;
  for (const local of locals) {
    out.set(local, cursor);
    cursor += local.length;
  }

  for (const item of central) {
    const view = new DataView(out.buffer, cursor, 46);
    view.setUint32(0, CENTRAL_SIG, true);
    view.setUint16(4, 20, true);
    view.setUint16(6, 20, true);
    view.setUint16(8, FLAG_UTF8, true);
    view.setUint16(10, METHOD_STORE, true);
    view.setUint16(12, time, true);
    view.setUint16(14, date, true);
    view.setUint32(16, item.crc, true);
    view.setUint32(20, item.size, true);
    view.setUint32(24, item.size, true);
    view.setUint16(28, item.name.length, true);
    view.setUint16(30, 0, true);
    view.setUint16(32, 0, true);
    view.setUint16(34, 0, true);
    view.setUint16(36, 0, true);
    view.setUint32(38, 0, true);
    view.setUint32(42, item.offset, true);
    out.set(item.name, cursor + 46);
    cursor += 46 + item.name.length;
  }

  const eocd = new DataView(out.buffer, cursor, 22);
  eocd.setUint32(0, EOCD_SIG, true);
  eocd.setUint16(4, 0, true);
  eocd.setUint16(6, 0, true);
  eocd.setUint16(8, central.length, true);
  eocd.setUint16(10, central.length, true);
  eocd.setUint32(12, centralSize, true);
  eocd.setUint32(16, offset, true);
  eocd.setUint16(20, 0, true);

  return out;
}

async function inflateRaw(data: Uint8Array): Promise<Uint8Array> {
  if (typeof DecompressionStream === 'undefined') {
    throw new Error('This browser cannot read compressed ZIP entries.');
  }
  const stream = new Blob([data]).stream().pipeThrough(new DecompressionStream('deflate-raw'));
  return new Uint8Array(await new Response(stream).arrayBuffer());
}

export async function readZip(data: Uint8Array): Promise<Map<string, Uint8Array>> {
  const view = new DataView(data.buffer, data.byteOffset, data.byteLength);
  let eocd = -1;
  const minimum = Math.max(0, data.length - 22 - 0xffff);
  for (let index = data.length - 22; index >= minimum; index--) {
    if (view.getUint32(index, true) === EOCD_SIG) {
      eocd = index;
      break;
    }
  }
  if (eocd < 0) throw new Error('Not a ZIP file');

  const count = view.getUint16(eocd + 10, true);
  const centralOffset = view.getUint32(eocd + 16, true);
  if (count === 0xffff || centralOffset === MAX32) throw new Error('ZIP64 is not supported');

  const result = new Map<string, Uint8Array>();
  let cursor = centralOffset;

  for (let index = 0; index < count; index++) {
    if (view.getUint32(cursor, true) !== CENTRAL_SIG) {
      throw new Error('Broken ZIP central directory');
    }

    const method = view.getUint16(cursor + 10, true);
    const crc = view.getUint32(cursor + 16, true);
    const compressedSize = view.getUint32(cursor + 20, true);
    const uncompressedSize = view.getUint32(cursor + 24, true);
    const nameLength = view.getUint16(cursor + 28, true);
    const extraLength = view.getUint16(cursor + 30, true);
    const commentLength = view.getUint16(cursor + 32, true);
    const localOffset = view.getUint32(cursor + 42, true);

    if ([compressedSize, uncompressedSize, localOffset].includes(MAX32)) {
      throw new Error('ZIP64 is not supported');
    }
    if (uncompressedSize > 100 * 1024 * 1024) {
      throw new Error('ZIP entry is too large');
    }

    const name = decoder.decode(data.subarray(cursor + 46, cursor + 46 + nameLength));
    assertSafePath(name);
    if (result.has(name)) throw new Error(`Duplicate ZIP entry: ${name}`);
    if (view.getUint32(localOffset, true) !== LOCAL_SIG) {
      throw new Error('Broken ZIP local header');
    }

    const localNameLength = view.getUint16(localOffset + 26, true);
    const localExtraLength = view.getUint16(localOffset + 28, true);
    const start = localOffset + 30 + localNameLength + localExtraLength;
    const compressed = data.subarray(start, start + compressedSize);
    if (compressed.length !== compressedSize) throw new Error('Truncated ZIP entry');

    let bytes: Uint8Array;
    if (method === METHOD_STORE) bytes = compressed.slice();
    else if (method === METHOD_DEFLATE) bytes = await inflateRaw(compressed);
    else throw new Error(`Unsupported ZIP compression method: ${method}`);

    if (bytes.length !== uncompressedSize) throw new Error('ZIP size mismatch');
    if (crc32(bytes) !== crc) throw new Error('ZIP CRC mismatch');

    result.set(name, bytes);
    cursor += 46 + nameLength + extraLength + commentLength;
  }

  return result;
}
```

- [ ] **Step 4: Run the tests**

Run: `pnpm test -- site/src/lib/cover-zip.test.ts && pnpm check:types`
Expected: PASS. If the 68-byte image assertion fails, print the fixture entry length and update the assertion to the real value; do not weaken the rest of the test.

- [ ] **Step 5: Commit**

```bash
git add site/src/lib/cover-zip.ts site/src/lib/cover-zip.test.ts
git commit -m "feat(covers): read and write native ZIP archives"
```

---

### Task 6: Autosave contract and IndexedDB backend

**Files:**

- Create: `site/src/lib/cover-autosave.ts`
- Create: `site/src/lib/cover-autosave.test.ts`

**Interfaces:**

- Consumes: `CoverProject`, `isCoverProject`.
- Produces: `AUTOSAVE_VERSION`, `AUTOSAVE_DELAY_MS`, `AUTOSAVE_KEY`, `CoverAutosaveBackend`, `AutosavePayload`, `CoverAutosave`, `createAutosave(backend, now?)`, `indexedDbBackend()`.

- [ ] **Step 1: Write the failing tests**

```ts
import { describe, expect, it } from 'vitest';
import { createProject, type CoverProject } from './cover-project';
import { AUTOSAVE_VERSION, createAutosave, type CoverAutosaveBackend } from './cover-autosave';

class MemoryBackend implements CoverAutosaveBackend {
  value: unknown = undefined;
  async get() {
    return this.value;
  }
  async set(value: unknown) {
    this.value = structuredClone(value);
  }
  async clear() {
    this.value = undefined;
  }
}

const payload = (project: CoverProject) => ({
  version: AUTOSAVE_VERSION,
  savedAt: '2026-11-06T10:00:00.000Z',
  project,
});

describe('autosave', () => {
  it('writes and reads a project', async () => {
    const backend = new MemoryBackend();
    const autosave = createAutosave(backend, () => new Date('2026-11-06T10:00:00.000Z'));
    expect(await autosave.write(createProject())).toBe(true);
    const saved = await autosave.read();
    expect(saved?.savedAt).toBe('2026-11-06T10:00:00.000Z');
    expect(saved?.project.slots).toHaveLength(10);
  });

  it('ignores an unknown version or an invalid project', async () => {
    const backend = new MemoryBackend();
    const autosave = createAutosave(backend);
    backend.value = { ...payload(createProject()), version: 99 };
    expect(await autosave.read()).toBeNull();
    backend.value = { ...payload(createProject()), project: { format: 1 } };
    expect(await autosave.read()).toBeNull();
  });

  it('clears the stored value and survives backend failures', async () => {
    const backend = new MemoryBackend();
    const autosave = createAutosave(backend);
    await autosave.write(createProject());
    await autosave.clear();
    expect(await autosave.read()).toBeNull();

    const broken: CoverAutosaveBackend = {
      get: async () => {
        throw new Error('blocked');
      },
      set: async () => {
        throw new Error('blocked');
      },
      clear: async () => {
        throw new Error('blocked');
      },
    };
    const failed = createAutosave(broken);
    expect(await failed.read()).toBeNull();
    expect(await failed.write(createProject())).toBe(false);
  });
});
```

- [ ] **Step 2: Run the tests and watch them fail**

Run: `pnpm test -- site/src/lib/cover-autosave.test.ts`
Expected: FAIL because `cover-autosave.ts` does not exist.

- [ ] **Step 3: Write `cover-autosave.ts`**

```ts
import { isCoverProject, type CoverProject } from './cover-project';

export const AUTOSAVE_VERSION = 1;
export const AUTOSAVE_DELAY_MS = 600;
export const AUTOSAVE_KEY = 'current';

export interface CoverAutosaveBackend {
  get(): Promise<unknown>;
  set(value: unknown): Promise<void>;
  clear(): Promise<void>;
}

export interface AutosavePayload {
  version: typeof AUTOSAVE_VERSION;
  savedAt: string;
  project: CoverProject;
}

export interface CoverAutosave {
  read(): Promise<AutosavePayload | null>;
  write(project: CoverProject): Promise<boolean>;
  clear(): Promise<void>;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

export function createAutosave(
  backend: CoverAutosaveBackend,
  now: () => Date = () => new Date(),
): CoverAutosave {
  return {
    async read() {
      try {
        const value = await backend.get();
        if (
          !isRecord(value) ||
          value.version !== AUTOSAVE_VERSION ||
          typeof value.savedAt !== 'string'
        ) {
          return null;
        }
        const project = value.project;
        if (!isCoverProject(project)) return null;
        return { version: AUTOSAVE_VERSION, savedAt: value.savedAt, project };
      } catch {
        return null;
      }
    },

    async write(project) {
      try {
        await backend.set({ version: AUTOSAVE_VERSION, savedAt: now().toISOString(), project });
        return true;
      } catch {
        return false;
      }
    },

    async clear() {
      try {
        await backend.clear();
      } catch {
        // Storage may be unavailable; editing must not break.
      }
    },
  };
}

function openDatabase(dbName: string, storeName: string): Promise<IDBDatabase> {
  if (typeof indexedDB === 'undefined') {
    return Promise.reject(new Error('IndexedDB is unavailable'));
  }
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(dbName, 1);
    request.onupgradeneeded = () => {
      if (!request.result.objectStoreNames.contains(storeName)) {
        request.result.createObjectStore(storeName);
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error ?? new Error('IndexedDB open failed'));
  });
}

export function indexedDbBackend(
  dbName = 'yoto-community-covers',
  storeName = 'autosave',
  key = AUTOSAVE_KEY,
): CoverAutosaveBackend {
  function run<T>(
    mode: IDBTransactionMode,
    action: (store: IDBObjectStore) => IDBRequest<T>,
  ): Promise<T> {
    return openDatabase(dbName, storeName).then(
      (db) =>
        new Promise<T>((resolve, reject) => {
          const transaction = db.transaction(storeName, mode);
          const request = action(transaction.objectStore(storeName));
          request.onerror = () => reject(request.error ?? new Error('IndexedDB request failed'));
          transaction.oncomplete = () => {
            db.close();
            resolve(request.result);
          };
          transaction.onerror = () => {
            db.close();
            reject(transaction.error ?? new Error('IndexedDB transaction failed'));
          };
        }),
    );
  }

  return {
    get: () => run('readonly', (store) => store.get(key)),
    set: (value) => run('readwrite', (store) => store.put(value, key)).then(() => undefined),
    clear: () => run('readwrite', (store) => store.delete(key)).then(() => undefined),
  };
}
```

- [ ] **Step 4: Run the tests**

Run: `pnpm test -- site/src/lib/cover-autosave.test.ts && pnpm check:types`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add site/src/lib/cover-autosave.ts site/src/lib/cover-autosave.test.ts
git commit -m "feat(covers): add IndexedDB autosave"
```

---

### Task 7: Page shell, bilingual markup and routes

**Files:**

- Create: `site/src/lib/cover-copy.ts`
- Create: `site/src/components/YotoCover.astro`
- Create: `site/src/views/YotoCoverView.astro`
- Create: `site/src/pages/myo/covers/index.astro`
- Create: `site/src/pages/fr/myo/covers/index.astro`
- Modify: `site/src/i18n/en.ts`, `site/src/i18n/fr.ts`
- Modify: `site/src/components/Header.astro`
- Modify: `site/src/views/MyoView.astro`
- Modify: `scripts/check-search.ts`
- Create: `site/e2e/yoto-cover.spec.ts`

**Interfaces:**

- Consumes: `SheetValidationError` from `label-sheet`.
- Produces: `CoverCopy` type; page routes; markup with `[data-yoto-cover]`, `[data-yc-sheet]`, `[data-yc-slot-template]`, `[data-yc-custom]`, and all controls listed in the markup step.

- [ ] **Step 1: Create the copy contract**

`site/src/lib/cover-copy.ts`:

```ts
import type { SheetValidationError } from './label-sheet';

export interface CoverCopy {
  toolbarAria: string;
  newSheet: string;
  open: string;
  save: string;
  addImages: string;
  print: string;
  testPage: string;
  settings: string;
  projectName: string;
  projectNamePlaceholder: string;
  sheet: string;
  custom: string;
  paper: string;
  paperA4: string;
  paperLetter: string;
  columns: string;
  rows: string;
  labelWidth: string;
  labelHeight: string;
  marginX: string;
  marginY: string;
  gapX: string;
  gapY: string;
  layout: string;
  layoutSquare: string;
  layoutFill: string;
  rounded: string;
  cutLine: string;
  titleSize: string;
  offsetX: string;
  offsetY: string;
  calibrationNote: string;
  selected: string;
  noSelection: string;
  label: string;
  labelAria: string;
  empty: string;
  filled: string;
  title: string;
  titlePlaceholder: string;
  zoom: string;
  replaceImage: string;
  resetPosition: string;
  clearLabel: string;
  clearAll: string;
  trim: string;
  hint: string;
  privacy: string;
  printTips: string;
  restored: string;
  saved: string;
  opened: string;
  started: string;
  invalidFile: string;
  newerFile: string;
  saveError: string;
  defaultFileName: string;
  imageRejected: string;
  imageTooLarge: string;
  storageUnavailable: string;
  confirmNew: string;
  confirmClearAll: string;
  confirmShrink: string;
  sheetAria: string;
  ruler: string;
  dropHere: string;
  noscript: string;
  notes: { sheetFallback: string; missingImages: string };
  validation: Record<SheetValidationError, string>;
}
```

- [ ] **Step 2: Add i18n keys**

In `site/src/i18n/en.ts`:

```ts
'nav.covers': 'Card covers',
'cover.title': 'YotoCover — printable card covers',
'cover.lede':
  'Lay out ten covers on a label sheet, then print at true size or save a .yotolabels file. Everything stays in your browser.',
```

In `site/src/i18n/fr.ts`:

```ts
'nav.covers': 'Jaquettes',
'cover.title': 'YotoCover — jaquettes de cartes à imprimer',
'cover.lede':
  'Composez dix jaquettes sur une planche, puis imprimez à taille réelle ou enregistrez un fichier .yotolabels. Tout reste dans votre navigateur.',
```

- [ ] **Step 3: Create `YotoCover.astro`**

```astro
---
/**
 * YotoCover — atelier de jaquettes de cartes.
 *
 * Le composant ne porte que le balisage et les textes. La logique vit dans
 * `scripts/yoto-cover.ts` et les modules `lib/cover-*.ts`.
 */
import type { CoverCopy } from '../lib/cover-copy';
import type { Lang } from '../lib/routes';

interface Props {
  lang: Lang;
}

const { lang } = Astro.props;

const copy: CoverCopy =
  lang === 'fr'
    ? {
        toolbarAria: 'Actions de la planche',
        newSheet: 'Nouvelle planche',
        open: 'Ouvrir',
        save: 'Enregistrer',
        addImages: 'Ajouter des images',
        print: 'Imprimer / PDF',
        testPage: 'Page de test',
        settings: 'Réglages',
        projectName: 'Nom de la planche',
        projectNamePlaceholder: 'Les cartes de Mila',
        sheet: 'Planche',
        custom: 'Personnalisée',
        paper: 'Papier',
        paperA4: 'A4',
        paperLetter: 'Letter',
        columns: 'Colonnes',
        rows: 'Lignes',
        labelWidth: 'Largeur (mm)',
        labelHeight: 'Hauteur (mm)',
        marginX: 'Marge X (mm)',
        marginY: 'Marge Y (mm)',
        gapX: 'Écart X (mm)',
        gapY: 'Écart Y (mm)',
        layout: 'Mise en page',
        layoutSquare: 'Carré + titre',
        layoutFill: 'Jaquette plein cadre',
        rounded: 'Coins arrondis',
        cutLine: 'Ligne de coupe',
        titleSize: 'Taille du titre',
        offsetX: 'Décalage X (mm)',
        offsetY: 'Décalage Y (mm)',
        calibrationNote:
          'Si l’impression est décalée, ajustez X et Y, puis imprimez la page de test.',
        selected: 'Label sélectionné',
        noSelection: 'Cliquez un label pour le modifier.',
        label: 'Label {n}',
        labelAria: 'Label {n}, {state}',
        empty: 'vide',
        filled: 'image',
        title: 'Titre',
        titlePlaceholder: 'Titre',
        zoom: 'Zoom',
        replaceImage: 'Remplacer l’image',
        resetPosition: 'Recentrer',
        clearLabel: 'Vider ce label',
        clearAll: 'Tout vider',
        trim: 'couper',
        hint: 'Cliquez un label vide ou déposez des images. Glissez pour déplacer, molette pour zoomer, double-clic pour remplacer.',
        privacy: 'Tout reste dans votre navigateur. Rien n’est envoyé.',
        printTips: 'À l’impression : choisissez A4 ou Letter, l’échelle 100 % et aucune marge.',
        restored: 'Dernière planche restaurée.',
        saved: 'Planche enregistrée.',
        opened: 'Planche ouverte.',
        started: 'Nouvelle planche.',
        invalidFile: 'Ce fichier n’est pas une planche Yoto valide.',
        newerFile: 'Ce fichier a été créé par une version plus récente de YotoCover.',
        saveError: 'La planche n’a pas pu être enregistrée.',
        defaultFileName: 'jaquettes-yoto',
        imageRejected: '{count} fichier(s) ignoré(s) : format non pris en charge.',
        imageTooLarge: '{count} fichier(s) ignoré(s) : plus de 20 Mo.',
        storageUnavailable:
          'Le stockage local est indisponible : la planche ne sera pas restaurée automatiquement.',
        confirmNew: 'Remplacer la planche actuelle ?',
        confirmClearAll: 'Vider tous les labels ?',
        confirmShrink: 'Réduire la planche supprimera {count} label(s) rempli(s). Continuer ?',
        sheetAria: 'Aperçu de la planche de labels',
        ruler: '1 pouce',
        dropHere: 'Déposer une image',
        noscript:
          'JavaScript est nécessaire pour composer et imprimer une planche. Vous pouvez aussi utiliser l’application Windows YotoLabels.',
        notes: {
          sheetFallback: 'Planche inconnue : retour à TownStix US-10.',
          missingImages: 'Certaines images du fichier sont introuvables.',
        },
        validation: {
          paper: 'Papier inconnu.',
          columns: 'Le nombre de colonnes doit être un entier de 1 à 10.',
          rows: 'Le nombre de lignes doit être un entier de 1 à 10.',
          'label-width': 'La largeur doit être comprise entre 10 et 300 mm.',
          'label-height': 'La hauteur doit être comprise entre 10 et 300 mm.',
          margin: 'Les marges et écarts doivent être positifs.',
          overflow: 'La planche dépasse le papier.',
        },
      }
    : {
        toolbarAria: 'Sheet actions',
        newSheet: 'New sheet',
        open: 'Open',
        save: 'Save',
        addImages: 'Add images',
        print: 'Print / PDF',
        testPage: 'Test page',
        settings: 'Settings',
        projectName: 'Sheet name',
        projectNamePlaceholder: 'Mila’s cards',
        sheet: 'Sheet',
        custom: 'Custom',
        paper: 'Paper',
        paperA4: 'A4',
        paperLetter: 'Letter',
        columns: 'Columns',
        rows: 'Rows',
        labelWidth: 'Width (mm)',
        labelHeight: 'Height (mm)',
        marginX: 'Margin X (mm)',
        marginY: 'Margin Y (mm)',
        gapX: 'Gap X (mm)',
        gapY: 'Gap Y (mm)',
        layout: 'Layout',
        layoutSquare: 'Square + title',
        layoutFill: 'Cover fills the card',
        rounded: 'Rounded corners',
        cutLine: 'Cut line',
        titleSize: 'Title size',
        offsetX: 'Offset X (mm)',
        offsetY: 'Offset Y (mm)',
        calibrationNote:
          'If the print is shifted, adjust X and Y, then print the test page.',
        selected: 'Selected label',
        noSelection: 'Click a label to edit it.',
        label: 'Label {n}',
        labelAria: 'Label {n}, {state}',
        empty: 'empty',
        filled: 'image',
        title: 'Title',
        titlePlaceholder: 'Title',
        zoom: 'Zoom',
        replaceImage: 'Replace image',
        resetPosition: 'Reset position',
        clearLabel: 'Clear this label',
        clearAll: 'Clear all',
        trim: 'trim',
        hint: 'Click an empty label or drop images. Drag to move, wheel to zoom, double-click to replace.',
        privacy: 'Everything stays in your browser. Nothing is uploaded.',
        printTips: 'When printing: choose A4 or Letter, 100 % scale and no margins.',
        restored: 'Your last sheet was restored.',
        saved: 'Sheet saved.',
        opened: 'Sheet opened.',
        started: 'New sheet.',
        invalidFile: 'This file is not a valid Yoto sheet.',
        newerFile: 'This file was made by a newer version of YotoCover.',
        saveError: 'The sheet could not be saved.',
        defaultFileName: 'yoto-covers',
        imageRejected: '{count} file(s) skipped: unsupported image type.',
        imageTooLarge: '{count} file(s) skipped: over 20 MB.',
        storageUnavailable:
          'Local storage is unavailable: the sheet will not be restored automatically.',
        confirmNew: 'Replace the current sheet?',
        confirmClearAll: 'Clear every label?',
        confirmShrink: 'Shrinking the sheet removes {count} filled label(s). Continue?',
        sheetAria: 'Label sheet preview',
        ruler: '1 inch',
        dropHere: 'Drop an image',
        noscript:
          'JavaScript is needed to compose and print a sheet. You can also use the YotoLabels Windows app.',
        notes: {
          sheetFallback: 'Unknown sheet: falling back to TownStix US-10.',
          missingImages: 'Some images in the file could not be found.',
        },
        validation: {
          paper: 'Unknown paper.',
          columns: 'Columns must be an integer from 1 to 10.',
          rows: 'Rows must be an integer from 1 to 10.',
          'label-width': 'Width must be between 10 and 300 mm.',
          'label-height': 'Height must be between 10 and 300 mm.',
          margin: 'Margins and gaps must be positive.',
          overflow: 'The sheet overflows the paper.',
        },
      };
---

<div class="yoto-cover" data-yoto-cover data-copy={JSON.stringify(copy)}>
  <div class="yc-toolbar" role="toolbar" aria-label={copy.toolbarAria}>
    <button type="button" class="yc-btn" data-yc-new>{copy.newSheet}</button>
    <button type="button" class="yc-btn" data-yc-open>{copy.open}</button>
    <button type="button" class="yc-btn" data-yc-save>{copy.save}</button>
    <button type="button" class="yc-btn" data-yc-add>{copy.addImages}</button>
    <button type="button" class="yc-btn yc-btn--primary" data-yc-print>{copy.print}</button>
    <label class="yc-toggle">
      <input type="checkbox" data-yc-test />
      {copy.testPage}
    </label>
    <input type="file" accept=".yotolabels,application/zip" data-yc-open-input hidden />
    <input type="file" accept="image/*" multiple data-yc-add-input hidden />
    <input type="file" accept="image/*" data-yc-slot-input hidden />
  </div>

  <p class="yc-status" data-yc-status role="status" aria-live="polite" hidden></p>

  <div class="yc-body">
    <aside class="yc-side">
      <fieldset class="yc-group">
        <legend>{copy.settings}</legend>

        <label>
          {copy.projectName}
          <input type="text" maxlength="100" placeholder={copy.projectNamePlaceholder} data-yc-name />
        </label>

        <label>
          {copy.sheet}
          <select data-yc-preset>
            <option value="townstix-us10">TownStix US-10</option>
            <option value="a4-2x5">A4 2 × 5</option>
            <option value="custom">{copy.custom}</option>
          </select>
        </label>

        <div class="yc-custom" data-yc-custom hidden>
          <label>
            {copy.paper}
            <select data-yc-paper>
              <option value="letter">{copy.paperLetter}</option>
              <option value="a4">{copy.paperA4}</option>
            </select>
          </label>
          <div class="yc-grid">
            <label>{copy.columns}<input type="number" min="1" max="10" step="1" data-yc-columns /></label>
            <label>{copy.rows}<input type="number" min="1" max="10" step="1" data-yc-rows /></label>
            <label>{copy.labelWidth}<input type="number" min="10" max="300" step="0.1" data-yc-label-width /></label>
            <label>{copy.labelHeight}<input type="number" min="10" max="300" step="0.1" data-yc-label-height /></label>
            <label>{copy.marginX}<input type="number" min="0" step="0.1" data-yc-margin-x /></label>
            <label>{copy.marginY}<input type="number" min="0" step="0.1" data-yc-margin-y /></label>
            <label>{copy.gapX}<input type="number" min="0" step="0.1" data-yc-gap-x /></label>
            <label>{copy.gapY}<input type="number" min="0" step="0.1" data-yc-gap-y /></label>
          </div>
        </div>

        <fieldset class="yc-layout">
          <legend>{copy.layout}</legend>
          <label>
            <input type="radio" name="yc-layout" value="square-cover-title" checked />
            {copy.layoutSquare}
          </label>
          <label>
            <input type="radio" name="yc-layout" value="fill-card" />
            {copy.layoutFill}
          </label>
        </fieldset>

        <label class="yc-check"><input type="checkbox" data-yc-rounded /> {copy.rounded}</label>
        <label class="yc-check"><input type="checkbox" data-yc-cut /> {copy.cutLine}</label>

        <div class="yc-grid">
          <label>{copy.titleSize}<input type="number" min="6" max="48" step="1" data-yc-title-size /></label>
          <label>{copy.offsetX}<input type="number" min="-20" max="20" step="0.1" data-yc-offset-x /></label>
          <label>{copy.offsetY}<input type="number" min="-20" max="20" step="0.1" data-yc-offset-y /></label>
        </div>
        <p class="yc-note">{copy.calibrationNote}</p>
      </fieldset>

      <fieldset class="yc-group" data-yc-inspector>
        <legend>{copy.selected}</legend>
        <p data-yc-no-selection>{copy.noSelection}</p>
        <div data-yc-selected hidden>
          <p class="yc-selected-name" data-yc-selected-name></p>
          <label>
            {copy.title}
            <input type="text" maxlength="200" data-yc-title />
          </label>
          <label>
            {copy.zoom}
            <input type="range" min="0.2" max="8" step="0.05" data-yc-zoom />
          </label>
          <div class="yc-actions">
            <button type="button" class="yc-btn" data-yc-replace>{copy.replaceImage}</button>
            <button type="button" class="yc-btn" data-yc-reset>{copy.resetPosition}</button>
            <button type="button" class="yc-btn" data-yc-clear>{copy.clearLabel}</button>
          </div>
        </div>
      </fieldset>

      <button type="button" class="yc-btn yc-btn--danger" data-yc-clear-all>{copy.clearAll}</button>
    </aside>

    <div class="yc-preview">
      <div class="yc-sheet-wrap" data-yc-wrap>
        <div class="yc-sheet" data-yc-sheet role="group" aria-label={copy.sheetAria} data-mode="design">
          <template data-yc-slot-template>
            <div class="yc-label" data-yc-slot tabindex="0" role="group">
              <div class="yc-card">
                <div class="yc-art" data-yc-art>
                  <img data-yc-image alt="" hidden />
                  <span class="yc-empty" data-yc-empty>
                    <span aria-hidden="true">+</span>
                    <span>{copy.dropHere}</span>
                  </span>
                </div>
                <div class="yc-title" data-yc-title></div>
              </div>
              <div class="yc-trim"><span>{copy.trim}</span></div>
              <span class="yc-number" data-yc-number aria-hidden="true"></span>
              <span class="yc-outline" aria-hidden="true"></span>
              <span class="yc-crosshair" aria-hidden="true"></span>
              <span class="yc-cardline" aria-hidden="true"></span>
            </div>
          </template>
        </div>
      </div>
      <p class="yc-hint">{copy.hint}</p>
      <p class="yc-print-tips">{copy.printTips}</p>
    </div>
  </div>

  <p class="yc-privacy">{copy.privacy}</p>

  <noscript>
    <p class="yc-noscript">{copy.noscript}</p>
  </noscript>
</div>

<script>
  const roots = document.querySelectorAll<HTMLElement>('[data-yoto-cover]');
  if (roots.length > 0) {
    void import('../scripts/yoto-cover').then(({ mountYotoCover }) => {
      roots.forEach((root) => mountYotoCover(root));
    });
  }
</script>
```

- [ ] **Step 4: Add the view and the two routes**

`site/src/views/YotoCoverView.astro`:

```astro
---
import YotoCover from '../components/YotoCover.astro';
import { localePath, type Lang } from '../lib/routes';

const { lang } = Astro.props as { lang: Lang };
const copy =
  lang === 'fr'
    ? {
        eyebrow: 'Outil',
        note: 'Les planches TownStix US-10 et A4 2 × 5 générique sont incluses. Imprimez d’abord la page de test, puis choisissez l’échelle 100 % et aucune marge.',
        back: 'Retour au parcours MYO',
      }
    : {
        eyebrow: 'Tool',
        note: 'TownStix US-10 and a generic A4 2 × 5 sheet are included. Print the test page first, then choose 100 % scale and no margins.',
        back: 'Back to the MYO guide',
      };
---

<section class="container page">
  <header class="no-print">
    <p class="eyebrow">{copy.eyebrow}</p>
    <h1>YotoCover</h1>
    <p class="lede">
      {
        lang === 'fr'
          ? 'Composez dix jaquettes sur une planche de labels, zoomez et positionnez chaque image, puis imprimez à taille réelle ou enregistrez un fichier .yotolabels.'
          : 'Lay out ten covers on a label sheet, zoom and position each picture, then print at true size or save a .yotolabels file.'
      }
    </p>
  </header>

  <YotoCover lang={lang} />

  <p class="note no-print">{copy.note}</p>
  <a class="no-print" href={localePath(lang, '/myo/')}>{copy.back} →</a>
</section>

<style>
  .page {
    padding-block: var(--space-8);
    max-width: 1280px;
  }
  .eyebrow {
    text-transform: uppercase;
    letter-spacing: 0.12em;
    font-size: 0.8rem;
    font-weight: 800;
    color: var(--accent);
  }
  .lede {
    color: var(--ink-muted);
    font-size: 1.15rem;
    max-width: 62ch;
  }
  .note {
    margin-top: var(--space-6);
    max-width: 70ch;
    color: var(--ink-muted);
    font-size: 0.95rem;
  }
</style>
```

`site/src/pages/myo/covers/index.astro`:

```astro
---
import Base from '../../../layouts/Base.astro';
import YotoCoverView from '../../../views/YotoCoverView.astro';
import { t } from '../../../i18n';
---

<Base
  lang="en"
  title={t('en', 'cover.title')}
  description={t('en', 'cover.lede')}
  path="/myo/covers/"
>
  <YotoCoverView lang="en" />
</Base>
```

`site/src/pages/fr/myo/covers/index.astro` uses the same file with `../../../../` imports, `lang="fr"`, `t('fr', …)`, and `path="/myo/covers/"`.

- [ ] **Step 5: Link the page from the header, the MYO guide and the build check**

In `site/src/components/Header.astro`, add to `toolsLinks`:

```ts
{ href: localePath(lang, '/myo/covers/'), label: t(lang, 'nav.covers'), prefix: '/myo/covers/' },
```

In `site/src/views/MyoView.astro`, after the step 3 CTA block, add:

```astro
{step.n === 6 && (
  <p class="step-cta">
    <a class="btn" href={localePath(lang, '/myo/covers/')}>
      {lang === 'fr' ? 'Créer mes jaquettes' : 'Create my covers'}
    </a>
  </p>
)}
```

In `scripts/check-search.ts`, add to `required`:

```ts
'myo/covers/index.html',
'fr/myo/covers/index.html',
```

- [ ] **Step 6: Write the first E2E test**

`site/e2e/yoto-cover.spec.ts`:

```ts
import { expect, test } from '@playwright/test';

test.describe('without JavaScript', () => {
  test.use({ javaScriptEnabled: false });

  test('explains that JavaScript is required', async ({ page }) => {
    await page.goto('/myo/covers/');
    await expect(page.getByRole('heading', { name: 'YotoCover' })).toBeVisible();
    await expect(page.locator('.yc-noscript')).toContainText('JavaScript');
  });
});

test('is linked from the header and the MYO guide', async ({ page }) => {
  await page.goto('/myo/');
  await expect(page.getByRole('link', { name: 'Create my covers' })).toBeVisible();

  await page
    .locator('details[data-nav-group]')
    .filter({ hasText: 'Tools' })
    .locator('summary')
    .click();
  await expect(
    page.locator('.site-header').getByRole('link', { name: 'Card covers' }),
  ).toBeVisible();
});
```

- [ ] **Step 7: Add the temporary controller stub, then build and run the E2E test**

Create `site/src/scripts/yoto-cover.ts` with the exported signature and an empty body:

```ts
export interface CoverEditor {
  destroy(): void;
}

export function mountYotoCover(root: HTMLElement): CoverEditor {
  void root;
  return { destroy() {} };
}
```

Run: `pnpm build && pnpm --filter site test:e2e -- yoto-cover.spec.ts`
Expected: PASS.

- [ ] **Step 8: Commit**

```bash
git add site/src/lib/cover-copy.ts site/src/components/YotoCover.astro \
  site/src/views/YotoCoverView.astro site/src/pages/myo/covers site/src/pages/fr/myo/covers \
  site/src/i18n/en.ts site/src/i18n/fr.ts site/src/components/Header.astro \
  site/src/views/MyoView.astro scripts/check-search.ts site/e2e/yoto-cover.spec.ts \
  site/src/scripts/yoto-cover.ts
git commit -m "feat(covers): add YotoCover page, markup and routes"
```

---

### Task 8: Styles and controller core (render, settings, selection)

**Files:**

- Create: `site/src/styles/yoto-cover.css`
- Modify: `site/src/components/YotoCover.astro` (import the stylesheet)
- Replace: `site/src/scripts/yoto-cover.ts`
- Modify: `site/e2e/yoto-cover.spec.ts`

**Interfaces:**

- Consumes: `CoverCopy`, `CoverProject`, `createProject`, `emptySlot`, `setSheet`, `updateSlot`, `clearSlot`, `clearAll`, `resetSlotPosition`, `validateSheetConfig`, `labelPositions`, `paperSizeMm`, `cardZoneWidthMm`, `trimWidthMm`, `presetById`, `transformStyle`.
- Produces: `mountYotoCover(root)` with `destroy()`; a fully rendered sheet and settings panel.

- [ ] **Step 1: Write the stylesheet**

`site/src/styles/yoto-cover.css`:

```css
.yoto-cover {
  display: grid;
  gap: var(--space-4);
  margin-top: var(--space-6);
}

.yc-toolbar {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: var(--space-2);
}

.yc-btn {
  font: inherit;
  font-size: 0.85rem;
  font-weight: 800;
  color: var(--ink);
  background: var(--surface);
  border: 1px solid var(--border);
  border-radius: var(--radius-pill);
  padding: 0.5rem 0.9rem;
  cursor: pointer;
}
.yc-btn:hover {
  border-color: var(--accent);
  color: var(--accent-strong);
}
.yc-btn:disabled {
  opacity: 0.45;
  cursor: default;
}
.yc-btn--primary {
  background: var(--accent);
  border-color: var(--accent);
  color: var(--bg);
}
.yc-btn--primary:hover {
  background: var(--accent-strong);
  color: var(--bg);
}
.yc-btn--danger {
  color: var(--danger);
}
.yc-toggle {
  display: inline-flex;
  gap: 0.4rem;
  align-items: center;
  font-weight: 700;
}

.yc-status {
  margin: 0;
  padding: var(--space-2) var(--space-3);
  border-radius: var(--radius-sm);
  background: var(--accent-soft);
  color: var(--accent-strong);
  font-weight: 700;
}
.yc-status[data-tone='error'] {
  background: color-mix(in srgb, var(--danger) 12%, transparent);
  color: var(--danger);
}

.yc-body {
  display: grid;
  grid-template-columns: 320px minmax(0, 1fr);
  gap: var(--space-5);
  align-items: start;
}

.yc-side {
  display: grid;
  gap: var(--space-3);
}
.yc-group {
  display: grid;
  gap: var(--space-2);
  min-width: 0;
  margin: 0;
  padding: var(--space-3);
  background: var(--surface);
  border: 1px solid var(--border);
  border-radius: var(--radius-sm);
}
.yc-group legend {
  font-weight: 800;
  padding-inline: 0.3rem;
}
.yc-group label {
  display: grid;
  gap: 0.2rem;
  font-size: 0.82rem;
  font-weight: 700;
}
.yc-group input[type='text'],
.yc-group input[type='number'],
.yc-group select {
  font: inherit;
  font-size: 0.85rem;
  width: 100%;
  padding: 0.35rem 0.45rem;
  border: 1px solid var(--border);
  border-radius: var(--radius-sm);
  background: var(--bg);
  color: var(--ink);
}
.yc-grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: var(--space-2);
}
.yc-custom {
  display: grid;
  gap: var(--space-2);
}
.yc-layout {
  display: grid;
  gap: 0.3rem;
  border: 0;
  padding: 0;
  margin: 0;
}
.yc-layout legend {
  padding: 0;
  font-size: 0.82rem;
  font-weight: 700;
}
.yc-layout label,
.yc-check {
  display: flex !important;
  align-items: center;
  gap: 0.4rem;
  font-size: 0.82rem;
}
.yc-check {
  font-weight: 700;
}
.yc-note {
  margin: 0;
  color: var(--ink-muted);
  font-size: 0.75rem;
}
.yc-actions {
  display: flex;
  flex-wrap: wrap;
  gap: var(--space-2);
}
.yc-selected-name {
  margin: 0;
  font-weight: 800;
}

.yc-preview {
  min-width: 0;
  overflow-x: auto;
}
.yc-sheet-wrap {
  width: 100%;
}
.yc-sheet {
  position: relative;
  transform-origin: top left;
  background: #fff;
  color: #000;
  box-shadow: 0 8px 30px rgb(0 0 0 / 0.18);
  --yc-card-width: 85.725mm;
  --yc-trim-width: 15.875mm;
  --yc-label-height: 50.8mm;
  --yc-title-size: 14px;
}

.yc-label {
  position: absolute;
  box-sizing: border-box;
  background: #fff;
  border: 1px dashed #c8c8c8;
  cursor: pointer;
}
.yc-label:focus-visible {
  outline: 3px solid var(--accent);
  outline-offset: 2px;
}
.yc-label.is-selected {
  border-color: var(--accent);
  box-shadow: inset 0 0 0 2px var(--accent);
}

.yc-card {
  position: absolute;
  inset: 0 auto 0 0;
  width: var(--yc-card-width);
  height: 100%;
  display: grid;
  overflow: hidden;
}
.yc-sheet[data-layout='square-cover-title'] .yc-card {
  grid-template-columns: var(--yc-label-height) 1fr;
}
.yc-sheet[data-layout='fill-card'] .yc-card {
  display: block;
}

.yc-art {
  position: relative;
  overflow: hidden;
  background: #eef3fc;
}
.yc-sheet[data-layout='fill-card'] .yc-art {
  position: absolute;
  inset: 0;
}
.yc-art img {
  position: absolute;
  inset: 0;
  width: 100%;
  height: 100%;
  object-fit: cover;
  transform-origin: center;
  pointer-events: none;
}
.yc-empty {
  position: absolute;
  inset: 0;
  display: grid;
  place-content: center;
  justify-items: center;
  gap: 2mm;
  color: #60709f;
  font-size: 10px;
  text-align: center;
  padding: 2mm;
}
.yc-empty [aria-hidden='true'] {
  font-size: 20px;
  line-height: 1;
}

.yc-title {
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 2mm;
  overflow: hidden;
  overflow-wrap: anywhere;
  font-size: var(--yc-title-size);
  font-weight: 600;
  line-height: 1.15;
  text-align: center;
}
.yc-title.is-empty::after {
  content: attr(data-placeholder);
  color: #a0a0a0;
}
.yc-sheet[data-layout='fill-card'] .yc-title {
  position: absolute;
  left: 0;
  right: 0;
  bottom: 0;
  display: block;
  padding: 1mm 2mm;
  background: rgb(255 255 255 / 0.85);
  font-size: calc(var(--yc-title-size) * 0.85);
  text-align: left;
  white-space: nowrap;
  text-overflow: ellipsis;
}
.yc-sheet[data-layout='fill-card'] .yc-title.is-empty {
  background: transparent;
}

.yc-trim {
  position: absolute;
  left: var(--yc-card-width);
  top: 0;
  width: var(--yc-trim-width);
  height: 100%;
  display: grid;
  place-items: center;
  overflow: hidden;
  color: #aaa;
  font-size: 9px;
  letter-spacing: 0.1em;
  text-transform: uppercase;
}
.yc-trim span {
  writing-mode: vertical-rl;
}

.yc-cardline {
  position: absolute;
  left: var(--yc-card-width);
  top: 0;
  bottom: 0;
  border-left: 1px dashed #999;
  display: none;
}
.yc-sheet[data-cut='true'] .yc-cardline {
  display: block;
}
.yc-sheet[data-mode='test'] .yc-cardline {
  display: block;
}

.yc-sheet[data-rounded='true'][data-layout='square-cover-title'] .yc-card {
  border-radius: 3mm 0 0 3mm;
}
.yc-sheet[data-rounded='true'][data-layout='square-cover-title'] .yc-title {
  border-radius: 0 3mm 3mm 0;
}
.yc-sheet[data-rounded='true'][data-layout='fill-card'] .yc-card {
  border-radius: 3mm;
}

.yc-number,
.yc-outline,
.yc-crosshair,
.yc-ruler {
  display: none;
}
.yc-sheet[data-mode='test'] .yc-art img,
.yc-sheet[data-mode='test'] .yc-empty,
.yc-sheet[data-mode='test'] .yc-title,
.yc-sheet[data-mode='test'] .yc-trim span {
  display: none;
}
.yc-sheet[data-mode='test'] .yc-outline {
  display: block;
  position: absolute;
  inset: 0;
  border: 0.3mm solid #000;
}
.yc-sheet[data-mode='test'] .yc-number {
  display: block;
  position: absolute;
  top: 1mm;
  left: 1.5mm;
  font-size: 10px;
  color: #555;
}
.yc-sheet[data-mode='test'] .yc-crosshair {
  display: block;
  position: absolute;
  left: 50%;
  top: 50%;
  width: 8mm;
  height: 8mm;
  transform: translate(-50%, -50%);
}
.yc-crosshair::before,
.yc-crosshair::after {
  content: '';
  position: absolute;
  background: #888;
}
.yc-crosshair::before {
  left: 0;
  right: 0;
  top: 50%;
  height: 0.25mm;
}
.yc-crosshair::after {
  top: 0;
  bottom: 0;
  left: 50%;
  width: 0.25mm;
}
.yc-sheet[data-mode='test'] .yc-ruler {
  display: flex;
  position: absolute;
  left: 6mm;
  bottom: 4mm;
  align-items: center;
  gap: 2mm;
  color: #555;
  font-size: 9px;
}
.yc-ruler-bar {
  display: block;
  width: 25.4mm;
  height: 0;
  border-top: 0.4mm solid #000;
  position: relative;
}
.yc-ruler-bar::before,
.yc-ruler-bar::after {
  content: '';
  position: absolute;
  top: -1.5mm;
  height: 3mm;
  border-left: 0.4mm solid #000;
}
.yc-ruler-bar::before {
  left: 0;
}
.yc-ruler-bar::after {
  right: 0;
}

.yc-hint,
.yc-print-tips,
.yc-privacy,
.yc-noscript {
  color: var(--ink-muted);
  font-size: 0.85rem;
  max-width: 75ch;
}
.yc-privacy {
  margin: 0;
}

@media (max-width: 980px) {
  .yc-body {
    grid-template-columns: 1fr;
  }
}

@media print {
  body {
    margin: 0 !important;
    background: #fff !important;
  }
  .site-header,
  .site-footer,
  .skip-link,
  .yc-toolbar,
  .yc-side,
  .yc-status,
  .yc-hint,
  .yc-print-tips,
  .yc-privacy,
  .yc-noscript,
  .no-print {
    display: none !important;
  }
  main,
  .container,
  .yoto-cover,
  .yc-body,
  .yc-preview,
  .yc-sheet-wrap {
    display: block !important;
    margin: 0 !important;
    padding: 0 !important;
    max-width: none !important;
    width: auto !important;
    height: auto !important;
    overflow: visible !important;
  }
  .yc-sheet {
    transform: none !important;
    box-shadow: none !important;
  }
  .yc-label {
    border: none !important;
  }
  .yc-label.is-selected {
    box-shadow: none !important;
  }
  .yc-empty,
  .yc-number,
  .yc-outline,
  .yc-crosshair,
  .yc-ruler {
    display: none !important;
  }
  .yc-sheet[data-mode='test'] .yc-outline,
  .yc-sheet[data-mode='test'] .yc-number,
  .yc-sheet[data-mode='test'] .yc-crosshair,
  .yc-sheet[data-mode='test'] .yc-ruler {
    display: block !important;
  }
  .yc-sheet[data-mode='test'] .yc-ruler {
    display: flex !important;
  }
  .yc-trim span {
    display: none !important;
  }
  .yc-title.is-empty::after {
    content: '' !important;
  }
  .yc-sheet,
  .yc-title {
    print-color-adjust: exact;
    -webkit-print-color-adjust: exact;
  }
  .yc-art img {
    print-color-adjust: exact;
    -webkit-print-color-adjust: exact;
  }
}
```

Add this line to the frontmatter of `YotoCover.astro`:

```astro
import '../styles/yoto-cover.css';
```

- [ ] **Step 2: Replace `scripts/yoto-cover.ts` with the core controller**

```ts
/**
 * YotoCover — contrôleur DOM sans framework.
 *
 * L'état et les calculs vivent dans `lib/cover-*.ts`. Ce module ne fait que
 * projeter le projet sur le DOM et renvoyer les interactions.
 */
import type { CoverCopy } from '../lib/cover-copy';
import {
  DEFAULT_TITLE_FONT_SIZE,
  clearAll,
  clearSlot,
  createProject,
  emptySlot,
  resetSlotPosition,
  updateSlot,
  type CoverProject,
} from '../lib/cover-project';
import { transformStyle } from '../lib/cover-transform';
import {
  cardZoneWidthMm,
  labelPositions,
  paperSizeMm,
  presetById,
  trimWidthMm,
  validateSheetConfig,
  type LabelSheetConfig,
} from '../lib/label-sheet';

interface EditorState {
  project: CoverProject;
  selected: number | null;
  mode: 'design' | 'test';
}

export interface CoverEditor {
  destroy(): void;
}

function readCopy(root: HTMLElement): CoverCopy {
  const raw = root.dataset.copy;
  if (!raw) throw new Error('YotoCover: missing copy');
  return JSON.parse(raw) as CoverCopy;
}

function requireElement<T extends Element>(element: T | null, name: string): T {
  if (!element) throw new Error(`YotoCover: missing ${name}`);
  return element;
}

function clampNumber(value: number, min: number, max: number, fallback: number): number {
  return Math.min(max, Math.max(min, Number.isFinite(value) ? value : fallback));
}

export function mountYotoCover(root: HTMLElement): CoverEditor {
  const copy = readCopy(root);
  let state: EditorState = { project: createProject(), selected: null, mode: 'design' };
  let labels: HTMLElement[] = [];
  const urls = new Map<string, string>();

  const sheet = requireElement(root.querySelector<HTMLElement>('[data-yc-sheet]'), 'sheet');
  const wrap = requireElement(root.querySelector<HTMLElement>('[data-yc-wrap]'), 'wrap');
  const template = requireElement(
    root.querySelector<HTMLTemplateElement>('[data-yc-slot-template]'),
    'slot template',
  );
  const status = root.querySelector<HTMLElement>('[data-yc-status]');

  const $ = <T extends Element>(selector: string): T | null => root.querySelector<T>(selector);
  const $$ = <T extends Element>(selector: string): T[] => [...root.querySelectorAll<T>(selector)];

  function setStatus(message: string, tone: 'info' | 'error' = 'info'): void {
    if (!status) return;
    status.textContent = message;
    status.dataset.tone = tone;
    status.hidden = false;
  }

  function clearStatus(): void {
    if (!status) return;
    status.hidden = true;
    status.textContent = '';
  }

  function setInput(element: HTMLInputElement | HTMLSelectElement | null, value: string): void {
    if (element && document.activeElement !== element) element.value = value;
  }

  function imageUrl(image: { id: string; blob: Blob }): string {
    let url = urls.get(image.id);
    if (!url) {
      url = URL.createObjectURL(image.blob);
      urls.set(image.id, url);
    }
    return url;
  }

  function pruneUrls(): void {
    const used = new Set(
      state.project.slots
        .map((slot) => slot.image?.id)
        .filter((id): id is string => typeof id === 'string'),
    );
    for (const [id, url] of urls) {
      if (!used.has(id)) {
        URL.revokeObjectURL(url);
        urls.delete(id);
      }
    }
  }

  function ensureLabels(count: number): void {
    if (labels.length === count) return;
    const fragment = document.createDocumentFragment();
    labels = Array.from({ length: count }, (_, index) => {
      const node = template.content.firstElementChild?.cloneNode(true) as HTMLElement;
      node.dataset.index = String(index);
      const number = node.querySelector<HTMLElement>('[data-yc-number]');
      if (number) number.textContent = String(index + 1);
      fragment.append(node);
      return node;
    });
    sheet.replaceChildren(fragment);
  }

  function renderLabel(label: HTMLElement, index: number): void {
    const slot = state.project.slots[index];
    if (!slot) return;
    const position = labelPositions(state.project.sheet)[index];
    if (!position) return;

    label.style.left = `${position.xMm + state.project.offsetXMm}mm`;
    label.style.top = `${position.yMm + state.project.offsetYMm}mm`;
    label.style.width = `${position.widthMm}mm`;
    label.style.height = `${position.heightMm}mm`;
    label.dataset.filled = String(slot.image !== null);
    label.classList.toggle('is-selected', state.selected === index);
    label.setAttribute(
      'aria-label',
      copy.labelAria
        .replace('{n}', String(index + 1))
        .replace('{state}', slot.image ? slot.title || copy.filled : copy.empty),
    );

    const image = label.querySelector<HTMLImageElement>('[data-yc-image]');
    const empty = label.querySelector<HTMLElement>('[data-yc-empty]');
    if (image) {
      if (slot.image) {
        image.src = imageUrl(slot.image);
        image.alt = slot.title || slot.image.fileName;
        image.hidden = false;
        image.style.transform = transformStyle(slot);
      } else {
        image.hidden = true;
        image.removeAttribute('src');
        image.alt = '';
        image.style.transform = '';
      }
    }
    if (empty) empty.hidden = slot.image !== null;

    const title = label.querySelector<HTMLElement>('[data-yc-title]');
    if (title) {
      title.textContent = slot.title;
      title.dataset.placeholder = copy.titlePlaceholder;
      title.classList.toggle('is-empty', slot.title === '');
    }
  }

  function renderSheet(): void {
    const project = state.project;
    ensureLabels(project.slots.length);
    const paper = paperSizeMm(project.sheet.paper);
    sheet.style.width = `${paper.widthMm}mm`;
    sheet.style.height = `${paper.heightMm}mm`;
    sheet.dataset.layout = project.layout;
    sheet.dataset.rounded = String(project.roundedCorners);
    sheet.dataset.cut = String(project.printCutLine);
    sheet.dataset.mode = state.mode;
    sheet.style.setProperty('--yc-card-width', `${cardZoneWidthMm(project.sheet)}mm`);
    sheet.style.setProperty('--yc-trim-width', `${trimWidthMm(project.sheet)}mm`);
    sheet.style.setProperty('--yc-label-height', `${project.sheet.labelHeightMm}mm`);
    sheet.style.setProperty('--yc-title-size', `${project.titleFontSize}px`);
    labels.forEach(renderLabel);
    window.requestAnimationFrame(fitPreview);
  }

  function renderSettings(): void {
    const project = state.project;
    setInput($<HTMLInputElement>('[data-yc-name]'), project.name);
    setInput($<HTMLSelectElement>('[data-yc-preset]'), project.sheetId);

    const custom = $<HTMLElement>('[data-yc-custom]');
    if (custom) custom.hidden = project.sheetId !== 'custom';

    setInput($<HTMLSelectElement>('[data-yc-paper]'), project.sheet.paper);
    setInput($<HTMLInputElement>('[data-yc-columns]'), String(project.sheet.columns));
    setInput($<HTMLInputElement>('[data-yc-rows]'), String(project.sheet.rows));
    setInput($<HTMLInputElement>('[data-yc-label-width]'), String(project.sheet.labelWidthMm));
    setInput($<HTMLInputElement>('[data-yc-label-height]'), String(project.sheet.labelHeightMm));
    setInput($<HTMLInputElement>('[data-yc-margin-x]'), String(project.sheet.marginXMm));
    setInput($<HTMLInputElement>('[data-yc-margin-y]'), String(project.sheet.marginYMm));
    setInput($<HTMLInputElement>('[data-yc-gap-x]'), String(project.sheet.gapXMm));
    setInput($<HTMLInputElement>('[data-yc-gap-y]'), String(project.sheet.gapYMm));
    setInput($<HTMLInputElement>('[data-yc-title-size]'), String(project.titleFontSize));
    setInput($<HTMLInputElement>('[data-yc-offset-x]'), String(project.offsetXMm));
    setInput($<HTMLInputElement>('[data-yc-offset-y]'), String(project.offsetYMm));

    const rounded = $<HTMLInputElement>('[data-yc-rounded]');
    if (rounded) rounded.checked = project.roundedCorners;
    const cut = $<HTMLInputElement>('[data-yc-cut]');
    if (cut) cut.checked = project.printCutLine;

    for (const radio of $$<HTMLInputElement>('input[name="yc-layout"]')) {
      radio.checked = radio.value === project.layout;
    }
  }

  function renderInspector(): void {
    const selected = $<HTMLElement>('[data-yc-selected]');
    const empty = $<HTMLElement>('[data-yc-no-selection]');
    if (state.selected === null || !state.project.slots[state.selected]) {
      if (selected) selected.hidden = true;
      if (empty) empty.hidden = false;
      return;
    }

    const slot = state.project.slots[state.selected];
    if (selected) selected.hidden = false;
    if (empty) empty.hidden = true;
    const name = $<HTMLElement>('[data-yc-selected-name]');
    if (name) name.textContent = copy.label.replace('{n}', String(state.selected + 1));
    setInput($<HTMLInputElement>('[data-yc-title]'), slot.title);
    const zoom = $<HTMLInputElement>('[data-yc-zoom]');
    if (zoom) zoom.value = String(slot.zoom);
    const reset = $<HTMLButtonElement>('[data-yc-reset]');
    if (reset) reset.disabled = slot.image === null;
    const clear = $<HTMLButtonElement>('[data-yc-clear]');
    if (clear) clear.disabled = slot.image === null && slot.title === '';
    const replace = $<HTMLButtonElement>('[data-yc-replace]');
    if (replace) replace.disabled = false;
  }

  function select(index: number): void {
    if (index < 0 || index >= state.project.slots.length) return;
    state.selected = index;
    labels.forEach((label, labelIndex) =>
      label.classList.toggle('is-selected', labelIndex === index),
    );
    renderInspector();
  }

  function fitPreview(): void {
    const available = wrap.clientWidth;
    const natural = sheet.offsetWidth;
    if (available <= 0 || natural <= 0) return;
    const scale = Math.min(1, (available - 24) / natural);
    sheet.style.transform = scale < 1 ? `scale(${scale})` : '';
    wrap.style.height = `${sheet.offsetHeight * scale}px`;
  }

  function applySheet(sheetId: string, next: LabelSheetConfig): void {
    const errors = validateSheetConfig(next);
    if (errors.length > 0) {
      setStatus(errors.map((error) => copy.validation[error]).join(' '), 'error');
      return;
    }

    const count = next.columns * next.rows;
    const lost = state.project.slots
      .slice(count)
      .filter((slot) => slot.image !== null || slot.title !== '').length;
    if (lost > 0 && !window.confirm(copy.confirmShrink.replace('{count}', String(lost)))) {
      return;
    }

    state.selected = state.selected !== null && state.selected < count ? state.selected : null;
    apply({
      ...state.project,
      sheetId,
      sheet: { ...next },
      slots: Array.from({ length: count }, (_, index) => state.project.slots[index] ?? emptySlot()),
    });
  }

  function hasContent(): boolean {
    return state.project.slots.some((slot) => slot.image !== null || slot.title !== '');
  }

  function newProject(): void {
    if (hasContent() && !window.confirm(copy.confirmNew)) return;
    state.selected = null;
    apply(createProject());
    setStatus(copy.started);
  }

  function clearEverything(): void {
    if (hasContent() && !window.confirm(copy.confirmClearAll)) return;
    state.selected = null;
    apply(clearAll(state.project));
  }

  function handleSetting(target: HTMLInputElement | HTMLSelectElement): void {
    const project = state.project;

    if (target.matches('[data-yc-name]')) {
      apply({ ...project, name: target.value.slice(0, 100) });
      return;
    }
    if (target.matches('[data-yc-preset]')) {
      const preset = presetById(target.value);
      if (preset) applySheet(preset.id, preset.config);
      else applySheet('custom', project.sheet);
      return;
    }
    if (target.matches('[data-yc-paper]') || target.matches('[data-yc-custom] input')) {
      const value = (selector: string): number => {
        const input = $<HTMLInputElement>(selector);
        return input ? Number(input.value) : Number.NaN;
      };
      const paper = $<HTMLSelectElement>('[data-yc-paper]')?.value;
      applySheet('custom', {
        paper: paper === 'a4' ? 'a4' : 'letter',
        columns: Math.round(value('[data-yc-columns]')),
        rows: Math.round(value('[data-yc-rows]')),
        labelWidthMm: value('[data-yc-label-width]'),
        labelHeightMm: value('[data-yc-label-height]'),
        marginXMm: value('[data-yc-margin-x]'),
        marginYMm: value('[data-yc-margin-y]'),
        gapXMm: value('[data-yc-gap-x]'),
        gapYMm: value('[data-yc-gap-y]'),
      });
      return;
    }
    if (target.matches('input[name="yc-layout"]')) {
      apply({
        ...project,
        layout: target.value === 'fill-card' ? 'fill-card' : 'square-cover-title',
      });
      return;
    }
    if (target.matches('[data-yc-rounded]')) {
      apply({ ...project, roundedCorners: (target as HTMLInputElement).checked });
      return;
    }
    if (target.matches('[data-yc-cut]')) {
      apply({ ...project, printCutLine: (target as HTMLInputElement).checked });
      return;
    }
    if (target.matches('[data-yc-title-size]')) {
      apply({
        ...project,
        titleFontSize: clampNumber(Number(target.value), 6, 48, DEFAULT_TITLE_FONT_SIZE),
      });
      return;
    }
    if (target.matches('[data-yc-offset-x]')) {
      apply({ ...project, offsetXMm: clampNumber(Number(target.value), -20, 20, 0) });
      return;
    }
    if (target.matches('[data-yc-offset-y]')) {
      apply({ ...project, offsetYMm: clampNumber(Number(target.value), -20, 20, 0) });
      return;
    }
    if (target.matches('[data-yc-title]') && state.selected !== null) {
      apply(updateSlot(project, state.selected, { title: target.value }));
      return;
    }
    if (target.matches('[data-yc-zoom]') && state.selected !== null) {
      apply(updateSlot(project, state.selected, { zoom: Number(target.value) }));
      return;
    }
    if (target.matches('[data-yc-test]')) {
      state.mode = (target as HTMLInputElement).checked ? 'test' : 'design';
      renderSheet();
    }
  }

  function apply(next: CoverProject): void {
    state.project = next;
    pruneUrls();
    renderSheet();
    renderSettings();
    renderInspector();
  }

  root.addEventListener('input', (event) => {
    const target = event.target;
    if (!(target instanceof HTMLInputElement)) return;
    if (target.matches('[data-yc-columns], [data-yc-rows]')) return;
    if (['text', 'number', 'range'].includes(target.type)) handleSetting(target);
  });

  root.addEventListener('change', (event) => {
    const target = event.target;
    if (target instanceof HTMLSelectElement) handleSetting(target);
    else if (target instanceof HTMLInputElement) {
      if (
        ['checkbox', 'radio'].includes(target.type) ||
        target.matches('[data-yc-columns], [data-yc-rows]')
      ) {
        handleSetting(target);
      }
    }
  });

  root.addEventListener('click', (event) => {
    const target = event.target;
    if (!(target instanceof Element)) return;

    const slot = target.closest<HTMLElement>('[data-yc-slot]');
    if (slot) {
      select(Number(slot.dataset.index));
      return;
    }
    if (target.closest('[data-yc-new]')) {
      newProject();
      return;
    }
    if (target.closest('[data-yc-clear-all]')) {
      clearEverything();
      return;
    }
    if (target.closest('[data-yc-reset]') && state.selected !== null) {
      apply(resetSlotPosition(state.project, state.selected));
      return;
    }
    if (target.closest('[data-yc-clear]') && state.selected !== null) {
      apply(clearSlot(state.project, state.selected));
      return;
    }
    if (target.closest('[data-yc-print]')) {
      window.print();
    }
  });

  renderSheet();
  renderSettings();
  renderInspector();
  fitPreview();

  const observer = new ResizeObserver(() => fitPreview());
  observer.observe(wrap);

  return {
    destroy() {
      observer.disconnect();
      for (const url of urls.values()) URL.revokeObjectURL(url);
      urls.clear();
    },
  };
}
```

- [ ] **Step 3: Add the E2E coverage for the core**

Append to `site/e2e/yoto-cover.spec.ts`:

```ts
test('renders ten labels and applies sheet settings', async ({ page }) => {
  await page.goto('/myo/covers/');

  await expect(page.locator('[data-yc-slot]')).toHaveCount(10);
  const sheet = page.locator('[data-yc-sheet]');
  expect(await sheet.evaluate((element) => (element as HTMLElement).style.width)).toBe('215.9mm');

  await page.getByLabel('Sheet').selectOption('a4-2x5');
  expect(await sheet.evaluate((element) => (element as HTMLElement).style.width)).toBe('210mm');

  await page.getByLabel('Sheet').selectOption('custom');
  await expect(page.locator('[data-yc-custom]')).toBeVisible();

  await page.locator('[data-yc-slot]').first().click();
  await expect(page.locator('[data-yc-selected-name]')).toContainText('Label 1');
  await expect(page.locator('[data-yc-no-selection]')).toBeHidden();

  await page.getByLabel('Cover fills the card').check();
  await expect(sheet).toHaveAttribute('data-layout', 'fill-card');
});
```

- [ ] **Step 4: Build, type-check and run E2E**

Run: `pnpm check:types && pnpm build && pnpm --filter site test:e2e -- yoto-cover.spec.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add site/src/styles/yoto-cover.css site/src/components/YotoCover.astro \
  site/src/scripts/yoto-cover.ts site/e2e/yoto-cover.spec.ts
git commit -m "feat(covers): render the sheet and settings"
```

---

### Task 9: Images, zoom/pan, keyboard and autosave

**Files:**

- Modify: `site/src/scripts/yoto-cover.ts`
- Modify: `site/src/lib/cover-copy.ts`
- Modify: `site/src/components/YotoCover.astro` (add `imageNoRoom` in both languages)
- Modify: `site/e2e/yoto-cover.spec.ts`

**Interfaces:**

- Consumes: `fillEmptySlots`, `filledCount`, `setSlotImage`; `filesToImages`, `ImageImportResult`; `panBy`, `zoomAtPoint`; `AUTOSAVE_DELAY_MS`, `createAutosave`, `indexedDbBackend`.
- Produces: image import, drop, drag, wheel, keyboard and automatic restore.

- [ ] **Step 1: Add the missing copy**

In `CoverCopy`, add:

```ts
imageNoRoom: string;
```

In the French object:

```ts
imageNoRoom: 'La planche est pleine : {count} image(s) n’ont pas été ajoutées.',
```

In the English object:

```ts
imageNoRoom: '{count} image(s) were not added: the sheet is full.',
```

- [ ] **Step 2: Add imports and module state**

At the top of `scripts/yoto-cover.ts`, replace the existing `cover-project` and `cover-transform` imports with:

```ts
import {
  DEFAULT_TITLE_FONT_SIZE,
  clearAll,
  clearSlot,
  createProject,
  emptySlot,
  filledCount,
  fillEmptySlots,
  resetSlotPosition,
  setSlotImage,
  updateSlot,
  type CoverProject,
} from '../lib/cover-project';
import { panBy, transformStyle, zoomAtPoint } from '../lib/cover-transform';
import { filesToImages, type ImageImportResult } from '../lib/cover-images';
import { AUTOSAVE_DELAY_MS, createAutosave, indexedDbBackend } from '../lib/cover-autosave';
```

Inside `mountYotoCover`, after `const urls = new Map...`:

```ts
const autosave = createAutosave(indexedDbBackend());
let saveTimer: number | undefined;
let storageWarned = false;
let userChanged = false;
let pendingSlot: number | null = null;
let drag: {
  index: number;
  pointerId: number;
  startX: number;
  startY: number;
  panX: number;
  panY: number;
  width: number;
  height: number;
} | null = null;
```

- [ ] **Step 3: Add the image and autosave functions**

Insert before `function apply(...)`:

```ts
function pickSlotImage(index: number): void {
  pendingSlot = index;
  $<HTMLInputElement>('[data-yc-slot-input]')?.click();
}

function assignImages(result: ImageImportResult, start?: number): void {
  if (result.images.length === 0) {
    const messages: string[] = [];
    if (result.rejected > 0) {
      messages.push(copy.imageRejected.replace('{count}', String(result.rejected)));
    }
    if (result.tooLarge > 0) {
      messages.push(copy.imageTooLarge.replace('{count}', String(result.tooLarge)));
    }
    if (messages.length > 0) setStatus(messages.join(' '), 'error');
    return;
  }

  const before = filledCount(state.project);
  let next = state.project;
  let first = -1;

  if (start === undefined) {
    first = next.slots.findIndex((slot) => slot.image === null);
    next = fillEmptySlots(next, result.images).project;
  } else {
    let cursor = start;
    for (const image of result.images) {
      while (cursor < next.slots.length && next.slots[cursor].image !== null) cursor += 1;
      if (cursor >= next.slots.length) break;
      next = setSlotImage(next, cursor, image);
      if (first === -1) first = cursor;
      cursor += 1;
    }
  }

  apply(next);
  if (first !== -1) select(first);

  const added = filledCount(next) - before;
  const noRoom = result.images.length - added;
  const messages: string[] = [];
  if (noRoom > 0) messages.push(copy.imageNoRoom.replace('{count}', String(noRoom)));
  if (result.rejected > 0) {
    messages.push(copy.imageRejected.replace('{count}', String(result.rejected)));
  }
  if (result.tooLarge > 0) {
    messages.push(copy.imageTooLarge.replace('{count}', String(result.tooLarge)));
  }
  if (messages.length > 0) setStatus(messages.join(' '), 'error');
}

function scheduleAutosave(): void {
  window.clearTimeout(saveTimer);
  saveTimer = window.setTimeout(() => {
    void persist();
  }, AUTOSAVE_DELAY_MS);
}

async function persist(): Promise<void> {
  const saved = await autosave.write(state.project);
  if (!saved && !storageWarned) {
    storageWarned = true;
    setStatus(copy.storageUnavailable, 'error');
  }
}

async function restore(): Promise<void> {
  const saved = await autosave.read();
  if (!saved || userChanged) return;
  apply(saved.project, { save: false });
  setStatus(copy.restored);
}
```

- [ ] **Step 4: Make `apply` autosave, and clear it on a new sheet**

Replace `function apply(next: CoverProject): void { ... }` with:

```ts
function apply(next: CoverProject, options: { save?: boolean } = {}): void {
  state.project = next;
  pruneUrls();
  renderSheet();
  renderSettings();
  renderInspector();
  if (options.save !== false) {
    userChanged = true;
    scheduleAutosave();
  }
}
```

In `newProject()`, after `apply(createProject())`:

```ts
void autosave.clear();
```

In `destroy()`, add before the URL cleanup:

```ts
window.clearTimeout(saveTimer);
void autosave.write(state.project);
```

- [ ] **Step 5: Wire the slot picker, add button, inputs and replace button**

Replace the slot branch in the click handler with:

```ts
const slot = target.closest<HTMLElement>('[data-yc-slot]');
if (slot) {
  const index = Number(slot.dataset.index);
  select(index);
  if (state.project.slots[index]?.image === null) pickSlotImage(index);
  return;
}
if (target.closest('[data-yc-add]')) {
  $<HTMLInputElement>('[data-yc-add-input]')?.click();
  return;
}
if (target.closest('[data-yc-replace]') && state.selected !== null) {
  pickSlotImage(state.selected);
  return;
}
```

After the click listener, add:

```ts
const addInput = $<HTMLInputElement>('[data-yc-add-input]');
addInput?.addEventListener('change', () => {
  const files = [...(addInput.files ?? [])];
  addInput.value = '';
  if (files.length > 0) assignImages(filesToImages(files));
});

const slotInput = $<HTMLInputElement>('[data-yc-slot-input]');
slotInput?.addEventListener('change', () => {
  const file = slotInput.files?.[0];
  const index = pendingSlot;
  slotInput.value = '';
  pendingSlot = null;
  if (file && index !== null) assignImages(filesToImages([file]), index);
});
```

- [ ] **Step 6: Add pointer, wheel, keyboard, focus and drop handlers**

Insert before the `root.addEventListener('input', ...)` block:

```ts
sheet.addEventListener('pointerdown', (event) => {
  const target = event.target;
  if (!(target instanceof Element)) return;
  const art = target.closest<HTMLElement>('[data-yc-art]');
  const label = art?.closest<HTMLElement>('[data-yc-slot]');
  if (!art || !label) return;
  const index = Number(label.dataset.index);
  const slot = state.project.slots[index];
  if (!slot?.image) return;

  select(index);
  label.focus();
  const rect = art.getBoundingClientRect();
  drag = {
    index,
    pointerId: event.pointerId,
    startX: event.clientX,
    startY: event.clientY,
    panX: slot.panX,
    panY: slot.panY,
    width: Math.max(1, rect.width),
    height: Math.max(1, rect.height),
  };
  art.setPointerCapture(event.pointerId);
  event.preventDefault();
});

sheet.addEventListener('pointermove', (event) => {
  if (!drag || drag.pointerId !== event.pointerId) return;
  const dx = (event.clientX - drag.startX) / drag.width;
  const dy = (event.clientY - drag.startY) / drag.height;
  apply(
    updateSlot(state.project, drag.index, {
      panX: drag.panX + dx,
      panY: drag.panY + dy,
    }),
  );
});

for (const type of ['pointerup', 'pointercancel'] as const) {
  sheet.addEventListener(type, () => {
    drag = null;
  });
}

sheet.addEventListener(
  'wheel',
  (event) => {
    const target = event.target;
    if (!(target instanceof Element)) return;
    const art = target.closest<HTMLElement>('[data-yc-art]');
    const label = art?.closest<HTMLElement>('[data-yc-slot]');
    if (!art || !label) return;
    const index = Number(label.dataset.index);
    const slot = state.project.slots[index];
    if (!slot?.image) return;

    event.preventDefault();
    const rect = art.getBoundingClientRect();
    const ux = (event.clientX - rect.left) / Math.max(1, rect.width);
    const uy = (event.clientY - rect.top) / Math.max(1, rect.height);
    const next = zoomAtPoint(slot, ux, uy, event.deltaY);
    apply(updateSlot(state.project, index, next));
    select(index);
  },
  { passive: false },
);

sheet.addEventListener('dblclick', (event) => {
  const target = event.target;
  if (!(target instanceof Element)) return;
  const label = target.closest<HTMLElement>('[data-yc-slot]');
  if (!label) return;
  const index = Number(label.dataset.index);
  if (state.project.slots[index]?.image) pickSlotImage(index);
});

sheet.addEventListener('focusin', (event) => {
  const target = event.target;
  if (!(target instanceof Element)) return;
  const label = target.closest<HTMLElement>('[data-yc-slot]');
  if (label) select(Number(label.dataset.index));
});

sheet.addEventListener('keydown', (event) => {
  const target = event.target;
  if (!(target instanceof Element)) return;
  const label = target.closest<HTMLElement>('[data-yc-slot]');
  if (!label) return;
  const index = Number(label.dataset.index);
  const slot = state.project.slots[index];
  if (!slot) return;
  const step = event.shiftKey ? 0.1 : 0.01;

  if (event.key === 'ArrowLeft') {
    apply(updateSlot(state.project, index, panBy(slot, -step, 0)));
  } else if (event.key === 'ArrowRight') {
    apply(updateSlot(state.project, index, panBy(slot, step, 0)));
  } else if (event.key === 'ArrowUp') {
    apply(updateSlot(state.project, index, panBy(slot, 0, -step)));
  } else if (event.key === 'ArrowDown') {
    apply(updateSlot(state.project, index, panBy(slot, 0, step)));
  } else if (event.key === '+' || event.key === '=') {
    apply(updateSlot(state.project, index, { zoom: slot.zoom * 1.1 }));
  } else if (event.key === '-') {
    apply(updateSlot(state.project, index, { zoom: slot.zoom / 1.1 }));
  } else if (event.key === '0') {
    apply(resetSlotPosition(state.project, index));
  } else if (event.key === 'Delete' || event.key === 'Backspace') {
    apply(clearSlot(state.project, index));
  } else if (event.key === 'Enter' && !slot.image) {
    pickSlotImage(index);
  } else {
    return;
  }
  event.preventDefault();
});

sheet.addEventListener('dragover', (event) => {
  event.preventDefault();
  if (event.dataTransfer) event.dataTransfer.dropEffect = 'copy';
});

sheet.addEventListener('drop', (event) => {
  event.preventDefault();
  const files = [...(event.dataTransfer?.files ?? [])];
  if (files.length === 0) return;
  const target = event.target;
  const label = target instanceof Element ? target.closest<HTMLElement>('[data-yc-slot]') : null;
  const start = label ? Number(label.dataset.index) : undefined;
  assignImages(filesToImages(files), start);
});
```

- [ ] **Step 7: Restore the autosave at mount**

Before the final `return { destroy() { ... } }`, after `fitPreview()` and the observer, add:

```ts
void restore();
```

- [ ] **Step 8: Add the E2E coverage**

Append to `site/e2e/yoto-cover.spec.ts`:

```ts
const PNG = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+/p9sAAAAASUVORK5CYII=',
  'base64',
);

test('imports an image, tiles it, zooms it and restores it', async ({ page }) => {
  await page.goto('/myo/covers/');
  const first = page.locator('[data-yc-slot]').first();

  const chooserPromise = page.waitForEvent('filechooser');
  await first.click();
  const chooser = await chooserPromise;
  await chooser.setFiles({ name: 'cover.png', mimeType: 'image/png', buffer: PNG });

  await expect(first.locator('img')).toBeVisible();
  await page.getByLabel('Title', { exact: true }).fill('Mila');
  await expect(first.locator('[data-yc-title]')).toHaveText('Mila');

  await first.locator('[data-yc-art]').hover();
  await page.mouse.wheel(0, -120);
  await expect
    .poll(() => first.locator('img').evaluate((image) => (image as HTMLElement).style.transform))
    .toContain('scale(1.1)');

  await first.focus();
  await page.keyboard.press('ArrowRight');
  await expect
    .poll(() => first.locator('img').evaluate((image) => (image as HTMLElement).style.transform))
    .toContain('translate(1%');

  await page.waitForTimeout(800);
  await page.reload();
  const restored = page.locator('[data-yc-slot]').first();
  await expect(restored.locator('img')).toBeVisible();
  await expect(restored.locator('[data-yc-title]')).toHaveText('Mila');
});

test('fills empty labels in order from the add-images input', async ({ page }) => {
  await page.goto('/myo/covers/');
  await page.locator('[data-yc-add-input]').setInputFiles([
    { name: 'a.png', mimeType: 'image/png', buffer: PNG },
    { name: 'b.png', mimeType: 'image/png', buffer: PNG },
    { name: 'c.png', mimeType: 'image/png', buffer: PNG },
  ]);
  await expect(page.locator('[data-yc-slot][data-filled="true"]')).toHaveCount(3);
  await expect(page.locator('[data-yc-slot]').nth(0).locator('img')).toBeVisible();
  await expect(page.locator('[data-yc-slot]').nth(2).locator('img')).toBeVisible();
});
```

- [ ] **Step 9: Build and run the tests**

Run: `pnpm check:types && pnpm test -- site/src/lib && pnpm build && pnpm --filter site test:e2e -- yoto-cover.spec.ts`
Expected: PASS. If the autosave test is flaky, wait for the IndexedDB write with `expect.poll` on `indexedDB` through `page.evaluate` instead of the fixed timeout.

- [ ] **Step 10: Commit**

```bash
git add site/src/scripts/yoto-cover.ts site/src/lib/cover-copy.ts \
  site/src/components/YotoCover.astro site/e2e/yoto-cover.spec.ts
git commit -m "feat(covers): import, position and auto-save covers"
```

---

### Task 10: Printing and the calibration test page

**Files:**

- Create: `site/src/lib/cover-print.ts`
- Create: `site/src/lib/cover-print.test.ts`
- Modify: `site/src/scripts/yoto-cover.ts`
- Modify: `site/e2e/yoto-cover.spec.ts`

**Interfaces:**

- Consumes: `CoverProject`, `Paper`, `presetById`.
- Produces: `pageStyleFor(paper)`, `rulerCaption(project, label)`; printed page size and test-page DOM.

- [ ] **Step 1: Write the failing unit test**

`site/src/lib/cover-print.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { createProject } from './cover-project';
import { pageStyleFor, rulerCaption } from './cover-print';

describe('pageStyleFor', () => {
  it('sets an exact page size with no margin', () => {
    expect(pageStyleFor('letter')).toBe('@page { size: Letter portrait; margin: 0; }');
    expect(pageStyleFor('a4')).toBe('@page { size: A4 portrait; margin: 0; }');
  });
});

describe('rulerCaption', () => {
  it('names the preset and the calibration offsets', () => {
    const project = { ...createProject(), offsetXMm: 0.4, offsetYMm: -1.2 };
    expect(rulerCaption(project, '1 inch')).toBe(
      '1 inch · TownStix US-10 (Letter, 4 × 2 in) · 0.4 / -1.2 mm',
    );
  });

  it('labels a custom sheet', () => {
    const project = { ...createProject(), sheetId: 'custom' };
    expect(rulerCaption(project, '1 inch')).toContain('Custom');
  });
});
```

Run: `pnpm test -- site/src/lib/cover-print.test.ts`
Expected: FAIL because `cover-print.ts` does not exist.

- [ ] **Step 2: Write `cover-print.ts`**

```ts
import type { CoverProject } from './cover-project';
import { presetById, type Paper } from './label-sheet';

export function pageStyleFor(paper: Paper): string {
  return `@page { size: ${paper === 'a4' ? 'A4' : 'Letter'} portrait; margin: 0; }`;
}

export function rulerCaption(project: CoverProject, label: string): string {
  const name = presetById(project.sheetId)?.name ?? 'Custom';
  return `${label} · ${name} · ${project.offsetXMm.toFixed(1)} / ${project.offsetYMm.toFixed(1)} mm`;
}
```

- [ ] **Step 3: Wire the page style and the ruler**

In `scripts/yoto-cover.ts`, import:

```ts
import { pageStyleFor, rulerCaption } from '../lib/cover-print';
```

Inside `mountYotoCover`, after `const status = ...`:

```ts
let pageStyle: HTMLStyleElement | null = null;
```

Add these functions before `renderSheet`:

```ts
function renderPageStyle(): void {
  if (!pageStyle) {
    pageStyle = document.createElement('style');
    pageStyle.dataset.ycPage = '';
    document.head.append(pageStyle);
  }
  pageStyle.textContent = pageStyleFor(state.project.sheet.paper);
}

function renderTestRuler(): void {
  let ruler = sheet.querySelector<HTMLElement>('[data-yc-ruler]');
  if (state.mode !== 'test') {
    ruler?.remove();
    return;
  }
  if (!ruler) {
    ruler = document.createElement('div');
    ruler.className = 'yc-ruler';
    ruler.dataset.ycRuler = '';
    const bar = document.createElement('span');
    bar.className = 'yc-ruler-bar';
    const caption = document.createElement('span');
    caption.dataset.ycRulerCaption = '';
    ruler.append(bar, caption);
    sheet.append(ruler);
  }
  const caption = ruler.querySelector<HTMLElement>('[data-yc-ruler-caption]');
  if (caption) caption.textContent = rulerCaption(state.project, copy.ruler);
}
```

In `renderSheet()`, after `labels.forEach(renderLabel);`, add:

```ts
renderPageStyle();
renderTestRuler();
```

In `destroy()`, add:

```ts
pageStyle?.remove();
pageStyle = null;
```

- [ ] **Step 4: Add the E2E test**

Append to `site/e2e/yoto-cover.spec.ts`:

```ts
test('prints at true size and shows the calibration test page', async ({ page }) => {
  await page.goto('/myo/covers/');
  const sheet = page.locator('[data-yc-sheet]');

  await page.getByLabel('Test page').check();
  await expect(sheet).toHaveAttribute('data-mode', 'test');
  await expect(page.locator('.yc-ruler')).toBeVisible();
  await expect(page.locator('.yc-ruler-caption, [data-yc-ruler-caption]')).toContainText(
    'TownStix',
  );
  await expect(page.locator('.yc-outline').first()).toBeVisible();

  await page.emulateMedia({ media: 'print' });
  await expect(page.locator('.site-header')).toBeHidden();
  await expect(page.locator('.yc-side')).toBeHidden();
  await expect(sheet).toBeVisible();
  await expect(sheet).toHaveCSS('transform', 'none');
});
```

- [ ] **Step 5: Run the tests**

Run: `pnpm test -- site/src/lib/cover-print.test.ts && pnpm check:types && pnpm build && pnpm --filter site test:e2e -- yoto-cover.spec.ts`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add site/src/lib/cover-print.ts site/src/lib/cover-print.test.ts \
  site/src/scripts/yoto-cover.ts site/e2e/yoto-cover.spec.ts
git commit -m "feat(covers): print at true size with a calibration page"
```

---

### Task 11: Save and open native `.yotolabels` files

**Files:**

- Create: `site/src/lib/cover-io.ts`
- Create: `site/src/lib/cover-io.test.ts`
- Modify: `site/src/scripts/yoto-cover.ts`
- Modify: `site/e2e/yoto-cover.spec.ts`

**Interfaces:**

- Consumes: `projectToDto`, `parseProjectJson`, `imagePathFor`, `isSafeImagePath`, `mimeForPath`, `CoverFileError`; `zipEntries`, `readZip`.
- Produces: `buildProjectZip(project): Promise<Uint8Array>`, `readProjectZip(data): Promise<{ project: CoverProject; notes: string[] }>`.

- [ ] **Step 1: Write the failing tests**

`site/src/lib/cover-io.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { buildProjectZip, readProjectZip } from './cover-io';
import { createProject, setSlotImage, updateSlot, type CoverImage } from './cover-project';

const image: CoverImage = {
  id: 'abc',
  fileName: 'Mila.png',
  mimeType: 'image/png',
  blob: new Blob([new Uint8Array([1, 2, 3])], { type: 'image/png' }),
};

describe('buildProjectZip / readProjectZip', () => {
  it('round-trips a project, its images and a custom sheet', async () => {
    let project = setSlotImage(createProject('a4-2x5'), 0, image);
    project = updateSlot(project, 0, { title: 'Mila', zoom: 1.5, panX: 0.2 });
    project = {
      ...project,
      name: 'School',
      sheetId: 'custom',
    };

    const zip = await buildProjectZip(project);
    const opened = await readProjectZip(zip);

    expect(opened.project.name).toBe('School');
    expect(opened.project.sheetId).toBe('custom');
    expect(opened.project.sheet.labelWidthMm).toBe(100);
    expect(opened.project.slots[0].title).toBe('Mila');
    expect(opened.project.slots[0].zoom).toBe(1.5);
    expect(opened.project.slots[0].image?.mimeType).toBe('image/png');
    const bytes = new Uint8Array(await opened.project.slots[0].image!.blob.arrayBuffer());
    expect([...bytes]).toEqual([1, 2, 3]);
  });

  it('opens the fixture produced by the Windows app', async () => {
    const fixture = Buffer.from(
      'UEsDBBQAAAAIAISWZl0PG+hqzwAAAEgDAAAMAAAAcHJvamVjdC5qc29u7Y7NbgIxDIRfZZUzbJMKLr2uxAlOIBWEOETghUhZGxKn5Ue8O3Gh7L4D3Dwznk9zUTWFxrL6KkyvUHEHILdi+sXI7thP0WiVE29PlP6i6SHZABX9QPh2vJs59iAfgRJuYFNRQAgxf3JIkP19cMhV4rFDaF2W2oiQp+4sthlkk+o6As+bJhv6qRdPHT2xkJcX5Rq7ld79iB9r2VPucStTzkRSMeXnUAZYnAug1A+1yKqvS/M/QzAT56269oqWjMn7DqsDaim6i3jXX7W+ut4AUEsDBBQAAAAAAISWZl1ZqVCQRAAAAEQAAAAQAAAAaW1hZ2VzL2NvdmVyLnBuZ4lQTkcNChoKAAAADUlIRFIAAAABAAAAAQgEAAAAtRwMAgAAAAtJREFUeNpj/P8fAAMDAgDvv6fbAAAAAElFTkSuQmCCUEsBAhQDFAAAAAgAhJZmXQ8b6GrPAAAASAMAAAwAAAAAAAAAAAAAAIABAAAAAHByb2plY3QuanNvblBLAQIUAxQAAAAAAISWZl1ZqVCQRAAAAEQAAAAQAAAAAAAAAAAAAACAAfkAAABpbWFnZXMvY292ZXIucG5nUEsFBgAAAAACAAIAeAAAAGsBAAAAAA==',
      'base64',
    );
    const opened = await readProjectZip(new Uint8Array(fixture));
    expect(opened.project.slots[0].title).toBe('Mila');
    expect(opened.project.slots[0].image?.mimeType).toBe('image/png');
    expect(opened.project.slots[0].zoom).toBe(1.25);
  });

  it('rejects an archive without project.json', async () => {
    const empty = await import('./cover-zip').then(({ zipEntries }) =>
      zipEntries([{ path: 'images/a.png', data: new Uint8Array([1]) }]),
    );
    await expect(readProjectZip(empty)).rejects.toThrow();
  });
});
```

Run: `pnpm test -- site/src/lib/cover-io.test.ts`
Expected: FAIL because `cover-io.ts` does not exist.

- [ ] **Step 2: Write `cover-io.ts`**

```ts
import {
  CoverFileError,
  imagePathFor,
  isSafeImagePath,
  mimeForPath,
  parseProjectJson,
  projectToDto,
} from './cover-file';
import type { CoverImage, CoverProject } from './cover-project';
import { readZip, zipEntries, type ZipEntry } from './cover-zip';

export async function buildProjectZip(project: CoverProject): Promise<Uint8Array> {
  const entries: ZipEntry[] = [];
  const paths = new Map<string, string>();
  const seen = new Set<string>();

  for (const slot of project.slots) {
    const image = slot.image;
    if (!image || seen.has(image.id)) continue;
    seen.add(image.id);
    const path = imagePathFor(image);
    paths.set(image.id, path);
    entries.push({
      path,
      data: new Uint8Array(await image.blob.arrayBuffer()),
    });
  }

  const dto = projectToDto(project, paths);
  const json = new TextEncoder().encode(JSON.stringify(dto, null, 2));
  entries.unshift({ path: 'project.json', data: json });

  return zipEntries(entries);
}

export async function readProjectZip(
  data: Uint8Array,
): Promise<{ project: CoverProject; notes: string[] }> {
  const entries = await readZip(data);
  const projectEntry = entries.get('project.json');
  if (!projectEntry) throw new CoverFileError('invalid');

  const images = new Map<string, CoverImage>();
  for (const [path, bytes] of entries) {
    if (!path.startsWith('images/') || !isSafeImagePath(path)) continue;
    const mimeType = mimeForPath(path);
    images.set(path, {
      id: crypto.randomUUID(),
      fileName: path.slice('images/'.length),
      mimeType,
      blob: new Blob([bytes], { type: mimeType }),
    });
  }

  return parseProjectJson(new TextDecoder().decode(projectEntry), images);
}
```

- [ ] **Step 3: Add save/open to the controller**

Inside `mountYotoCover`, add before `apply`:

```ts
function safeFileName(value: string): string {
  const cleaned = value
    .trim()
    .replace(/[\\/:*?"<>|]+/g, '-')
    .replace(/\s+/g, ' ')
    .slice(0, 80);
  return cleaned || copy.defaultFileName;
}

function downloadBlob(blob: Blob, fileName: string): void {
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = fileName;
  document.body.append(link);
  link.click();
  link.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 0);
}

async function saveProject(): Promise<void> {
  try {
    const { buildProjectZip } = await import('../lib/cover-io');
    const zip = await buildProjectZip(state.project);
    downloadBlob(
      new Blob([zip], { type: 'application/zip' }),
      `${safeFileName(state.project.name)}.yotolabels`,
    );
    setStatus(copy.saved);
  } catch {
    setStatus(copy.saveError, 'error');
  }
}

function fileErrorCode(error: unknown): 'invalid' | 'newer-format' {
  if (error && typeof error === 'object' && 'code' in error) {
    const code = (error as { code?: unknown }).code;
    if (code === 'newer-format') return 'newer-format';
  }
  return 'invalid';
}

async function openProject(file: File): Promise<void> {
  try {
    const { readProjectZip } = await import('../lib/cover-io');
    const opened = await readProjectZip(new Uint8Array(await file.arrayBuffer()));
    state.selected = null;
    apply(opened.project);
    const notes = opened.notes
      .map((note) =>
        note === 'sheet-fallback'
          ? copy.notes.sheetFallback
          : note === 'missing-image'
            ? copy.notes.missingImages
            : '',
      )
      .filter((note) => note !== '');
    setStatus(notes.length > 0 ? [copy.opened, ...notes].join(' ') : copy.opened);
  } catch (error) {
    setStatus(fileErrorCode(error) === 'newer-format' ? copy.newerFile : copy.invalidFile, 'error');
  }
}
```

In the click handler, add before the print branch:

```ts
if (target.closest('[data-yc-open]')) {
  $<HTMLInputElement>('[data-yc-open-input]')?.click();
  return;
}
if (target.closest('[data-yc-save]')) {
  void saveProject();
  return;
}
```

After the add/slot input listeners, add:

```ts
const openInput = $<HTMLInputElement>('[data-yc-open-input]');
openInput?.addEventListener('change', () => {
  const file = openInput.files?.[0];
  openInput.value = '';
  if (file) void openProject(file);
});
```

- [ ] **Step 4: Add the E2E coverage**

Append to `site/e2e/yoto-cover.spec.ts`:

```ts
test('saves a .yotolabels download and opens the native fixture', async ({ page }) => {
  await page.goto('/myo/covers/');
  await page.getByLabel('Sheet name').fill('Mila cards');

  const [download] = await Promise.all([
    page.waitForEvent('download'),
    page.getByRole('button', { name: 'Save' }).click(),
  ]);
  expect(download.suggestedFilename()).toBe('Mila cards.yotolabels');

  const path = await download.path();
  expect(path).not.toBeNull();
  const bytes = await readFile(path!);
  expect(bytes.subarray(0, 2).toString()).toBe('PK');

  const fixture = Buffer.from(
    'UEsDBBQAAAAIAISWZl0PG+hqzwAAAEgDAAAMAAAAcHJvamVjdC5qc29u7Y7NbgIxDIRfZZUzbJMKLr2uxAlOIBWEOETghUhZGxKn5Ue8O3Gh7L4D3Dwznk9zUTWFxrL6KkyvUHEHILdi+sXI7thP0WiVE29PlP6i6SHZABX9QPh2vJs59iAfgRJuYFNRQAgxf3JIkP19cMhV4rFDaF2W2oiQp+4sthlkk+o6As+bJhv6qRdPHT2xkJcX5Rq7ld79iB9r2VPucStTzkRSMeXnUAZYnAug1A+1yKqvS/M/QzAT56269oqWjMn7DqsDaim6i3jXX7W+ut4AUEsDBBQAAAAAAISWZl1ZqVCQRAAAAEQAAAAQAAAAaW1hZ2VzL2NvdmVyLnBuZ4lQTkcNChoKAAAADUlIRFIAAAABAAAAAQgEAAAAtRwMAgAAAAtJREFUeNpj/P8fAAMDAgDvv6fbAAAAAElFTkSuQmCCUEsBAhQDFAAAAAgAhJZmXQ8b6GrPAAAASAMAAAwAAAAAAAAAAAAAAIABAAAAAHByb2plY3QuanNvblBLAQIUAxQAAAAAAISWZl1ZqVCQRAAAAEQAAAAQAAAAAAAAAAAAAACAAfkAAABpbWFnZXMvY292ZXIucG5nUEsFBgAAAAACAAIAeAAAAGsBAAAAAA==',
    'base64',
  );

  await page.locator('[data-yc-open-input]').setInputFiles({
    name: 'native.yotolabels',
    mimeType: 'application/zip',
    buffer: fixture,
  });

  const first = page.locator('[data-yc-slot]').first();
  await expect(first.locator('img')).toBeVisible();
  await expect(first.locator('[data-yc-title]')).toHaveText('Mila');
});
```

Add the Node import at the top of the E2E file:

```ts
import { readFile } from 'node:fs/promises';
```

- [ ] **Step 5: Run the tests**

Run: `pnpm test -- site/src/lib/cover-io.test.ts && pnpm check:types && pnpm build && pnpm --filter site test:e2e -- yoto-cover.spec.ts`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add site/src/lib/cover-io.ts site/src/lib/cover-io.test.ts \
  site/src/scripts/yoto-cover.ts site/e2e/yoto-cover.spec.ts
git commit -m "feat(covers): save and open native .yotolabels files"
```

---

### Task 12: Budget rule, accessibility, docs and final verification

**Files:**

- Modify: `site/astro.config.mjs`
- Modify: `scripts/check-budget.ts`
- Modify: `site/e2e/a11y.spec.ts`
- Modify: `scripts/lib/readme.ts`
- Modify: `README.md` (regenerated)
- Modify: `docs/superpowers/plans/2026-11-05-pixel-editor-monorepo.md`

**Interfaces:**

- Produces: named lazy chunks `yoto-cover` and `yoto-cover-file`, dedicated budget checks, a11y coverage and documentation.

- [ ] **Step 1: Name the lazy chunks**

In `site/astro.config.mjs`, add a `vite` block:

```js
vite: {
  build: {
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (/cover-(file|zip|io)\.ts/.test(id)) return 'yoto-cover-file';
          if (
            /\/src\/lib\/(cover-(project|transform|autosave|images|print)|label-sheet)\.ts/.test(
              id,
            )
          ) {
            return 'yoto-cover';
          }
          if (id.includes('/src/scripts/yoto-cover.ts')) return 'yoto-cover';
          return undefined;
        },
      },
    },
  },
},
```

- [ ] **Step 2: Add the dedicated budget check**

In `scripts/check-budget.ts`, replace everything from `const all = [...bundles, ...linked, ...inline];` down to the line before `for (const [page, limit] of PAGE_SCRIPT_LIMITS) {` with:

```ts
const all = [...bundles, ...linked, ...inline];
const sum = (entries: Entry[]) => entries.reduce((value, entry) => value + entry.size, 0);
const kb = (bytes: number) => (bytes / 1024).toFixed(1);

const LAZY_CHUNK_LIMITS = new Map<string, number>([
  ['yoto-cover', 20 * 1024],
  ['yoto-cover-file', 10 * 1024],
]);

function lazyChunkName(file: string): string | undefined {
  const base = file.split('/').pop() ?? '';
  if (/^yoto-cover-file[.-]/.test(base)) return 'yoto-cover-file';
  if (/^yoto-cover[.-]/.test(base)) return 'yoto-cover';
  return undefined;
}

const lazy = new Map<string, Entry[]>();
const initial: Entry[] = [];
for (const entry of all) {
  const name = lazyChunkName(entry.file);
  if (name) {
    const entries = lazy.get(name) ?? [];
    entries.push(entry);
    lazy.set(name, entries);
  } else {
    initial.push(entry);
  }
}

const total = sum(initial);
if (total > limit) {
  console.error(`JavaScript budget exceeded: ${kb(total)} KB > ${limit / 1024} KB gzip.`);
  console.error(`Files (${initial.length}):`);
  for (const entry of [...initial].sort((a, b) => b.size - a.size)) {
    console.error(`  ${kb(entry.size).padStart(6)} KB  ${entry.file}`);
  }
  process.exit(1);
}

console.log(`JavaScript budget OK: ${kb(total)} KB gzip (initial).`);
const initialBundles = bundles.filter((entry) => initial.includes(entry));
console.log(
  `  ${kb(sum(initialBundles))} KB gzip — ${initialBundles.length} file(s) in site/dist/_astro/`,
);
if (linked.length > 0) {
  console.log(`  ${kb(sum(linked))} KB gzip — ${linked.length} linked script file(s)`);
}
console.log(
  `  ${kb(sum(inline))} KB gzip — ${inline.length} inline script(s) in ${pages.length} pages`,
);

for (const [name, chunkLimit] of LAZY_CHUNK_LIMITS) {
  const entries = lazy.get(name) ?? [];
  if (entries.length === 0) {
    console.error(`Missing lazy chunk: ${name}.`);
    process.exit(1);
  }
  const size = sum(entries);
  if (size > chunkLimit) {
    console.error(`Lazy chunk budget exceeded: ${name} ${kb(size)} KB > ${kb(chunkLimit)} KB.`);
    process.exit(1);
  }
  console.log(`Lazy chunk budget OK: ${name} ${kb(size)} KB gzip (limit ${kb(chunkLimit)} KB).`);
}
```

Leave the existing `PAGE_SCRIPT_LIMITS` loop untouched.

- [ ] **Step 3: Add the routes to the accessibility sweep**

In `site/e2e/a11y.spec.ts`, add:

```ts
'/myo/covers/',
'/fr/myo/covers/',
```

- [ ] **Step 4: Document the feature**

`README.md` is generated, so add the line to `scripts/lib/readme.ts` in the “Start here” block, after the MYO guide line:

```ts
- [Print card covers with YotoCover](https://yoto-community.github.io/myo/covers/) - Lay out ten covers on a label sheet, print at true size, and save \`.yotolabels\` files compatible with the Windows app.
```

Then regenerate it:

```bash
pnpm build:data
pnpm check:readme
```

At the top of Task 9 in `docs/superpowers/plans/2026-11-05-pixel-editor-monorepo.md`, add:

```md
> **Remplacé le 2026-11-06 :** la page simple `/myo/labels/` décrite ici est remplacée par YotoCover (`docs/superpowers/plans/2026-11-06-yotocover.md`). La géométrie de la tâche 8 reste valable ; la route devient `/myo/covers/`.
```

- [ ] **Step 5: Run the full verification**

```bash
pnpm test
pnpm check
pnpm build
pnpm check:build
pnpm check:i18n
pnpm check:budget
pnpm check:internal-links
pnpm --filter site test:e2e
```

Expected: all pass. `pnpm check:budget` must print both `Lazy chunk budget OK` lines and an initial budget below 30 KB.

- [ ] **Step 6: Commit**

```bash
git add site/astro.config.mjs scripts/check-budget.ts site/e2e/a11y.spec.ts \
  scripts/lib/readme.ts README.md docs/superpowers/plans/2026-11-05-pixel-editor-monorepo.md
git commit -m "chore(covers): budget, a11y and documentation"
```

---

## Plan self-review

- **Spec coverage:** geometry and presets (Task 1), project state (Task 2), transforms and images (Task 3), native JSON (Task 4), ZIP (Task 5), autosave (Task 6), routes and markup (Task 7), rendering/settings/selection (Task 8), images/interactions/autosave (Task 9), print and calibration (Task 10), save/open (Task 11), budget/a11y/docs (Task 12).
- **Placeholders:** none; every code step contains the implementation or the exact replacement block.
- **Type consistency:** `CoverProject`, `CoverSlot`, `CoverImage`, `CoverCopy`, `ImageImportResult`, `ZipEntry`, `CoverAutosaveBackend` are defined once and reused with the same names.
- **Known tuning points:** the exact gzip sizes of the two lazy chunks are measured in Task 12. If a chunk exceeds its budget, reduce code or raise the dedicated budget with the measured value; do not raise the 30 KB initial budget.

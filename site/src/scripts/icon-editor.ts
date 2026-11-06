/**
 * Éditeur d'icônes de piste 16×16 — contrôleur DOM sans framework.
 *
 * Le raisonnement vit dans `@yoto-community/pixel-editor-core` (grille RGBA,
 * réducteur, historique, PNG, brouillon) : ce module ne fait que projeter
 * l'état sur le DOM et renvoyer les interactions dans le réducteur.
 *
 * Choix :
 * - la grille est un DOM `role="grid"` (16 lignes × 16 cellules), pas un
 *   `<canvas>` : chaque case est focusable et libellée par ses coordonnées et
 *   sa couleur, comme l'exige la lecture non visuelle ;
 * - les libellés sont fournis par l'hôte (`data-copy`) : le script reste
 *   bilingue sans dépendre du dictionnaire i18n du site ;
 * - le brouillon est rangé sous une clé propre à ce site, jamais celle de
 *   l'éditeur du catalogue d'icônes.
 */

import {
  AUTOSAVE_DELAY_MS,
  EDITOR_PALETTE,
  GRID_SIZE,
  createEditorState,
  createGrid,
  createPngBlob,
  editorReducer,
  encodePngDataUrl,
  getPixel,
  hexToRgba,
  isActivationKey,
  loadDraft,
  moveFocus,
  paletteIndexForShortcut,
  rgbaToHex,
  saveDraft,
  toolForShortcut,
  type EditorAction,
  type EditorState,
  type EditorTool,
  type Rgba,
} from '@yoto-community/pixel-editor-core';
import { reviewIcon } from '../lib/icon-checks';
import { iconFromFile } from '../lib/label-icon';

/** Clé `localStorage` du brouillon, propre à ce site. */
export const EDITOR_DRAFT_KEY = 'awesome-yoto:track-icon-draft';

/** Nom du fichier PNG exporté. */
export const EXPORT_FILENAME = 'yoto-track-icon.png';

/** Textes injectés par le composant Astro (aucune dépendance i18n ici). */
export interface EditorCopy {
  toolsAria: string;
  tools: Record<EditorTool, string>;
  gridAria: string;
  /** Gabarit avec `{row}`, `{col}` et `{color}`. */
  cellAria: string;
  empty: string;
  paletteAria: string;
  customColor: string;
  undo: string;
  redo: string;
  clear: string;
  actionsAria: string;
  import: string;
  importHint: string;
  importError: string;
  download: string;
  previewReal: string;
  previewLarge: string;
  checksAria: string;
  checkEmpty: string;
  checkBlack: string;
  checkColors: string;
  checkOk: string;
  saved: string;
}

const DEFAULT_COLOR: Rgba = [0, 0, 0, 255];

const cssColor = (pixel: Rgba) => `rgba(${pixel[0]}, ${pixel[1]}, ${pixel[2]}, ${pixel[3] / 255})`;

/** `#rrggbb` opaque, format attendu par `<input type="color">`. */
const hex6 = (pixel: Rgba) =>
  `#${[pixel[0], pixel[1], pixel[2]]
    .map((channel) => channel.toString(16).padStart(2, '0'))
    .join('')}`;

function fillTemplate(template: string, values: Record<string, string>): string {
  return template.replace(/\{(\w+)\}/g, (match, key: string) => values[key] ?? match);
}

export function mountIconEditor(root: HTMLElement): void {
  const copy = JSON.parse(root.dataset.copy ?? '{}') as EditorCopy;

  const query = <T extends Element>(selector: string): T => {
    const element = root.querySelector<T>(selector);
    if (!element) throw new Error(`IconEditor: element introuvable (${selector})`);
    return element;
  };

  const gridEl = query<HTMLElement>('[data-grid]');
  const previewReal = query<HTMLImageElement>('[data-preview-real]');
  const previewLarge = query<HTMLImageElement>('[data-preview-large]');
  const paletteEl = query<HTMLElement>('[data-palette]');
  const colorInput = query<HTMLInputElement>('[data-color]');
  const checksEl = query<HTMLElement>('[data-checks]');
  const savedEl = query<HTMLElement>('[data-saved]');
  const fileInput = query<HTMLInputElement>('[data-file]');
  const importError = query<HTMLElement>('[data-import-error]');

  let state: EditorState = createEditorState(
    loadDraft(EDITOR_DRAFT_KEY) ?? createGrid(),
    DEFAULT_COLOR,
  );
  let painting = false;
  let saveTimer: number | undefined;

  /* ---------- Grille ---------- */

  const cells: HTMLDivElement[] = [];

  for (let y = 0; y < GRID_SIZE; y++) {
    const row = document.createElement('div');
    row.className = 'ie-row';
    row.setAttribute('role', 'row');
    row.setAttribute('aria-rowindex', String(y + 1));

    for (let x = 0; x < GRID_SIZE; x++) {
      const cell = document.createElement('div');
      cell.className = 'ie-cell';
      cell.setAttribute('role', 'gridcell');
      cell.setAttribute('aria-colindex', String(x + 1));
      cell.tabIndex = cells.length === 0 ? 0 : -1;

      cell.addEventListener('pointerdown', (event) => {
        if (event.pointerType === 'mouse' && event.button !== 0) return;
        event.preventDefault();
        painting = true;
        focusCell(x, y);
        dispatch({ type: 'apply', x, y });
      });

      cell.addEventListener('pointerover', () => {
        if (!painting || state.tool === 'picker') return;
        dispatch({ type: 'apply', x, y });
      });

      cell.addEventListener('keydown', (event) => onCellKeyDown(event, x, y));

      row.append(cell);
      cells.push(cell);
    }

    gridEl.append(row);
  }

  const stopPainting = () => {
    painting = false;
  };
  window.addEventListener('pointerup', stopPainting);
  window.addEventListener('pointercancel', stopPainting);
  gridEl.addEventListener('pointerleave', stopPainting);

  function focusCell(x: number, y: number): void {
    const target = cells[y * GRID_SIZE + x];
    if (!target) return;
    for (const cell of cells) cell.tabIndex = -1;
    target.tabIndex = 0;
    target.focus({ preventScroll: true });
  }

  function onCellKeyDown(event: KeyboardEvent, x: number, y: number): void {
    if (event.ctrlKey || event.metaKey) return; // Ctrl+Z est traité à la racine.

    if (isActivationKey(event.key)) {
      event.preventDefault();
      dispatch({ type: 'apply', x, y });
      return;
    }

    const next = moveFocus({ x, y }, event.key);
    if (next.x !== x || next.y !== y) {
      event.preventDefault();
      focusCell(next.x, next.y);
      return;
    }

    const tool = toolForShortcut(event.key);
    if (tool) {
      dispatch({ type: 'setTool', tool });
      return;
    }

    const paletteIndex = paletteIndexForShortcut(event.key);
    if (paletteIndex !== null) {
      const color = hexToRgba(EDITOR_PALETTE[paletteIndex] ?? '');
      if (color) dispatch({ type: 'setColor', color });
    }
  }

  root.addEventListener('keydown', (event) => {
    if (!(event.ctrlKey || event.metaKey) || event.key.toLowerCase() !== 'z') return;
    const target = event.target as HTMLElement | null;
    if (target?.closest('input, textarea, select')) return;
    event.preventDefault();
    dispatch({ type: event.shiftKey ? 'redo' : 'undo' });
  });

  /* ---------- Palette ---------- */

  const paletteButtons: HTMLButtonElement[] = EDITOR_PALETTE.map((hex) => {
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'ie-swatch';
    button.dataset.hex = hex;
    button.style.backgroundColor = hex;
    button.title = hex;
    button.setAttribute('aria-label', hex);
    button.addEventListener('click', () => {
      const color = hexToRgba(hex);
      if (color) dispatch({ type: 'setColor', color });
    });
    paletteEl.append(button);
    return button;
  });

  colorInput.addEventListener('input', () => {
    const color = hexToRgba(colorInput.value);
    if (color) dispatch({ type: 'setColor', color });
  });

  /* ---------- Outils et actions ---------- */

  const toolButtons = Array.from(root.querySelectorAll<HTMLButtonElement>('[data-tool]'));
  for (const button of toolButtons) {
    button.addEventListener('click', () => {
      const tool = button.dataset.tool as EditorTool | undefined;
      if (tool) dispatch({ type: 'setTool', tool });
    });
  }

  root.querySelector('[data-undo]')?.addEventListener('click', () => dispatch({ type: 'undo' }));
  root.querySelector('[data-redo]')?.addEventListener('click', () => dispatch({ type: 'redo' }));
  root.querySelector('[data-clear]')?.addEventListener('click', () => dispatch({ type: 'clear' }));

  root.querySelector('[data-download]')?.addEventListener('click', () => {
    const url = URL.createObjectURL(createPngBlob(state.grid));
    const link = document.createElement('a');
    link.href = url;
    link.download = EXPORT_FILENAME;
    document.body.append(link);
    link.click();
    link.remove();
    window.setTimeout(() => URL.revokeObjectURL(url), 1000);
  });

  /* ---------- Import ---------- */

  fileInput.addEventListener('change', async () => {
    const file = fileInput.files?.[0];
    if (!file) return;
    importError.textContent = '';
    try {
      const { grid } = await iconFromFile(file);
      dispatch({ type: 'load', grid });
    } catch {
      importError.textContent = copy.importError;
    } finally {
      fileInput.value = '';
    }
  });

  /* ---------- État → DOM ---------- */

  function dispatch(action: EditorAction): void {
    const next = editorReducer(state, action);
    if (next === state) return; // action sans effet : le réducteur renvoie le même objet.
    state = next;
    savedEl.textContent = '';
    render();
    scheduleSave();
  }

  function render(): void {
    gridEl.dataset.tool = state.tool;

    const url = encodePngDataUrl(state.grid);
    previewReal.src = url;
    previewLarge.src = url;

    for (let i = 0; i < cells.length; i++) {
      const x = i % GRID_SIZE;
      const y = (i - x) / GRID_SIZE;
      const pixel = getPixel(state.grid, x, y) as Rgba;
      const cell = cells[i] as HTMLDivElement;
      const visible = pixel[3] !== 0;
      const label = visible ? rgbaToHex(pixel) : copy.empty;

      cell.style.backgroundColor = visible ? cssColor(pixel) : 'transparent';
      cell.setAttribute(
        'aria-label',
        fillTemplate(copy.cellAria, {
          row: String(y + 1),
          col: String(x + 1),
          color: label,
        }),
      );
    }

    for (const button of toolButtons) {
      const active = button.dataset.tool === state.tool;
      button.classList.toggle('is-active', active);
      button.setAttribute('aria-pressed', String(active));
    }

    const current = rgbaToHex(state.color);
    for (const button of paletteButtons) {
      button.classList.toggle('is-active', button.dataset.hex === current);
    }
    colorInput.value = hex6(state.color);

    renderChecks();
  }

  function renderChecks(): void {
    const review = reviewIcon(state.grid);
    const items: { label: string; ok: boolean }[] = [];

    if (review.empty) items.push({ label: copy.checkEmpty, ok: false });
    if (review.pureBlack) items.push({ label: copy.checkBlack, ok: false });
    if (review.tooManyColors) {
      items.push({ label: `${copy.checkColors} (${review.colors})`, ok: false });
    }
    if (items.length === 0) items.push({ label: copy.checkOk, ok: true });

    checksEl.replaceChildren(
      ...items.map(({ label, ok }) => {
        const item = document.createElement('li');
        item.className = ok ? 'is-ok' : 'is-warn';
        item.textContent = label;
        return item;
      }),
    );
  }

  /* ---------- Brouillon ---------- */

  function scheduleSave(): void {
    window.clearTimeout(saveTimer);
    saveTimer = window.setTimeout(() => {
      saveDraft(state.grid, EDITOR_DRAFT_KEY);
      savedEl.textContent = copy.saved;
    }, AUTOSAVE_DELAY_MS);
  }

  window.addEventListener('pagehide', () => saveDraft(state.grid, EDITOR_DRAFT_KEY));

  render();
}

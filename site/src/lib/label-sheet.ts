export type Paper = 'a4' | 'letter';

export interface LabelSheetConfig {
  paper: Paper;
  columns: number;
  rows: number;
  labelWidthMm: number;
  labelHeightMm: number;
  marginXMm: number;
  marginYMm: number;
  gapXMm: number;
  gapYMm: number;
}

export interface LabelPosition {
  xMm: number;
  yMm: number;
  widthMm: number;
  heightMm: number;
}

const PAPER_MM = {
  a4: { widthMm: 210, heightMm: 297 },
  letter: { widthMm: 215.9, heightMm: 279.4 },
} as const;

export function paperSizeMm(paper: Paper) {
  return PAPER_MM[paper];
}

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

export function labelPositions(config: LabelSheetConfig): LabelPosition[] {
  const positions: LabelPosition[] = [];
  for (let row = 0; row < config.rows; row++) {
    for (let column = 0; column < config.columns; column++) {
      positions.push({
        xMm: config.marginXMm + column * (config.labelWidthMm + config.gapXMm),
        yMm: config.marginYMm + row * (config.labelHeightMm + config.gapYMm),
        widthMm: config.labelWidthMm,
        heightMm: config.labelHeightMm,
      });
    }
  }
  return positions;
}

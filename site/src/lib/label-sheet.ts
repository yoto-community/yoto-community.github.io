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

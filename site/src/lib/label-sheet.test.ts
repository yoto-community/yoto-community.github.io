import { describe, expect, it } from 'vitest';
import { labelPositions, paperSizeMm, type LabelSheetConfig } from './label-sheet';

const config: LabelSheetConfig = {
  paper: 'a4',
  columns: 2,
  rows: 5,
  labelWidthMm: 90,
  labelHeightMm: 48,
  marginXMm: 10,
  marginYMm: 10,
  gapXMm: 4,
  gapYMm: 4,
};

describe('labelPositions', () => {
  it('returns ten positions for a 2x5 sheet', () => {
    expect(labelPositions(config)).toHaveLength(10);
  });

  it('places the first label inside the margins', () => {
    expect(labelPositions(config)[0]).toEqual({
      xMm: 10,
      yMm: 10,
      widthMm: 90,
      heightMm: 48,
    });
  });

  it('keeps every label inside the paper', () => {
    const paper = paperSizeMm('a4');
    for (const label of labelPositions(config)) {
      expect(label.xMm + label.widthMm).toBeLessThanOrEqual(paper.widthMm);
      expect(label.yMm + label.heightMm).toBeLessThanOrEqual(paper.heightMm);
    }
  });

  it('supports Letter paper', () => {
    const paper = paperSizeMm('letter');
    expect(paper.widthMm).toBe(215.9);
    expect(paper.heightMm).toBe(279.4);
  });
});

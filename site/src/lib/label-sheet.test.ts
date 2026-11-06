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

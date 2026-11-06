import { describe, expect, it } from 'vitest';
import {
  CARD_HEIGHT_MM,
  CARD_WIDTH_MM,
  LABEL_PRESETS,
  cardZoneWidthMm,
  countLabels,
  labelPositions,
  paperSizeMm,
  presetById,
  trimWidthMm,
  validateSheetConfig,
  type LabelSheetConfig,
} from './label-sheet';

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
    expect(CARD_HEIGHT_MM).toBe(53.975);
    expect(cardZoneWidthMm(us10)).toBeCloseTo(85.725, 3);
    expect(trimWidthMm(us10)).toBeCloseTo(15.875, 3);
  });

  it('leaves a 14.275 mm title strip on the A4 preset', () => {
    expect(trimWidthMm(presetById('a4-2x5')!.config)).toBeCloseTo(14.275, 3);
  });

  it('never lets the card zone exceed a narrow label', () => {
    const narrow = { ...presetById('a4-2x5')!.config, labelWidthMm: 70 };
    expect(cardZoneWidthMm(narrow)).toBe(70);
    expect(trimWidthMm(narrow)).toBe(0);
  });

  it('returns undefined for an unknown preset id', () => {
    expect(presetById('unknown')).toBeUndefined();
    expect(presetById(null)).toBeUndefined();
  });

  it('returns copied presets that cannot mutate the shipped ones', () => {
    const first = presetById('a4-2x5')!;
    first.config.labelWidthMm = 999;
    first.name = 'mutated';

    const second = presetById('a4-2x5')!;
    expect(second.config.labelWidthMm).toBe(100);
    expect(second.name).toBe('A4, 2 × 5 (100 × 55 mm)');
    expect(LABEL_PRESETS.find((preset) => preset.id === 'a4-2x5')?.config.labelWidthMm).toBe(100);
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
    expect(validateSheetConfig({ ...base, labelHeightMm: 5 })).toContain('label-height');
    expect(validateSheetConfig({ ...base, gapXMm: -1 })).toContain('margin');
  });

  it('rejects unknown papers, including inherited prototype keys', () => {
    expect(validateSheetConfig({ ...base, paper: 'tabloid' as never })).toContain('paper');
    expect(validateSheetConfig({ ...base, paper: 'toString' as never })).toContain('paper');
    expect(validateSheetConfig({ ...base, paper: 'constructor' as never })).toContain('paper');
    expect(validateSheetConfig({ ...base, paper: 'valueOf' as never })).toContain('paper');
  });
});

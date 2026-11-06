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

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

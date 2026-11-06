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

import { describe, expect, it } from 'vitest';
import { createGrid, setPixel, type Rgba } from '@yoto-community/pixel-editor-core';
import { reviewIcon } from './icon-checks';

function gridWith(colors: Rgba[]) {
  const grid = createGrid();
  colors.forEach((color, index) => setPixel(grid, index % 16, Math.floor(index / 16), color));
  return grid;
}

describe('reviewIcon', () => {
  it('flags an empty grid', () => {
    const review = reviewIcon(createGrid());
    expect(review.empty).toBe(true);
    expect(review.colors).toBe(0);
    expect(review.pureBlack).toBe(false);
    expect(review.tooManyColors).toBe(false);
  });

  it('flags pure black, which vanishes on the player background', () => {
    const review = reviewIcon(gridWith([[0, 0, 0, 255]]));
    expect(review.empty).toBe(false);
    expect(review.pureBlack).toBe(true);
  });

  it('accepts a small, readable palette', () => {
    const review = reviewIcon(
      gridWith([
        [255, 255, 255, 255],
        [0, 109, 65, 255],
        [31, 42, 36, 255],
      ]),
    );
    expect(review.pureBlack).toBe(false);
    expect(review.colors).toBe(3);
    expect(review.tooManyColors).toBe(false);
  });

  it('flags grids above the colour threshold', () => {
    const colors: Rgba[] = Array.from({ length: 9 }, (_, i) => [i * 10, i * 20, i * 30, 255]);
    const review = reviewIcon(gridWith(colors));
    expect(review.colors).toBe(9);
    expect(review.tooManyColors).toBe(true);
  });

  it('honours an explicit threshold', () => {
    const colors: Rgba[] = Array.from({ length: 3 }, (_, i) => [i * 10, 0, 0, 255]);
    expect(reviewIcon(gridWith(colors), 2).tooManyColors).toBe(true);
  });
});

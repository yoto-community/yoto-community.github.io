import { describe, expect, it } from 'vitest';
import { panBy, transformStyle, zoomAtPoint } from './cover-transform';

describe('zoomAtPoint', () => {
  it('keeps the pan unchanged when zooming at the centre', () => {
    const next = zoomAtPoint({ zoom: 1, panX: 0.2, panY: -0.1 }, 0.5, 0.5, -120);
    expect(next.zoom).toBeCloseTo(1.1, 5);
    expect(next.panX).toBeCloseTo(0.2, 5);
    expect(next.panY).toBeCloseTo(-0.1, 5);
  });

  it('moves the pan when zooming away from the centre', () => {
    const next = zoomAtPoint({ zoom: 1, panX: 0, panY: 0 }, 0.25, 0.75, -120);
    expect(next.panX).toBeGreaterThan(0);
    expect(next.panY).toBeLessThan(0);
  });

  it('clamps zoom between 0.2 and 8', () => {
    expect(zoomAtPoint({ zoom: 1, panX: 0, panY: 0 }, 0.5, 0.5, -10000).zoom).toBe(8);
    expect(zoomAtPoint({ zoom: 1, panX: 0, panY: 0 }, 0.5, 0.5, 10000).zoom).toBe(0.2);
  });
});

describe('panBy', () => {
  it('adds a fraction and clamps to [-1, 1]', () => {
    expect(panBy({ panX: 0.5, panY: 0.5 }, 0.1, -1.2)).toEqual({ panX: 0.6, panY: -0.7 });
    expect(panBy({ panX: 0, panY: 0 }, 5, -5)).toEqual({ panX: 1, panY: -1 });
  });
});

describe('transformStyle', () => {
  it('serialises a CSS transform', () => {
    expect(transformStyle({ zoom: 2, panX: 0.25, panY: -0.5 })).toBe(
      'translate(25%, -50%) scale(2)',
    );
  });
});

import { clampPan, clampZoom } from './cover-project';

export interface TransformState {
  zoom: number;
  panX: number;
  panY: number;
}

export function zoomAtPoint(
  state: TransformState,
  ux: number,
  uy: number,
  deltaY: number,
): TransformState {
  const oldZoom = clampZoom(state.zoom);
  const newZoom = clampZoom(oldZoom * Math.pow(1.1, -deltaY / 120));
  if (newZoom === oldZoom) return { ...state, zoom: newZoom };

  const ratio = newZoom / oldZoom;
  return {
    zoom: newZoom,
    panX: clampPan(ux - 0.5 - (ux - 0.5 - state.panX) * ratio),
    panY: clampPan(uy - 0.5 - (uy - 0.5 - state.panY) * ratio),
  };
}

export function panBy(
  state: Pick<TransformState, 'panX' | 'panY'>,
  dx: number,
  dy: number,
): Pick<TransformState, 'panX' | 'panY'> {
  return {
    panX: clampPan(state.panX + dx),
    panY: clampPan(state.panY + dy),
  };
}

export function transformStyle(state: TransformState): string {
  return `translate(${state.panX * 100}%, ${state.panY * 100}%) scale(${clampZoom(state.zoom)})`;
}

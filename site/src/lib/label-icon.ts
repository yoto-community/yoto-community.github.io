import { decodeImageBlob } from '@yoto-community/pixel-editor-core/browser';
import { encodePngDataUrl, type PixelGrid } from '@yoto-community/pixel-editor-core';

export interface LabelIcon {
  grid: PixelGrid;
  dataUrl: string;
}

export async function iconFromFile(file: File): Promise<LabelIcon> {
  const grid = await decodeImageBlob(file);
  return { grid, dataUrl: encodePngDataUrl(grid) };
}

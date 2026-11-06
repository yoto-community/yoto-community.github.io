import type { CoverImage } from './cover-project';

export const MAX_IMAGE_BYTES = 20 * 1024 * 1024;

const ALLOWED_TYPES = new Set(['image/png', 'image/jpeg', 'image/webp', 'image/gif']);

export interface ImageImportResult {
  images: CoverImage[];
  rejected: number;
  tooLarge: number;
}

export function filesToImages(files: File[]): ImageImportResult {
  const images: CoverImage[] = [];
  let rejected = 0;
  let tooLarge = 0;

  for (const file of files) {
    if (!ALLOWED_TYPES.has(file.type)) {
      rejected += 1;
      continue;
    }
    if (file.size > MAX_IMAGE_BYTES) {
      tooLarge += 1;
      continue;
    }
    images.push({
      id: crypto.randomUUID(),
      fileName: file.name,
      mimeType: file.type,
      blob: file,
    });
  }

  return { images, rejected, tooLarge };
}

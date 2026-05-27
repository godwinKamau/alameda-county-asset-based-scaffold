/** Max size of the file the teacher selects before client-side optimization. */
export const MAX_SOURCE_ARTIFACT_BYTES = 100 * 1024 * 1024;

/** Target max size of the optimized JPEG sent to the server (Vercel-safe). */
export const MAX_UPLOAD_BYTES = 4 * 1024 * 1024;

/** Max PDF pages a teacher can select for one analysis. */
export const MAX_PAGES_PER_ANALYSIS = 5;

/** Long edge for PDF page thumbnails in the picker UI. */
export const PDF_THUMBNAIL_MAX_EDGE_PX = 240;

/** Longest edge sent to the server (matches server PDF rasterizer). */
export const ARTIFACT_MAX_LONG_EDGE_PX = 2000;

export const ARTIFACT_JPEG_QUALITY = 0.85;

export function formatMegabytes(bytes: number): string {
  return `${Math.round(bytes / (1024 * 1024))} MB`;
}

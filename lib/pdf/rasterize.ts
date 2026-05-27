import "server-only";

import { createCanvas } from "@napi-rs/canvas";
import { getDocument, GlobalWorkerOptions } from "pdfjs-dist/legacy/build/pdf.mjs";
import sharp from "sharp";

GlobalWorkerOptions.workerSrc = "";

export interface RasterizedImage {
  base64: string;
  mediaType: "image/jpeg";
}

export async function rasterizePdfFirstPage(
  pdfBuffer: Buffer,
): Promise<RasterizedImage> {
  const loadingTask = getDocument({
    data: new Uint8Array(pdfBuffer),
    useSystemFonts: true,
    disableFontFace: true,
  });

  const pdf = await loadingTask.promise;
  const page = await pdf.getPage(1);

  const viewport = page.getViewport({ scale: 2 });
  const canvas = createCanvas(viewport.width, viewport.height);
  const context = canvas.getContext("2d");

  await page.render({
    canvasContext: context as unknown as CanvasRenderingContext2D,
    viewport,
  }).promise;

  const pngBuffer = canvas.toBuffer("image/png");

  const jpegBuffer = await sharp(pngBuffer)
    .resize({ width: 2000, withoutEnlargement: true })
    .jpeg({ quality: 85 })
    .toBuffer();

  return {
    base64: jpegBuffer.toString("base64"),
    mediaType: "image/jpeg",
  };
}

export function bufferToBase64Image(
  buffer: Buffer,
  mimeType: string,
): { base64: string; mediaType: "image/jpeg" | "image/png" | "image/gif" | "image/webp" } {
  const normalized = mimeType.toLowerCase();

  if (
    normalized === "image/jpeg" ||
    normalized === "image/png" ||
    normalized === "image/gif" ||
    normalized === "image/webp"
  ) {
    return {
      base64: buffer.toString("base64"),
      mediaType: normalized,
    };
  }

  throw new Error(`Unsupported image type: ${mimeType}`);
}

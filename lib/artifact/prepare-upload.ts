import {
  ARTIFACT_JPEG_QUALITY,
  ARTIFACT_MAX_LONG_EDGE_PX,
  MAX_PAGES_PER_ANALYSIS,
  MAX_UPLOAD_BYTES,
  PDF_THUMBNAIL_MAX_EDGE_PX,
} from "./constants";

let pdfWorkerConfigured = false;

type ArtifactKind = "pdf" | "image";

interface CompressionAttempt {
  maxLongEdge: number;
  quality: number;
}

export interface PdfPageThumbnail {
  pageNumber: number;
  dataUrl: string;
}

export interface PrepareArtifactOptions {
  pdfPages?: number[];
}

const COMPRESSION_ATTEMPTS: CompressionAttempt[] = [
  { maxLongEdge: ARTIFACT_MAX_LONG_EDGE_PX, quality: ARTIFACT_JPEG_QUALITY },
  { maxLongEdge: ARTIFACT_MAX_LONG_EDGE_PX, quality: 0.7 },
  { maxLongEdge: 1600, quality: 0.7 },
  { maxLongEdge: 1200, quality: 0.65 },
];

async function ensurePdfWorker(): Promise<void> {
  if (pdfWorkerConfigured) return;

  const pdfjs = await import("pdfjs-dist");
  pdfjs.GlobalWorkerOptions.workerSrc = "/pdf.worker.min.mjs";
  pdfWorkerConfigured = true;
}

function artifactBaseName(fileName: string): string {
  const trimmed = fileName.replace(/\.[^.]+$/, "").trim();
  return trimmed || "artifact";
}

function detectArtifactKind(file: File): ArtifactKind {
  const lowerName = file.name.toLowerCase();

  if (file.type === "application/pdf" || lowerName.endsWith(".pdf")) {
    return "pdf";
  }

  if (
    file.type.startsWith("image/") ||
    /\.(jpe?g|png|gif|webp|heic|heif|bmp|tiff?)$/i.test(lowerName)
  ) {
    return "image";
  }

  throw new Error("File must be JPG, PNG, GIF, WEBP, HEIC, or PDF.");
}

export function isPdfFile(file: File): boolean {
  return (
    file.type === "application/pdf" || file.name.toLowerCase().endsWith(".pdf")
  );
}

async function loadPdfDocument(file: File) {
  await ensurePdfWorker();
  const { getDocument } = await import("pdfjs-dist");
  const buffer = await file.arrayBuffer();
  return getDocument({ data: buffer }).promise;
}

function canvasToJpegFile(
  canvas: HTMLCanvasElement,
  outputName: string,
  quality: number,
): Promise<File> {
  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) => {
        if (!blob) {
          reject(new Error("Could not optimize the image."));
          return;
        }

        resolve(new File([blob], outputName, { type: "image/jpeg" }));
      },
      "image/jpeg",
      quality,
    );
  });
}

async function readImageDimensions(
  file: File,
): Promise<{ width: number; height: number }> {
  const objectUrl = URL.createObjectURL(file);

  try {
    return await new Promise((resolve, reject) => {
      const image = new Image();
      image.onload = () => {
        resolve({ width: image.naturalWidth, height: image.naturalHeight });
      };
      image.onerror = () => {
        reject(new Error("Could not read the image."));
      };
      image.src = objectUrl;
    });
  } finally {
    URL.revokeObjectURL(objectUrl);
  }
}

async function renderImageToCanvas(
  file: File,
  maxLongEdge: number,
): Promise<HTMLCanvasElement> {
  const { width, height } = await readImageDimensions(file);
  const scale = Math.min(1, maxLongEdge / Math.max(width, height));
  const targetWidth = Math.max(1, Math.round(width * scale));
  const targetHeight = Math.max(1, Math.round(height * scale));

  const resizeOptions =
    width >= height
      ? {
          resizeWidth: targetWidth,
          resizeQuality: "high" as const,
        }
      : {
          resizeHeight: targetHeight,
          resizeQuality: "high" as const,
        };

  const bitmap = await createImageBitmap(file, resizeOptions);
  try {
    const canvas = document.createElement("canvas");
    canvas.width = bitmap.width;
    canvas.height = bitmap.height;

    const context = canvas.getContext("2d");
    if (!context) {
      throw new Error("Could not optimize the image.");
    }

    context.drawImage(bitmap, 0, 0);
    return canvas;
  } finally {
    bitmap.close();
  }
}

async function renderPdfPageFromDocument(
  pdf: Awaited<ReturnType<typeof loadPdfDocument>>,
  pageNumber: number,
  maxLongEdge: number,
): Promise<HTMLCanvasElement> {
  if (pageNumber < 1 || pageNumber > pdf.numPages) {
    throw new Error(`Page ${pageNumber} is out of range.`);
  }

  const page = await pdf.getPage(pageNumber);
  const baseViewport = page.getViewport({ scale: 1 });
  const renderScale = Math.min(
    2,
    maxLongEdge / Math.max(baseViewport.width, baseViewport.height),
  );
  const viewport = page.getViewport({ scale: renderScale });

  const canvas = document.createElement("canvas");
  canvas.width = Math.floor(viewport.width);
  canvas.height = Math.floor(viewport.height);

  const context = canvas.getContext("2d");
  if (!context) {
    throw new Error("Could not read the PDF.");
  }

  await page.render({
    canvasContext: context,
    viewport,
  }).promise;

  return canvas;
}

async function fitCanvasToUploadLimit(
  renderCanvas: (maxLongEdge: number) => Promise<HTMLCanvasElement>,
  outputName: string,
  maxBytes: number,
): Promise<File> {
  let lastFile: File | null = null;

  for (const attempt of COMPRESSION_ATTEMPTS) {
    const canvas = await renderCanvas(attempt.maxLongEdge);
    const prepared = await canvasToJpegFile(
      canvas,
      outputName,
      attempt.quality,
    );
    lastFile = prepared;

    if (prepared.size <= maxBytes) {
      return prepared;
    }
  }

  if (lastFile) {
    throw new Error(
      `Could not optimize the file enough for upload (${Math.round(lastFile.size / (1024 * 1024))} MB after compression). Try selecting fewer pages or using a lower-resolution scan.`,
    );
  }

  throw new Error("Could not optimize the file for upload.");
}

export async function getPdfPageCount(file: File): Promise<number> {
  const pdf = await loadPdfDocument(file);
  return pdf.numPages;
}

export async function getPdfPageThumbnails(
  file: File,
  max = MAX_PAGES_PER_ANALYSIS,
): Promise<{ totalPages: number; thumbnails: PdfPageThumbnail[] }> {
  const pdf = await loadPdfDocument(file);
  const totalPages = pdf.numPages;
  const count = Math.min(max, totalPages);
  const thumbnails: PdfPageThumbnail[] = [];

  for (let pageNumber = 1; pageNumber <= count; pageNumber += 1) {
    const canvas = await renderPdfPageFromDocument(
      pdf,
      pageNumber,
      PDF_THUMBNAIL_MAX_EDGE_PX,
    );
    thumbnails.push({
      pageNumber,
      dataUrl: canvas.toDataURL("image/jpeg", 0.7),
    });
  }

  return { totalPages, thumbnails };
}

export async function prepareArtifactForUpload(
  file: File,
  opts?: PrepareArtifactOptions,
): Promise<File[]> {
  const kind = detectArtifactKind(file);
  const baseName = artifactBaseName(file.name);

  if (kind === "image") {
    const outputName = `${baseName}.jpg`;
    const prepared = await fitCanvasToUploadLimit(
      (maxLongEdge) => renderImageToCanvas(file, maxLongEdge),
      outputName,
      MAX_UPLOAD_BYTES,
    );
    return [prepared];
  }

  const pdfPages = opts?.pdfPages?.length ? opts.pdfPages : [1];
  if (pdfPages.length > MAX_PAGES_PER_ANALYSIS) {
    throw new Error(`Select at most ${MAX_PAGES_PER_ANALYSIS} pages.`);
  }

  const pdf = await loadPdfDocument(file);
  const perImageBudget = Math.floor(MAX_UPLOAD_BYTES / pdfPages.length);
  const preparedFiles: File[] = [];

  for (const pageNumber of pdfPages) {
    const outputName =
      pdfPages.length > 1
        ? `${baseName}-page-${pageNumber}.jpg`
        : `${baseName}.jpg`;

    const prepared = await fitCanvasToUploadLimit(
      (maxLongEdge) =>
        renderPdfPageFromDocument(pdf, pageNumber, maxLongEdge),
      outputName,
      perImageBudget,
    );
    preparedFiles.push(prepared);
  }

  return preparedFiles;
}

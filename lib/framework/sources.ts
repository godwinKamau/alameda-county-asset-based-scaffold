import type { ScaffoldSource } from "@/lib/types";
import { getChapterPdfPageOffset } from "./chapter-offsets";
import type { FrameworkMove } from "./types";

const CHAPTER_PDF_BASE =
  "https://www.cde.ca.gov/ci/rl/cf/documents/elaeldfwchapter";

export function chapterPdfUrl(chapter: number): string {
  return `${CHAPTER_PDF_BASE}${chapter}.pdf`;
}

/** Map a printed framework page number to a PDF viewer page index. */
export function printedPageToPdfPage(
  printedPage: number,
  pdfPageOffset: number,
): number {
  return printedPage - pdfPageOffset;
}

export function chapterPdfUrlWithPage(
  chapter: number,
  printedPage: number,
  pdfPageOffset?: number | null,
): string {
  const base = chapterPdfUrl(chapter);
  if (pdfPageOffset == null) {
    return base;
  }

  const pdfPage = printedPageToPdfPage(printedPage, pdfPageOffset);
  if (pdfPage < 1) {
    return base;
  }

  return `${base}#page=${pdfPage}`;
}

export function scaffoldSourceHref(source: ScaffoldSource): string {
  const offset = getChapterPdfPageOffset(source.chapter);
  return chapterPdfUrlWithPage(source.chapter, source.page, offset);
}

export function buildScaffoldSource(
  move: FrameworkMove,
  pdfPageOffset?: number | null,
): ScaffoldSource | null {
  if (move.source_chapter == null || move.source_page == null) {
    return null;
  }

  const offset =
    pdfPageOffset ?? getChapterPdfPageOffset(move.source_chapter);

  return {
    chapter: move.source_chapter,
    page: move.source_page,
    ...(move.source_page_end != null &&
    move.source_page_end !== move.source_page
      ? { page_end: move.source_page_end }
      : {}),
    url: chapterPdfUrlWithPage(
      move.source_chapter,
      move.source_page,
      offset,
    ),
    anchor: move.framework_anchor,
  };
}

export function getScaffoldSourceAnchors(
  sources: ScaffoldSource[] | undefined,
): Set<string> {
  const anchors = new Set<string>();
  if (!sources?.length) {
    return anchors;
  }

  for (const source of sources) {
    if (source.anchor) {
      anchors.add(source.anchor);
    }
  }

  return anchors;
}

export function dedupeScaffoldSources(sources: ScaffoldSource[]): ScaffoldSource[] {
  const seen = new Set<string>();
  const result: ScaffoldSource[] = [];

  for (const source of sources) {
    const key = `${source.chapter}:${source.page}:${source.page_end ?? ""}`;
    if (seen.has(key)) {
      continue;
    }
    seen.add(key);
    result.push(source);
  }

  return result;
}

export function resolveScaffoldSourcesFromIds(
  ids: number[] | undefined,
  citableMoves: FrameworkMove[],
): ScaffoldSource[] {
  if (!ids?.length || citableMoves.length === 0) {
    return [];
  }

  const sources: ScaffoldSource[] = [];

  for (const id of ids) {
    if (!Number.isInteger(id) || id < 1 || id > citableMoves.length) {
      continue;
    }
    const move = citableMoves[id - 1];
    const source = buildScaffoldSource(move);
    if (source) {
      sources.push(source);
    }
  }

  return dedupeScaffoldSources(sources);
}

export function formatScaffoldSourceLabel(source: ScaffoldSource): string {
  const page =
    source.page_end != null && source.page_end !== source.page
      ? `p. ${source.page}–${source.page_end}`
      : `p. ${source.page}`;
  return `CA ELA/ELD Framework, Ch. ${source.chapter}, ${page}`;
}

export function formatScaffoldSourceChipLabel(source: ScaffoldSource): string {
  const page =
    source.page_end != null && source.page_end !== source.page
      ? `p. ${source.page}–${source.page_end}`
      : `p. ${source.page}`;
  return `Ch. ${source.chapter} · ${page}`;
}

/** Assign resolved sources to numbered scaffold items for inline citation pills. */
export function distributeScaffoldSources(
  itemCount: number,
  sources: ScaffoldSource[],
): ScaffoldSource[][] {
  if (itemCount <= 0 || sources.length === 0) {
    return Array.from({ length: Math.max(itemCount, 0) }, () => []);
  }

  if (sources.length === 1) {
    return Array.from({ length: itemCount }, () => [sources[0]]);
  }

  if (sources.length === itemCount) {
    return sources.map((source) => [source]);
  }

  if (sources.length > itemCount) {
    const result = sources.slice(0, itemCount - 1).map((source) => [source]);
    result.push(sources.slice(itemCount - 1));
    return result;
  }

  return Array.from({ length: itemCount }, (_, index) =>
    index < sources.length ? [sources[index]] : [],
  );
}

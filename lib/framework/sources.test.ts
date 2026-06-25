import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { getChapterPdfPageOffset } from "./chapter-offsets";
import {
  buildScaffoldSource,
  chapterPdfUrlWithPage,
  dedupeScaffoldSources,
  distributeScaffoldSources,
  formatScaffoldSourceChipLabel,
  formatScaffoldSourceLabel,
  printedPageToPdfPage,
  resolveScaffoldSourcesFromIds,
  scaffoldSourceHref,
} from "./sources";
import type { FrameworkMove } from "./types";

const moveWithPage: FrameworkMove = {
  theme: "language_development",
  eld_mode: "designated",
  move: "Use a sentence frame.",
  framework_anchor: "Snapshot 4.1: Understanding Erosion",
  source_chapter: 4,
  source_page: 305,
  source_page_end: 307,
};

describe("printedPageToPdfPage", () => {
  it("subtracts the chapter offset from the printed page", () => {
    assert.equal(printedPageToPdfPage(305, 281), 24);
  });
});

describe("chapterPdfUrlWithPage", () => {
  it("appends a PDF page anchor when offset is known", () => {
    const url = chapterPdfUrlWithPage(4, 305, 281);
    assert.match(url, /elaeldfwchapter4\.pdf#page=24$/);
  });

  it("returns the base URL when offset is missing", () => {
    const url = chapterPdfUrlWithPage(4, 305, null);
    assert.match(url, /elaeldfwchapter4\.pdf$/);
    assert.doesNotMatch(url, /#page=/);
  });
});

describe("getChapterPdfPageOffset", () => {
  it("loads calibrated offsets from chapter metadata", () => {
    assert.equal(getChapterPdfPageOffset(4), 281);
  });
});

describe("buildScaffoldSource", () => {
  it("builds a source with a deep link when chapter offset is known", () => {
    const source = buildScaffoldSource(moveWithPage);
    assert.ok(source);
    assert.equal(source?.chapter, 4);
    assert.equal(source?.page, 305);
    assert.equal(source?.page_end, 307);
    assert.match(source?.url ?? "", /elaeldfwchapter4\.pdf#page=24$/);
  });

  it("returns null when page is missing", () => {
    assert.equal(
      buildScaffoldSource({ ...moveWithPage, source_page: undefined }),
      null,
    );
  });
});

describe("scaffoldSourceHref", () => {
  it("recomputes the href from chapter and printed page", () => {
    const href = scaffoldSourceHref({
      chapter: 4,
      page: 305,
      url: "https://www.cde.ca.gov/ci/rl/cf/documents/elaeldfwchapter4.pdf",
    });
    assert.match(href, /#page=24$/);
  });
});

describe("resolveScaffoldSourcesFromIds", () => {
  it("maps 1-based ids to deduped sources", () => {
    const moves = [moveWithPage, moveWithPage];
    const sources = resolveScaffoldSourcesFromIds([1, 2, 99], moves);
    assert.equal(sources.length, 1);
  });
});

describe("formatScaffoldSourceLabel", () => {
  it("formats a page range", () => {
    const label = formatScaffoldSourceLabel({
      chapter: 4,
      page: 305,
      page_end: 307,
      url: "https://example.com/ch4.pdf",
    });
    assert.match(label, /Ch\. 4, p\. 305–307/);
  });
});

describe("formatScaffoldSourceChipLabel", () => {
  it("uses a compact chapter and page label", () => {
    const label = formatScaffoldSourceChipLabel({
      chapter: 4,
      page: 305,
      url: "https://example.com/ch4.pdf",
    });
    assert.equal(label, "Ch. 4 · p. 305");
  });
});

describe("distributeScaffoldSources", () => {
  const sourceA = {
    chapter: 4,
    page: 305,
    url: "https://example.com/a.pdf",
  };
  const sourceB = {
    chapter: 4,
    page: 321,
    url: "https://example.com/b.pdf",
  };

  it("pairs one source per scaffold item when counts match", () => {
    const distributed = distributeScaffoldSources(2, [sourceA, sourceB]);
    assert.deepEqual(distributed, [[sourceA], [sourceB]]);
  });

  it("repeats a single source on each scaffold item", () => {
    const distributed = distributeScaffoldSources(2, [sourceA]);
    assert.deepEqual(distributed, [[sourceA], [sourceA]]);
  });
});

describe("dedupeScaffoldSources", () => {
  it("removes duplicate chapter/page pairs", () => {
    const source = buildScaffoldSource(moveWithPage)!;
    assert.equal(dedupeScaffoldSources([source, source]).length, 1);
  });
});

#!/usr/bin/env python3
"""
slice_chapter.py
----------------
Reduce a CA ELA/ELD Framework chapter PDF to just the instructionally
rich blocks a language model needs to extract writing moves:

  • Snapshot X.Y  blocks
  • Vignette X.Y  blocks
  • Key-theme writing sections (Writing, Effective Expression,
    Language Development, Content Knowledge, Foundational Skills,
    Vocabulary Instruction, Foundational Skills for English Learners)
  • Integrated / Designated ELD guidance sections

Everything else (standards lists, research citations, figures, tables,
policy rationale, appendices) is discarded.

Usage:
    python3 scripts/slice_chapter.py <pdf_path> [output_path]

Output:
    A compact Markdown file (~5–10% of the original character count).
    If output_path is omitted, writes <pdf_stem>_slices.md next to the PDF.

Requirements:
    pypdf  (auto-installed to .pylibs/ by run_chapter.sh, or install manually)
"""

import re
import sys
import pathlib

# ---------------------------------------------------------------------------
# pypdf import (supports both workspace .pylibs install and system install)
# ---------------------------------------------------------------------------
try:
    import pypdf
except ImportError:
    _lib = pathlib.Path(__file__).resolve().parent.parent / ".pylibs"
    if _lib.exists():
        sys.path.insert(0, str(_lib))
        import pypdf
    else:
        sys.exit("pypdf not found. Run:  pip3 install --target .pylibs pypdf")

# ---------------------------------------------------------------------------
# Patterns that START a block we want to keep
#
# Two tiers:
#   _BLOCK_START_PREFIX  — may have arbitrary text after the pattern
#                          (e.g. "Snapshot 3.1. Tingo Tango Mango Tree")
#   _BLOCK_START_EXACT   — must be the only text on the line (≤ 60 chars)
#                          to avoid matching prose that starts with one of
#                          these common words mid-paragraph.
# ---------------------------------------------------------------------------
_BLOCK_START_PREFIX = re.compile(
    r"^(Snapshot\s+\d+\.\d+|Vignette\s+\d+\.\d+|"
    r"ELA/Literacy\s+Vignette|Designated\s+ELD\s+Vignette|"
    r"Foundational\s+Skills\s+for\s+English\s+Learners|"
    r"Integrated\s+and\s+Designated\s+English\s+Language\s+Development|"
    r"English\s+Language\s+Development\s+in\s+"
    r"(Transitional\s+Kindergarten|Kindergarten|Grade\s+(One|Two|Three|Four|Five|Six|Seven|Eight|Nine|Ten|Eleven|Twelve|\d+))|"
    r"Supporting\s+Students\s+Strategically)",
    re.IGNORECASE,
)

# These only fire if the line is short (≤ 60 chars), preventing matches
# on mid-sentence words like "writing, speaking, listening…"
_BLOCK_START_EXACT = re.compile(
    r"^(Meaning\s+Making(\s+with\s+Text)?|"
    r"Language\s+Development|Effective\s+Expression|"
    r"Content\s+Knowledge|Foundational\s+Skills|"
    r"Writing|Discussing|Presenting|Using\s+Language\s+Conventions|"
    r"Vocabulary\s+Instruction|Reading\s+Aloud|"
    r"Print\s+Concepts|Phonological\s+Awareness|"
    r"Phonics\s+and\s+Word\s+Recognition|Fluency)"
    r"[.:]?\s*$",
    re.IGNORECASE,
)

# ---------------------------------------------------------------------------
# Lines to discard even inside a kept block (standards citations, boilerplate)
# ---------------------------------------------------------------------------
_SKIP_LINE = re.compile(
    r"^(CA\s+CCSS|CA\s+ELD\s+Standards|Related\s+CA|Source$|Sources$|"
    r"Snapshot\s+based\s+on|Resource$|Resources$|Additional\s+I\s*nformation|"
    r"Web\s+sites|Recommended\s+reading|===+\s*PDF\s+PAGE|"
    r"\d+\s*\|\s*C\s*h\s*ap\s*ter|Chapter\s+\d+\s*\||"
    r"Transitional\s+Kindergarten\s+C\s*h|Grade\s+1\s+C\s*h\s*ap\s*ter|"
    r"Kindergarten\s+C\s*h\s*ap\s*ter|"
    r"Related\s+California|Related\s+CA\s+Next|"
    r"Performance\s+Expectation|Science\s+and\s+Engineering)",
    re.IGNORECASE,
)

# ---------------------------------------------------------------------------
# Lines that are pure PDF extraction noise (all single-char tokens)
# ---------------------------------------------------------------------------
def _is_noise(line: str) -> bool:
    tokens = line.split()
    if not tokens:
        return False
    if len(tokens) <= 2:
        return False  # short real lines would be wrongly dropped
    single_char = sum(1 for t in tokens if len(t) == 1)
    return single_char / len(tokens) > 0.6  # >60% single-char tokens = noise


def is_section_start(line: str) -> bool:
    if _BLOCK_START_PREFIX.match(line):
        return True
    if len(line) <= 60 and _BLOCK_START_EXACT.match(line):
        return True
    return False


# ---------------------------------------------------------------------------
# Core slicer
# ---------------------------------------------------------------------------
def extract_pages(pdf_path: str) -> list[str]:
    reader = pypdf.PdfReader(pdf_path)
    return [page.extract_text() or "" for page in reader.pages]


def slice_pages(pages: list[str]) -> str:
    """
    Walk every line across all pages.  When we encounter a block-start
    header, start collecting.  Stop the block when we see:
      - three or more consecutive empty/noise lines (natural paragraph gap), OR
      - a new section header that is NOT a block-start (e.g. a major chapter
        heading like "Overview of the Span", "An Integrated and…").
    """
    blocks: list[str] = []
    current: list[str] = []
    in_block = False
    gap = 0  # consecutive blank/noise lines

    def flush():
        nonlocal current
        text = "\n".join(current).strip()
        if len(text) > 80:  # drop trivially short fragments
            blocks.append(text)
        current = []

    for page_idx, page_text in enumerate(pages):
        for raw in page_text.splitlines():
            line = raw.strip()

            # Drop known boilerplate regardless of context
            if _SKIP_LINE.match(line):
                continue

            # Drop PDF noise lines
            if _is_noise(line):
                continue

            # Empty line
            if not line:
                if in_block:
                    gap += 1
                    if gap >= 3:
                        flush()
                        in_block = False
                        gap = 0
                continue

            # Non-empty line resets the gap counter
            gap = 0

            if is_section_start(line):
                if in_block:
                    flush()
                in_block = True
                current.append(line)
                continue

            if in_block:
                current.append(line)

    if in_block:
        flush()

    return "\n\n---\n\n".join(blocks)


# ---------------------------------------------------------------------------
# Entry point
# ---------------------------------------------------------------------------
def main():
    if len(sys.argv) < 2:
        print(__doc__)
        sys.exit(1)

    pdf_path = pathlib.Path(sys.argv[1])
    if not pdf_path.exists():
        sys.exit(f"File not found: {pdf_path}")

    if len(sys.argv) >= 3:
        out_path = pathlib.Path(sys.argv[2])
    else:
        out_path = pdf_path.with_name(pdf_path.stem + "_slices.md")

    print(f"[slice] Extracting text from {pdf_path.name}…", flush=True)
    pages = extract_pages(str(pdf_path))
    print(f"[slice]   {len(pages)} pages extracted", flush=True)

    print("[slice] Slicing to relevant blocks…", flush=True)
    sliced = slice_pages(pages)

    orig_chars = sum(len(p) for p in pages)
    kept_chars = len(sliced)
    pct = 100 * kept_chars / orig_chars if orig_chars else 0

    out_path.write_text(sliced, encoding="utf-8")
    print(
        f"[slice]   {orig_chars:,} → {kept_chars:,} chars  "
        f"({pct:.1f}% kept)  →  {out_path}",
        flush=True,
    )


if __name__ == "__main__":
    main()

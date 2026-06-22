#!/usr/bin/env python3
"""
add_source_pages.py
-------------------
One-time transformation for data/framework/ch{3..7}.json:

  Option A — parse source_section strings and add source_page (int) and
             source_page_end (int, for ranges) to each move.

  Option C — add pdf_page_offset: null placeholder to each _meta block
             so it can be calibrated per chapter later.

Run from project root:
    python3 scripts/add_source_pages.py
"""

import json
import pathlib
import re


# ---------------------------------------------------------------------------
# Page-number extractor
# ---------------------------------------------------------------------------
# Matches the FIRST occurrence of "p. NNN" or "p. NNN–NNN" (em-dash or hyphen)
# in source_section strings like:
#   "Kindergarten, p. 222"
#   "Transitional Kindergarten, p. 192–194"
#   "Grade 6, Snapshot 6.1, p. 549–550"
#   "Snapshot 7.5 (p. 739–741)"
#   "p. 425, Figure 5.9"
#   "Using Language Conventions (p. 733, p. 783)"  → takes first (733)
_PAGE_RE = re.compile(r"p\.\s*(\d+)(?:\s*[–\-]\s*(\d+))?")


def extract_page_range(source_section: str | None) -> tuple[int | None, int | None]:
    if not source_section:
        return None, None
    m = _PAGE_RE.search(source_section)
    if not m:
        return None, None
    start = int(m.group(1))
    end = int(m.group(2)) if m.group(2) else None
    return start, end


# ---------------------------------------------------------------------------
# Move augmentation
# ---------------------------------------------------------------------------
def augment_move(mv: dict) -> dict:
    """Return a copy of mv with source_page / source_page_end inserted after
    source_section (if a page number can be parsed and not already present)."""
    if "source_page" in mv:
        return mv  # already done

    start, end = extract_page_range(mv.get("source_section"))
    if start is None:
        return mv

    # Rebuild dict preserving insertion order, injecting after source_section
    result: dict = {}
    for k, v in mv.items():
        result[k] = v
        if k == "source_section":
            result["source_page"] = start
            if end is not None:
                result["source_page_end"] = end
    return result


# ---------------------------------------------------------------------------
# Main
# ---------------------------------------------------------------------------
def main() -> None:
    data_dir = pathlib.Path(__file__).resolve().parent.parent / "data" / "framework"

    for ch in range(3, 8):
        path = data_dir / f"ch{ch}.json"
        data = json.loads(path.read_text(encoding="utf-8"))

        # Option C — add pdf_page_offset placeholder to _meta
        if "_meta" in data and "pdf_page_offset" not in data["_meta"]:
            data["_meta"]["pdf_page_offset"] = None

        # Option A — augment every move
        added = 0
        no_page = 0
        wm = data.get("writing_moves", {})
        for span, levels in wm.items():
            for lvl, moves in levels.items():
                augmented = []
                for mv in moves:
                    new_mv = augment_move(mv)
                    if "source_page" in new_mv and "source_page" not in mv:
                        added += 1
                    elif "source_page" not in new_mv:
                        no_page += 1
                    augmented.append(new_mv)
                levels[lvl] = augmented

        path.write_text(
            json.dumps(data, indent=2, ensure_ascii=False) + "\n",
            encoding="utf-8",
        )
        print(f"ch{ch}.json  →  {added:>3} source_page added  |  {no_page:>2} moves without page")

    print("\nDone.")


if __name__ == "__main__":
    main()

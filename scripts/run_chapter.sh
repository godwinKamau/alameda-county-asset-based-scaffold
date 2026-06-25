#!/usr/bin/env bash
# run_chapter.sh
# ─────────────────────────────────────────────────────────────────────────────
# Full pipeline: PDF → slices → chN.json
#
# Usage:
#   scripts/run_chapter.sh <pdf_path> <chapter_number> [--model <slug>] [--keep-slices]
#
# Examples:
#   # Process chapter 4 with the default model (claude-haiku-4-5)
#   scripts/run_chapter.sh ~/Desktop/elaeldfwchapter4.pdf 4
#
#   # Use a more capable model
#   scripts/run_chapter.sh ~/Desktop/elaeldfwchapter5.pdf 5 --model claude-sonnet-4-5
#
#   # Keep the intermediate slices file for inspection / re-runs
#   scripts/run_chapter.sh ~/Desktop/elaeldfwchapter4.pdf 4 --keep-slices
#
# Output:
#   data/framework/chN.json
#
# The intermediate slices file is written alongside the PDF as
#   <pdf_stem>_slices.md   and deleted after extraction unless --keep-slices.
# ─────────────────────────────────────────────────────────────────────────────
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
PYLIBS="$PROJECT_ROOT/.pylibs"

# ── Parse args ──────────────────────────────────────────────────────────────
PDF_PATH=""
CHAPTER=""
MODEL="claude-haiku-4-5"
KEEP_SLICES=0

while [[ $# -gt 0 ]]; do
  case "$1" in
    --model)       MODEL="$2"; shift 2 ;;
    --keep-slices) KEEP_SLICES=1; shift ;;
    --help|-h)
      head -30 "$0" | grep "^#" | sed 's/^# \?//'
      exit 0 ;;
    *)
      if [[ -z "$PDF_PATH" ]]; then
        PDF_PATH="$1"
      elif [[ -z "$CHAPTER" ]]; then
        CHAPTER="$1"
      else
        echo "Unknown argument: $1" >&2; exit 1
      fi
      shift ;;
  esac
done

if [[ -z "$PDF_PATH" || -z "$CHAPTER" ]]; then
  echo "Usage: scripts/run_chapter.sh <pdf_path> <chapter_number> [options]"
  exit 1
fi

if [[ ! -f "$PDF_PATH" ]]; then
  echo "Error: PDF not found: $PDF_PATH" >&2; exit 1
fi

# ── Ensure Python dependencies are available ─────────────────────────────────
echo "[deps] Checking Python dependencies…"

install_if_missing() {
  local pkg="$1"
  if ! python3 -c "import $pkg" 2>/dev/null; then
    echo "[deps]   Installing $pkg to $PYLIBS …"
    pip3 install --quiet --target "$PYLIBS" "$pkg"
  else
    echo "[deps]   $pkg ✓"
  fi
}

mkdir -p "$PYLIBS"
PYTHONPATH="$PYLIBS:${PYTHONPATH:-}" install_if_missing pypdf
PYTHONPATH="$PYLIBS:${PYTHONPATH:-}" install_if_missing anthropic

# ── Derive paths ─────────────────────────────────────────────────────────────
PDF_STEM="$(basename "${PDF_PATH%.*}")"
PDF_DIR="$(dirname "$PDF_PATH")"
SLICES_PATH="$PDF_DIR/${PDF_STEM}_slices.md"
OUT_PATH="$PROJECT_ROOT/data/framework/ch${CHAPTER}.json"

# ── Step 1: Slice ─────────────────────────────────────────────────────────────
echo ""
echo "═══ Step 1/2 — Slice ═══"
PYTHONPATH="$PYLIBS:${PYTHONPATH:-}" python3 "$SCRIPT_DIR/slice_chapter.py" \
  "$PDF_PATH" "$SLICES_PATH"

# ── Step 2: Extract moves ─────────────────────────────────────────────────────
echo ""
echo "═══ Step 2/2 — Extract ═══"
PYTHONPATH="$PYLIBS:${PYTHONPATH:-}" python3 "$SCRIPT_DIR/extract_moves.py" \
  "$SLICES_PATH" "$CHAPTER" \
  --model "$MODEL" \
  --out "$OUT_PATH"

# ── Cleanup ───────────────────────────────────────────────────────────────────
if [[ $KEEP_SLICES -eq 0 ]]; then
  rm -f "$SLICES_PATH"
  echo "[done] Removed $SLICES_PATH"
else
  echo "[done] Kept slices → $SLICES_PATH"
fi

echo ""
echo "✓ Chapter $CHAPTER complete → $OUT_PATH"

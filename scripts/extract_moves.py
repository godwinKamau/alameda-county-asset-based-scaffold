#!/usr/bin/env python3
"""
extract_moves.py
----------------
Call the Anthropic API to extract structured writing-move JSON from a
pre-sliced CA ELA/ELD Framework chapter file, then validate and write
the result to data/framework/chN.json.

Usage:
    python3 scripts/extract_moves.py <slices_md> <chapter_number> [options]

Options:
    --out   <path>   Override output path  (default: data/framework/chN.json)
    --model <slug>   Anthropic model slug  (default: claude-haiku-4-5)
    --dry-run        Print the prompt but do not call the API

Environment:
    ANTHROPIC_API_KEY  — read from .env.local or the shell environment

Requirements:
    anthropic  (auto-installed to .pylibs/ by run_chapter.sh)
"""

import json
import os
import pathlib
import re
import sys
import textwrap

# ---------------------------------------------------------------------------
# Resolve .env.local so the key is available even outside Next.js
# ---------------------------------------------------------------------------
def _load_env_local():
    env_path = pathlib.Path(__file__).resolve().parent.parent / ".env.local"
    if not env_path.exists():
        return
    for line in env_path.read_text().splitlines():
        line = line.strip()
        if not line or line.startswith("#"):
            continue
        eq = line.find("=")
        if eq == -1:
            continue
        k, v = line[:eq].strip(), line[eq + 1:].strip()
        if k not in os.environ:
            os.environ[k] = v


_load_env_local()

# ---------------------------------------------------------------------------
# anthropic import (supports .pylibs install)
# ---------------------------------------------------------------------------
try:
    import anthropic
except ImportError:
    _lib = pathlib.Path(__file__).resolve().parent.parent / ".pylibs"
    if _lib.exists():
        sys.path.insert(0, str(_lib))
        try:
            import anthropic
        except ImportError:
            sys.exit("anthropic not found. Run:  pip3 install --target .pylibs anthropic")
    else:
        sys.exit("anthropic not found. Run:  pip3 install --target .pylibs anthropic")

# ---------------------------------------------------------------------------
# Prompt template
# ---------------------------------------------------------------------------
SYSTEM_PROMPT = textwrap.dedent("""\
You are extracting structured instructional data from a chapter of the
California ELA/ELD Framework (California Department of Education).
Your goal is to produce a single valid JSON object.
Do not output anything outside the JSON object — no markdown fences,
no explanation before or after.
""")

def build_user_prompt(cfg: dict, slices_text: str) -> str:
    chapter      = cfg["chapter"]
    title        = cfg["title"]
    grade_range  = cfg["grade_range"]
    grade_band   = cfg["grade_band"]
    span_keys    = cfg["span_keys"]
    span_notes   = cfg["span_notes"]
    source_url   = cfg["source_url"]

    # Describe the schema span keys dynamically
    span_key_str = " and/or ".join(f'"{k}"' for k in span_keys)
    span_key_allowed = ", ".join(f'"{k}"' for k in span_keys)

    # Span assignment guidance
    if len(span_keys) == 1:
        span_rule = f'All moves in this chapter belong under span key "{span_keys[0]}".'
    elif span_keys == ["K", "1-2"]:
        span_rule = (
            '"K" → use for moves explicitly targeting kindergarten or TK students. '
            '"1-2" → use for moves explicitly targeting grade 1 students. '
            'If the framework presents a move as spanning TK–1 without distinguishing '
            'between them, include it under both "K" and "1-2" as separate objects.'
        )
    elif span_keys == ["1-2", "3-12"]:
        span_rule = (
            '"1-2" → use for moves explicitly targeting grade 2 students. '
            '"3-12" → use for moves explicitly targeting grade 3 students. '
            'If the framework presents a move as spanning grades 2–3 without distinguishing '
            'between them, include it under both "1-2" and "3-12" as separate objects.'
        )
    else:
        span_rule = span_notes

    return textwrap.dedent(f"""\
You are extracting structured instructional data from the California ELA/ELD Framework,
Chapter {chapter} ({title}), published by the California Department of Education.
Your goal is to produce a single valid JSON object.

---
## SCHEMA (exact field names and allowed values are mandatory)

{{
  "_meta": {{
    "source": string,
    "source_url": "{source_url}",
    "coverage": string[],
    "scope_note": string (optional)
  }},
  "writing_moves": {{
    // Keys: only {span_key_str}
    // (Chapter {chapter} covers {grade_range} only)
{_indent(4, _span_schema(span_keys))}
  }}
}}

Each `Move` object:
{{
  "theme": one of exactly: "meaning_making" | "language_development" |
           "effective_expression" | "content_knowledge" | "foundational_skills",
  "eld_mode": one of exactly: "integrated" | "designated",
  "move": string — the actionable teaching move, written so a teacher can adapt it
          to a specific student artifact tomorrow,
  "language_target": string (optional) — a specific phoneme, sentence frame,
          connective, vocabulary item, or grammatical structure,
  "framework_anchor": string — the chapter section, theme, strand, or vignette
          title this move comes from,
  "source_section": string (optional) — a page number or section header,
  "grade_band": "{grade_band}",
  "source_chapter": {chapter}
}}

---
## LEVEL KEY
ELPAC levels 1–4 map to CA ELD proficiency levels as follows. Use this to
decide which level key ("1", "2", "3", "4") each move belongs under:
- Level 1 = Minimally Developed / Emerging
- Level 2 = Somewhat Developed / low-to-mid Expanding
- Level 3 = Moderately Developed / upper Expanding through lower Bridging
- Level 4 = Well Developed / upper Bridging

Place a move under the level of the *student it serves*, not the complexity of
the move itself. A move targeting a student who writes only a few letters
belongs under Level 1.

---
## SPAN KEY
{span_rule}

---
## WHAT TO EXTRACT
Extract instructional moves from ALL of the following sources in the chapter:
1. **Snapshots of practice** — each snapshot contains at least one concrete
   teacher action. Extract the core move (not the surrounding narrative).
2. **Vignettes** — longer classroom examples. Extract each distinct instructional
   move the teacher makes. One vignette may yield 3–8 moves.
3. **Key Themes guidance sections** — the five themes (Meaning Making, Language
   Development, Effective Expression, Content Knowledge, Foundational Skills)
   contain pedagogical guidance. Extract any passage that reads as "teachers
   should / can / do X" as a move.
4. **Integrated vs. Designated ELD guidance** — mark eld_mode accordingly.

---
## WHAT NOT TO EXTRACT
- Assessment descriptions (what a student does on a test)
- Policy rationale or research citations
- Descriptions of student behavior only (with no corresponding teacher action)
- Moves that belong to a different domain (listening, speaking, reading) unless
  the move clearly includes writing as well.

---
## QUALITY RULES FOR "move" TEXT
- Write it as a teacher action, not a framework paraphrase.
  Good: "During shared writing, dictate a sentence slowly while pointing to
        each word, then invite the student to re-read pointing left to right."
  Bad: "Teachers support foundational literacy through shared writing."
- The move must be specific enough that a teacher can do it with a student's
  actual paper in hand.
- Do not duplicate moves. If the same move appears in a snapshot and a vignette,
  include it once with the more specific source_section.
- Aim for exhaustive coverage. A thorough extraction of this chapter should
  yield roughly 20–40 moves.

---
## SOURCE TEXT (sliced chapter content)

{slices_text}
""")


def _span_schema(span_keys: list[str]) -> str:
    levels = '{ "1"?: Move[], "2"?: Move[], "3"?: Move[], "4"?: Move[] }'
    lines = [f'"{k}"?: {levels}' for k in span_keys]
    return "\n".join(lines)


def _indent(n: int, text: str) -> str:
    pad = " " * n
    return "\n".join(pad + line for line in text.splitlines())


# ---------------------------------------------------------------------------
# Validation helpers
# ---------------------------------------------------------------------------
VALID_THEMES  = {"meaning_making", "language_development", "effective_expression",
                  "content_knowledge", "foundational_skills"}
VALID_MODES   = {"integrated", "designated"}
VALID_LEVELS  = {"1", "2", "3", "4"}
REQUIRED_MOVE = {"theme", "eld_mode", "move", "framework_anchor", "grade_band",
                  "source_chapter"}

def validate(data: dict, cfg: dict) -> list[str]:
    """Return a list of validation errors (empty = all good)."""
    errors = []
    wm = data.get("writing_moves", {})
    allowed_spans = set(cfg["span_keys"])

    for span, levels in wm.items():
        if span not in allowed_spans:
            errors.append(f"Unexpected span key: {span!r}")
        for lvl, moves in levels.items():
            if lvl not in VALID_LEVELS:
                errors.append(f"Unexpected level key: {lvl!r} under {span!r}")
            for i, mv in enumerate(moves):
                tag = f"{span}/{lvl}[{i}]"
                missing = REQUIRED_MOVE - set(mv.keys())
                if missing:
                    errors.append(f"{tag} missing fields: {missing}")
                if mv.get("theme") not in VALID_THEMES:
                    errors.append(f"{tag} invalid theme: {mv.get('theme')!r}")
                if mv.get("eld_mode") not in VALID_MODES:
                    errors.append(f"{tag} invalid eld_mode: {mv.get('eld_mode')!r}")
                if mv.get("grade_band") != cfg["grade_band"]:
                    errors.append(f"{tag} wrong grade_band: {mv.get('grade_band')!r}")
                if mv.get("source_chapter") != cfg["chapter"]:
                    errors.append(f"{tag} wrong source_chapter: {mv.get('source_chapter')!r}")
    return errors


# ---------------------------------------------------------------------------
# API call
# ---------------------------------------------------------------------------
def call_api(user_prompt: str, model: str) -> str:
    key = os.environ.get("ANTHROPIC_API_KEY", "")
    if not key:
        sys.exit("ANTHROPIC_API_KEY is not set (check .env.local)")

    client = anthropic.Anthropic(api_key=key)
    print(f"[extract] Calling {model}…", flush=True)

    message = client.messages.create(
        model=model,
        max_tokens=16384,
        system=SYSTEM_PROMPT,
        messages=[{"role": "user", "content": user_prompt}],
    )

    usage = message.usage
    print(
        f"[extract]   tokens in={usage.input_tokens:,}  out={usage.output_tokens:,}",
        flush=True,
    )
    return message.content[0].text


# ---------------------------------------------------------------------------
# JSON extraction (model may occasionally wrap in a code fence)
# ---------------------------------------------------------------------------
def extract_json(raw: str) -> dict:
    # strip markdown fences if present
    clean = re.sub(r"^```(?:json)?\s*", "", raw.strip(), flags=re.MULTILINE)
    clean = re.sub(r"\s*```$", "", clean.strip(), flags=re.MULTILINE)
    try:
        return json.loads(clean)
    except json.JSONDecodeError as e:
        sys.exit(f"[extract] JSON parse error: {e}\n\nRaw output:\n{raw[:2000]}")


# ---------------------------------------------------------------------------
# Entry point
# ---------------------------------------------------------------------------
def main():
    args = sys.argv[1:]
    if len(args) < 2 or args[0] in ("-h", "--help"):
        print(__doc__)
        sys.exit(0)

    slices_path = pathlib.Path(args[0])
    chapter_num = int(args[1])

    out_path   = None
    model      = "claude-haiku-4-5"
    dry_run    = False

    i = 2
    while i < len(args):
        if args[i] == "--out" and i + 1 < len(args):
            out_path = pathlib.Path(args[i + 1]); i += 2
        elif args[i] == "--model" and i + 1 < len(args):
            model = args[i + 1]; i += 2
        elif args[i] == "--dry-run":
            dry_run = True; i += 1
        else:
            sys.exit(f"Unknown argument: {args[i]}")

    # Load chapter config
    cfg_path = pathlib.Path(__file__).resolve().parent / "chapter_configs.json"
    cfg_all  = json.loads(cfg_path.read_text())
    cfg = cfg_all.get(str(chapter_num))
    if cfg is None:
        sys.exit(f"No config found for chapter {chapter_num} in {cfg_path}")

    # Default output path
    if out_path is None:
        out_path = (
            pathlib.Path(__file__).resolve().parent.parent
            / "data" / "framework" / f"ch{chapter_num}.json"
        )
    out_path.parent.mkdir(parents=True, exist_ok=True)

    # Load slices
    if not slices_path.exists():
        sys.exit(f"Slices file not found: {slices_path}")
    slices_text = slices_path.read_text(encoding="utf-8")
    print(f"[extract] Slices: {len(slices_text):,} chars", flush=True)

    # Build prompt
    user_prompt = build_user_prompt(cfg, slices_text)
    print(
        f"[extract] Prompt: ~{len(user_prompt) // 4:,} tokens estimated",
        flush=True,
    )

    if dry_run:
        print("\n=== DRY RUN — PROMPT (first 3000 chars) ===\n")
        print(user_prompt[:3000])
        return

    # Call API
    raw = call_api(user_prompt, model)

    # Parse and validate
    data = extract_json(raw)
    errors = validate(data, cfg)

    if errors:
        print(f"[extract] WARNING — {len(errors)} validation issue(s):", flush=True)
        for e in errors:
            print(f"  • {e}", flush=True)
    else:
        print("[extract] Validation passed ✓", flush=True)

    # Count moves
    wm = data.get("writing_moves", {})
    total = sum(
        len(moves)
        for levels in wm.values()
        for moves in levels.values()
    )
    print(f"[extract] {total} moves extracted across {len(wm)} span(s)", flush=True)

    # Write output
    out_path.write_text(json.dumps(data, indent=2, ensure_ascii=False), encoding="utf-8")
    print(f"[extract] Written → {out_path}", flush=True)


if __name__ == "__main__":
    main()

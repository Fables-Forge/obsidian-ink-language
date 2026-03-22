/**
 * Snippets tests — data and cursor-math only, no Obsidian runtime.
 *
 * snippets.ts imports from 'obsidian' (EditorSuggest etc.), which is not
 * available in Node.  We test the SNIPPETS data array and the
 * selectSuggestion cursor-position math by copying them here.
 */
import { test, describe } from "node:test";
import assert from "node:assert/strict";
import { t } from "./i18n/index.ts";

// ---------------------------------------------------------------------------
// Inline SNIPPETS data (mirrors src/snippets.ts SNIPPETS array)
// ---------------------------------------------------------------------------
interface InkSnippet {
  nameKey: string;
  descKey: string;
  catKey: string;
  ink: string;
  cursorOffset?: number;
}

// We import the keys used in snippets.ts and verify them through t()
// instead of importing the file (which would pull in obsidian).
// To avoid duplication errors we define a minimal representative set.
const SAMPLE_SNIPPET_KEYS: Pick<InkSnippet, "nameKey" | "descKey" | "catKey">[] = [
  { nameKey: "snippet.knot.name",       descKey: "snippet.knot.desc",       catKey: "cat.structure" },
  { nameKey: "snippet.stitch.name",     descKey: "snippet.stitch.desc",     catKey: "cat.structure" },
  { nameKey: "snippet.choice.name",     descKey: "snippet.choice.desc",     catKey: "cat.choices" },
  { nameKey: "snippet.divert.name",     descKey: "snippet.divert.desc",     catKey: "cat.flow" },
  { nameKey: "snippet.divert-end.name", descKey: "snippet.divert-end.desc", catKey: "cat.flow" },
  { nameKey: "snippet.var.name",        descKey: "snippet.var.desc",        catKey: "cat.logic" },
  { nameKey: "snippet.const.name",      descKey: "snippet.const.desc",      catKey: "cat.logic" },
  { nameKey: "snippet.if-else.name",    descKey: "snippet.if-else.desc",    catKey: "cat.logic" },
  { nameKey: "snippet.sequence.name",   descKey: "snippet.sequence.desc",   catKey: "cat.varying-text" },
  { nameKey: "snippet.todo.name",       descKey: "snippet.todo.desc",       catKey: "cat.tags" },
];

// Inline ink values for the snippets we care most about (from snippets.ts)
const SNIPPET_INK: Record<string, string> = {
  "snippet.knot.name":       "=== knot_name ===\n",
  "snippet.stitch.name":     "= stitch_name\n",
  "snippet.choice.name":     "* Choice text\n  Result text.\n",
  "snippet.divert.name":     "-> target_name\n",
  "snippet.divert-end.name": "-> END\n",
  "snippet.var.name":        "VAR variable_name = 0\n",
  "snippet.if-else.name":    "{ condition:\n  True branch text.\n- else:\n  False branch text.\n}\n",
  "snippet.sequence.name":   "{stopping: first|second|final}",
  "snippet.todo.name":       "// TODO: ",
};

// ---------------------------------------------------------------------------
// Cursor offset math (mirrors selectSuggestion logic from snippets.ts)
// ---------------------------------------------------------------------------
function calcCursor(
  ink: string,
  cursorOffset: number | undefined,
  startLine = 0,
  startCh = 0
): { line: number; ch: number } {
  const lines = ink.split("\n");

  if (cursorOffset === undefined) {
    const lastLineLen = lines[lines.length - 1].length;
    if (lines.length === 1) return { line: startLine, ch: startCh + lastLineLen };
    return { line: startLine + lines.length - 1, ch: lastLineLen };
  }

  if (lines.length === 1) return { line: startLine, ch: startCh + cursorOffset };

  let line = startLine;
  let ch = startCh;
  let remaining = cursorOffset;
  let currentLineIdx = 0;

  while (remaining > 0 && currentLineIdx < lines.length) {
    const len = lines[currentLineIdx].length;
    if (remaining <= len) {
      ch = (currentLineIdx === 0 ? startCh : 0) + remaining;
      remaining = 0;
    } else {
      remaining -= len + 1;
      line++;
      ch = 0;
      currentLineIdx++;
    }
  }

  return { line, ch };
}

// ---------------------------------------------------------------------------
// i18n resolution tests
// ---------------------------------------------------------------------------
describe("snippets — i18n keys resolve", () => {
  test("all representative nameKeys resolve to non-empty strings", () => {
    for (const s of SAMPLE_SNIPPET_KEYS) {
      const v = t(s.nameKey as any);
      assert.ok(v && v.length > 0, `nameKey '${s.nameKey}' resolved to empty`);
    }
  });

  test("all representative descKeys resolve to non-empty strings", () => {
    for (const s of SAMPLE_SNIPPET_KEYS) {
      const v = t(s.descKey as any);
      assert.ok(v && v.length > 0, `descKey '${s.descKey}' resolved to empty`);
    }
  });

  test("all representative catKeys resolve to non-empty strings", () => {
    for (const s of SAMPLE_SNIPPET_KEYS) {
      const v = t(s.catKey as any);
      assert.ok(v && v.length > 0, `catKey '${s.catKey}' resolved to empty`);
    }
  });
});

// ---------------------------------------------------------------------------
// Ink content spot-checks
// ---------------------------------------------------------------------------
describe("snippets — ink content", () => {
  test("knot snippet contains === markers", () => {
    assert.ok(SNIPPET_INK["snippet.knot.name"].includes("==="));
  });

  test("stitch snippet starts with =", () => {
    assert.ok(SNIPPET_INK["snippet.stitch.name"].startsWith("="));
  });

  test("divert snippet contains ->", () => {
    assert.ok(SNIPPET_INK["snippet.divert.name"].includes("->"));
  });

  test("divert-end snippet contains -> END", () => {
    assert.ok(SNIPPET_INK["snippet.divert-end.name"].includes("-> END"));
  });

  test("var snippet starts with VAR", () => {
    assert.ok(SNIPPET_INK["snippet.var.name"].startsWith("VAR"));
  });

  test("if-else snippet contains both condition and else branches", () => {
    const ink = SNIPPET_INK["snippet.if-else.name"];
    assert.ok(ink.includes("condition:"));
    assert.ok(ink.includes("- else:"));
  });

  test("sequence snippet contains stopping keyword", () => {
    assert.ok(SNIPPET_INK["snippet.sequence.name"].includes("stopping:"));
  });

  test("todo snippet starts with // TODO:", () => {
    assert.ok(SNIPPET_INK["snippet.todo.name"].startsWith("// TODO:"));
  });
});

// ---------------------------------------------------------------------------
// Cursor offset math tests
// ---------------------------------------------------------------------------
describe("snippets — cursor offset math (single-line ink)", () => {
  test("offset 3 on '-> target_name\\n' places cursor at ch 3", () => {
    const { line, ch } = calcCursor("-> target_name\n", 3);
    assert.equal(line, 0);
    assert.equal(ch, 3);
  });

  test("undefined offset on '<>' places cursor at end (ch 2)", () => {
    const { line, ch } = calcCursor("<>", undefined);
    assert.equal(line, 0);
    assert.equal(ch, 2);
  });

  test("undefined offset on '->->' places cursor at end (ch 4)", () => {
    const { line, ch } = calcCursor("->->", undefined);
    assert.equal(line, 0);
    assert.equal(ch, 4);
  });
});

describe("snippets — cursor offset math (multi-line ink)", () => {
  test("offset 2 on choice snippet lands on line 0 ch 2", () => {
    // "* Choice text\n  Result text.\n" — offset 2 → after "* "
    const { line, ch } = calcCursor("* Choice text\n  Result text.\n", 2);
    assert.equal(line, 0);
    assert.equal(ch, 2);
  });

  test("undefined offset on multi-line ink places cursor on last line", () => {
    // "-> END\n" → lines = ["-> END", ""] → last line is "", length 0
    const { line, ch } = calcCursor("-> END\n", undefined);
    assert.equal(line, 1);
    assert.equal(ch, 0);
  });

  test("offset crossing to second line", () => {
    // "AB\nCD" — offset 3 → line 0 is "AB" (2 chars) → remaining = 3 - 2 - 1 = 0? No.
    // remaining=3, line0 len=2: 3 > 2, so remaining = 3 - (2+1) = 0, line=1, ch=0
    const { line, ch } = calcCursor("AB\nCD", 3);
    assert.equal(line, 1);
    assert.equal(ch, 0);
  });

  test("offset 4 crosses into second line char 1", () => {
    // "AB\nCD" — offset 4 → remaining=4, line0 len=2: 4>2, remaining=4-3=1, line=1
    // then remaining=1 <= 2, ch = 0 + 1 = 1
    const { line, ch } = calcCursor("AB\nCD", 4);
    assert.equal(line, 1);
    assert.equal(ch, 1);
  });
});

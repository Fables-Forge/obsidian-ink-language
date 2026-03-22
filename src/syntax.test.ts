/**
 * Syntax highlighting tests — rule logic only, no CodeMirror runtime.
 *
 * Because syntax.ts imports from @codemirror/view (a browser-only package),
 * we cannot import it directly in Node tests.  Instead we re-declare the
 * minimal RULES structure here and run the same rule-application + overlap-
 * resolution algorithm, then assert on the class names that would be applied.
 */
import { test, describe } from "node:test";
import assert from "node:assert/strict";

// ---------------------------------------------------------------------------
// Minimal rule engine (mirrors syntax.ts RULES/handler/resolveSegments)
// ---------------------------------------------------------------------------

interface Token { from: number; to: number; className: string; priority: number; }

// Inline RULES copied verbatim from syntax.ts (no CM6 imports needed here)
const RULES: { regex: RegExp; handler: (m: RegExpExecArray, from: number) => Token[] }[] = [
  // Knot header: === name ===
  {
    regex: /^\s*(={2,}\s*)(\w+)(\s*={0,}\s*$)/,
    handler: (m, from) => {
      const start = from + m.index!;
      const t1 = { from: start + m[0].indexOf(m[1]), to: start + m[0].indexOf(m[1]) + m[1].length, className: "ink-knot-marker", priority: 0 };
      const t2 = { from: start + m[0].indexOf(m[2]), to: start + m[0].indexOf(m[2]) + m[2].length, className: "ink-knot-name", priority: 1 };
      const t3 = { from: start + m[0].lastIndexOf(m[3]), to: start + m[0].lastIndexOf(m[3]) + m[3].length, className: "ink-knot-marker", priority: 0 };
      return [t1, t2, t3].filter(t => t.to > t.from);
    }
  },
  // Function: === function name(params) ===
  {
    regex: /^\s*={2,}\s*(function\s+)(\w+)(\(.*\))?/,
    handler: (m, from) => {
      const start = from + m.index!;
      const tokens: Token[] = [];
      let pos = start + m[0].indexOf(m[1]);
      tokens.push({ from: pos, to: pos + m[1].length, className: "ink-keyword", priority: 1 });
      pos = start + m[0].indexOf(m[2], m[0].indexOf(m[1]) + m[1].length);
      tokens.push({ from: pos, to: pos + m[2].length, className: "ink-fn-name", priority: 1 });
      if (m[3]) {
        pos = start + m[0].indexOf(m[3], m[0].indexOf(m[2]) + m[2].length);
        tokens.push({ from: pos, to: pos + m[3].length, className: "ink-params", priority: 0 });
      }
      return tokens;
    }
  },
  // Stitch: = name
  {
    regex: /^\s*(=\s+)(\w+)/,
    handler: (m, from) => {
      const start = from + m.index!;
      const tokens: Token[] = [];
      let pos = start + m[0].indexOf(m[1]);
      tokens.push({ from: pos, to: pos + m[1].length, className: "ink-stitch-marker", priority: 0 });
      pos = start + m[0].indexOf(m[2], m[0].indexOf(m[1]));
      tokens.push({ from: pos, to: pos + m[2].length, className: "ink-stitch-name", priority: 1 });
      return tokens;
    }
  },
  // Choice bullets
  {
    regex: /^\s*(\*+|\+\+?)(\s*)/,
    handler: (m, from) => {
      const start = from + m.index! + m[0].indexOf(m[1]);
      return [{ from: start, to: start + m[1].length, className: "ink-choice-bullet", priority: 0 }];
    }
  },
  // Divert arrow
  {
    regex: /(->\\s*)/g,
    handler: (m, from) => [{ from: from + m.index!, to: from + m.index! + m[1].length, className: "ink-divert-arrow", priority: 0 }]
  },
  // Divert target
  {
    regex: /(->\\s*)([\\w.]+|END|DONE)/g,
    handler: (m, from) => {
      const start = from + m.index!;
      return [{ from: start + m[1].length, to: start + m[1].length + m[2].length, className: "ink-divert-target", priority: 1 }];
    }
  },
  // Tunnel
  {
    regex: /(->->)/g,
    handler: (m, from) => [{ from: from + m.index!, to: from + m.index! + m[0].length, className: "ink-tunnel", priority: 2 }]
  },
  // Thread
  {
    regex: /(<-\s*)([\w.]+)/g,
    handler: (m, from) => {
      const start = from + m.index!;
      return [
        { from: start, to: start + m[1].length, className: "ink-thread-arrow", priority: 0 },
        { from: start + m[1].length, to: start + m[1].length + m[2].length, className: "ink-thread-target", priority: 1 }
      ];
    }
  },
  // Glue
  {
    regex: /<>/g,
    handler: (m, from) => [{ from: from + m.index!, to: from + m.index! + m[0].length, className: "ink-glue", priority: 1 }]
  },
  // Keywords
  {
    regex: /^\s*(VAR|CONST|TEMP|INCLUDE|EXTERNAL|LIST)\b/g,
    handler: (m, from) => {
      const start = from + m.index! + m[0].indexOf(m[1]);
      return [{ from: start, to: start + m[1].length, className: "ink-keyword", priority: 1 }];
    }
  },
  // Variable name in declaration
  {
    regex: /(VAR|CONST|TEMP)\s+(\w+)/g,
    handler: (m, from) => {
      const start = from + m.index!;
      const kwLen = m[0].indexOf(m[2]);
      return [{ from: start + kwLen, to: start + kwLen + m[2].length, className: "ink-variable", priority: 1 }];
    }
  },
  // Tilde
  {
    regex: /^\s*(~)/,
    handler: (m, from) => {
      const start = from + m.index! + m[0].indexOf(m[1]);
      return [{ from: start, to: start + m[1].length, className: "ink-tilde", priority: 0 }];
    }
  },
  // Logic braces
  {
    regex: /\{[^}]*\}/g,
    handler: (m, from) => [{ from: from + m.index!, to: from + m.index! + m[0].length, className: "ink-logic", priority: 0 }]
  },
  // String literals
  {
    regex: /"[^"]*"/g,
    handler: (m, from) => [{ from: from + m.index!, to: from + m.index! + m[0].length, className: "ink-string", priority: 2 }]
  },
  // Tags
  {
    regex: /#\s*[^\n#]+/g,
    handler: (m, from) => [{ from: from + m.index!, to: from + m.index! + m[0].length, className: "ink-tag", priority: 1 }]
  },
  // Line comments
  {
    regex: /(\/\/.*)/g,
    handler: (m, from) => [{ from: from + m.index!, to: from + m.index! + m[0].length, className: "ink-comment", priority: 3 }]
  },
  // TODO
  {
    regex: /\/\/\s*TODO\b.*/g,
    handler: (m, from) => [{ from: from + m.index!, to: from + m.index! + m[0].length, className: "ink-todo", priority: 4 }]
  },
  // INCLUDE path
  {
    regex: /INCLUDE\s+([^\n]+)/g,
    handler: (m, from) => {
      const start = from + m.index! + m[0].indexOf(m[1]);
      return [{ from: start, to: start + m[1].length, className: "ink-include-path", priority: 1 }];
    }
  }
];

function collectTokens(text: string, from = 0): Token[] {
  const tokens: Token[] = [];
  for (const rule of RULES) {
    if (rule.regex.global) rule.regex.lastIndex = 0;
    let match;
    if (rule.regex.global) {
      while ((match = rule.regex.exec(text)) !== null) tokens.push(...rule.handler(match, from));
    } else {
      match = rule.regex.exec(text);
      if (match) tokens.push(...rule.handler(match, from));
    }
  }
  return tokens;
}

function resolveSegments(tokens: Token[]): { from: number; to: number; cls: string }[] {
  tokens.sort((a, b) => a.from - b.from || a.priority - b.priority);
  const points = new Set<number>();
  for (const t of tokens) { points.add(t.from); points.add(t.to); }
  const sorted = Array.from(points).sort((a, b) => a - b);
  const result: { from: number; to: number; cls: string }[] = [];
  for (let i = 0; i < sorted.length - 1; i++) {
    const start = sorted[i];
    const end = sorted[i + 1];
    let best: Token | null = null;
    for (const t of tokens) {
      if (t.from <= start && t.to >= end) {
        if (!best || t.priority > best.priority ||
            (t.priority === best.priority && (t.to - t.from) < (best.to - best.from))) {
          best = t;
        }
      }
    }
    if (best) result.push({ from: start, to: end, cls: best.className });
  }
  return result;
}

function hasClass(tokens: Token[], cls: string) { return tokens.some(t => t.className === cls); }

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("syntax — knot header tokens", () => {
  test("=== knotName === produces ink-knot-marker and ink-knot-name", () => {
    const tokens = collectTokens("=== knotName ===");
    assert.ok(hasClass(tokens, "ink-knot-marker"), "should have knot marker");
    assert.ok(hasClass(tokens, "ink-knot-name"), "should have knot name");
  });

  test("== minimal produces knot name token", () => {
    const tokens = collectTokens("== minimal");
    assert.ok(hasClass(tokens, "ink-knot-name"));
  });
});

describe("syntax — stitch tokens", () => {
  test("= stitchName produces marker and name tokens", () => {
    const tokens = collectTokens("= stitchName");
    assert.ok(hasClass(tokens, "ink-stitch-marker"));
    assert.ok(hasClass(tokens, "ink-stitch-name"));
  });
});

describe("syntax — choice bullet tokens", () => {
  test("* produces ink-choice-bullet", () => {
    assert.ok(hasClass(collectTokens("* Choice text"), "ink-choice-bullet"));
  });

  test("+ produces ink-choice-bullet", () => {
    assert.ok(hasClass(collectTokens("+ Sticky"), "ink-choice-bullet"));
  });

  test("** produces ink-choice-bullet", () => {
    assert.ok(hasClass(collectTokens("** deeper"), "ink-choice-bullet"));
  });
});

describe("syntax — tunnel token", () => {
  test("->-> produces ink-tunnel", () => {
    assert.ok(hasClass(collectTokens("->->"), "ink-tunnel"));
  });
});

describe("syntax — thread tokens", () => {
  test("<- thread produces ink-thread-arrow and ink-thread-target", () => {
    const tokens = collectTokens("<- threadName");
    assert.ok(hasClass(tokens, "ink-thread-arrow"));
    assert.ok(hasClass(tokens, "ink-thread-target"));
  });
});

describe("syntax — keywords", () => {
  test("VAR keyword produces ink-keyword token", () => {
    assert.ok(hasClass(collectTokens("VAR x = 0"), "ink-keyword"));
  });

  test("CONST keyword produces ink-keyword token", () => {
    assert.ok(hasClass(collectTokens("CONST MAX = 100"), "ink-keyword"));
  });

  test("VAR declaration name produces ink-variable", () => {
    assert.ok(hasClass(collectTokens("VAR score = 0"), "ink-variable"));
  });

  test("~ tilde produces ink-tilde", () => {
    assert.ok(hasClass(collectTokens("~ score = 1"), "ink-tilde"));
  });
});

describe("syntax — comments and TODO", () => {
  test("// comment produces ink-comment", () => {
    assert.ok(hasClass(collectTokens("// a comment"), "ink-comment"));
  });

  test("// TODO produces ink-todo token", () => {
    assert.ok(hasClass(collectTokens("// TODO: fix this"), "ink-todo"));
  });
});

describe("syntax — tags and strings", () => {
  test("# tag produces ink-tag", () => {
    assert.ok(hasClass(collectTokens("Some text # speaker"), "ink-tag"));
  });

  test("\"string\" produces ink-string", () => {
    assert.ok(hasClass(collectTokens('~ x = "hello"'), "ink-string"));
  });
});

describe("syntax — overlap resolution", () => {
  test("ink-todo (priority 4) beats ink-comment (priority 3) for same range", () => {
    const tokens = collectTokens("// TODO: fix");
    const segs = resolveSegments(tokens);
    assert.ok(segs.some(s => s.cls === "ink-todo"), "ink-todo should appear");
    assert.ok(!segs.some(s => s.cls === "ink-comment"), "ink-comment should be overridden");
  });

  test("ink-knot-name (priority 1) beats ink-knot-marker (priority 0) for name segment", () => {
    const tokens = collectTokens("=== knotName ===");
    const segs = resolveSegments(tokens);
    const nameStart = "=== ".length;
    const nameEnd = nameStart + "knotName".length;
    const covered = segs.filter(s => s.from >= nameStart && s.to <= nameEnd);
    assert.ok(covered.length > 0, "should have segments for name region");
    assert.ok(covered.every(s => s.cls === "ink-knot-name"), "name region should be ink-knot-name");
  });
});

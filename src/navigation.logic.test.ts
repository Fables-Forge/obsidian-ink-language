import { test, describe } from "node:test";
import assert from "node:assert/strict";
import { findDefinition } from "./navigation.logic.ts";

// Minimal ink document simulating the drinkfromcup scenario from The Intercept
const interceptSnippet = [
  // 0
  "== drinking",
  // 1
  "You enter the room.",
  // 2
  "= setup",
  // 3
  "VAR teacup = false",
  // 4
  "- (drinkit) \"Now drink your tea and talk.\"",
  // 5
  " * { teacup }   [Drink]   -> drinkfromcup",
  // 6
  " * { teacup }   [Put the cup down]",
  // 7
  "       I set the cup carefully down.",
  // 8
  "       -> whatsinit",
  // 9
  " * { not teacup }  [Take the cup]",
  // 10
  "       - - (drinkfromcup) I lift the cup to my lips.",
];

describe("findDefinition — named gather label (drinkfromcup)", () => {
  test("finds drinkfromcup when clicking on it in a divert line", () => {
    // Click is on line 5: "-> drinkfromcup"
    const result = findDefinition(interceptSnippet, "drinkfromcup", 5);
    assert.equal(result, 10);
  });

  test("finds drinkit label", () => {
    const result = findDefinition(interceptSnippet, "drinkit", 5);
    assert.equal(result, 4);
  });
});

describe("findDefinition — knot navigation", () => {
  const doc = [
    "== knotA",        // 0
    "Some text.",      // 1
    "-> knotB",        // 2
    "== knotB",        // 3
    "More text.",      // 4
  ];

  test("finds knot by name", () => {
    assert.equal(findDefinition(doc, "knotB", 2), 3);
  });

  test("returns -1 for missing target", () => {
    assert.equal(findDefinition(doc, "knotC", 2), -1);
  });
});

describe("findDefinition — stitch navigation", () => {
  const doc = [
    "== myKnot",           // 0
    "= intro",             // 1
    "-> details",          // 2
    "= details",           // 3
    "Some details.",       // 4
    "== otherKnot",        // 5
    "= details",           // 6  (same stitch name, different knot)
    "Other details.",      // 7
  ];

  test("prefers local stitch over same-name stitch in other knot", () => {
    // Click inside myKnot → should find = details at line 3, not line 6
    assert.equal(findDefinition(doc, "details", 2), 3);
  });

  test("finds stitch in other knot when no local match", () => {
    // Click inside otherKnot, looking for "intro" which is only in myKnot
    assert.equal(findDefinition(doc, "intro", 7), 1);
  });
});

describe("findDefinition — explicit knot.stitch path", () => {
  const doc = [
    "== knotA",      // 0
    "= part1",       // 1
    "== knotB",      // 2
    "= part1",       // 3
  ];

  test("knotB.part1 resolves to line 3", () => {
    assert.equal(findDefinition(doc, "knotB.part1", 0), 3);
  });

  test("knotA.part1 resolves to line 1", () => {
    assert.equal(findDefinition(doc, "knotA.part1", 0), 1);
  });
});

describe("findDefinition — keywords ignored", () => {
  const doc = ["== VAR", "some text"];

  test("VAR keyword returns -1", () => {
    assert.equal(findDefinition(doc, "VAR", 1), -1);
  });

  test("END keyword returns -1", () => {
    assert.equal(findDefinition(doc, "END", 0), -1);
  });

  test("CONST keyword returns -1", () => {
    assert.equal(findDefinition(doc, "CONST", 0), -1);
  });

  test("TEMP keyword returns -1", () => {
    assert.equal(findDefinition(doc, "TEMP", 0), -1);
  });

  test("LIST keyword returns -1", () => {
    assert.equal(findDefinition(doc, "LIST", 0), -1);
  });

  test("EXTERNAL keyword returns -1", () => {
    assert.equal(findDefinition(doc, "EXTERNAL", 0), -1);
  });

  test("INCLUDE keyword returns -1", () => {
    assert.equal(findDefinition(doc, "INCLUDE", 0), -1);
  });

  test("function keyword returns -1", () => {
    assert.equal(findDefinition(doc, "function", 0), -1);
  });

  test("DONE keyword returns -1", () => {
    assert.equal(findDefinition(doc, "DONE", 0), -1);
  });
});

describe("findDefinition — var/const/external resolution", () => {
  const doc = [
    "VAR score = 0",         // 0
    "CONST MAX = 100",       // 1
    "EXTERNAL playSound()",  // 2
    "== start",              // 3
    "~ score = 5",           // 4
    "-> end",                // 5
    "== end",                // 6
  ];

  test("navigates to VAR declaration", () => {
    assert.equal(findDefinition(doc, "score", 4), 0);
  });

  test("navigates to CONST declaration", () => {
    assert.equal(findDefinition(doc, "MAX", 4), 1);
  });

  test("navigates to EXTERNAL declaration", () => {
    assert.equal(findDefinition(doc, "playSound", 4), 2);
  });
});

describe("findDefinition — function navigation", () => {
  const doc = [
    "== start",                           // 0
    "~ x = double(3)",                    // 1
    "== function double(n) ===",          // 2
    "~ return n * 2",                     // 3
  ];

  test("navigates to function definition", () => {
    assert.equal(findDefinition(doc, "double", 1), 2);
  });
});

describe("findDefinition — same-name label across knots", () => {
  const doc = [
    "== knotA",                 // 0
    "- (loop) Some text.",      // 1
    "-> loop",                  // 2
    "== knotB",                 // 3
    "- (loop) Other text.",     // 4
    "-> loop",                  // 5
  ];

  test("prefers local label when clicking inside knotA", () => {
    // Click on line 2 (inside knotA) → should find label at line 1
    assert.equal(findDefinition(doc, "loop", 2), 1);
  });

  test("prefers local label when clicking inside knotB", () => {
    // Click on line 5 (inside knotB) → should find label at line 4
    assert.equal(findDefinition(doc, "loop", 5), 4);
  });
});

describe("findDefinition — remote stitch first-match wins", () => {
  const doc = [
    "== knotA",          // 0
    "= intro",           // 1
    "== knotB",          // 2
    "= intro",           // 3
    "== knotC",          // 4
    "-> intro",          // 5  (no local stitch named intro)
  ];

  test("returns first occurrence when no local match", () => {
    // Click inside knotC, 'intro' is in both knotA (line 1) and knotB (line 3)
    // Should return the first one found (line 1)
    assert.equal(findDefinition(doc, "intro", 5), 1);
  });
});

describe("findDefinition — dotted path edge cases", () => {
  const doc = [
    "== knotA",    // 0
    "= part1",     // 1
    "== knotB",    // 2
    "= part1",     // 3
  ];

  test("nonexistent knot in dotted path returns -1", () => {
    assert.equal(findDefinition(doc, "knotZ.part1", 0), -1);
  });

  test("nonexistent stitch in existing knot returns -1", () => {
    assert.equal(findDefinition(doc, "knotA.missing", 0), -1);
  });
});

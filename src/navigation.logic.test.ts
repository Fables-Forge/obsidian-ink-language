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
});

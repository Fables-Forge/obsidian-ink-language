import { test, describe } from "node:test";
import assert from "node:assert/strict";
import { parseLine } from "./parser.ts";

describe("parseLine — knot", () => {
  test("== knotName", () => {
    const r = parseLine("== knotName", 0);
    assert.equal(r.type, "knot");
    assert.equal(r.name, "knotName");
  });

  test("=== knotName ===", () => {
    const r = parseLine("=== knotName ===", 0);
    assert.equal(r.type, "knot");
    assert.equal(r.name, "knotName");
  });

  test("== function not treated as knot", () => {
    const r = parseLine("== function myFn", 0);
    assert.equal(r.type, "function");
    assert.equal(r.name, "myFn");
  });
});

describe("parseLine — stitch", () => {
  test("= stitchName", () => {
    const r = parseLine("= stitchName", 0);
    assert.equal(r.type, "stitch");
    assert.equal(r.name, "stitchName");
  });
});

describe("parseLine — named gather / label", () => {
  test("- (drinkit)", () => {
    const r = parseLine("- (drinkit) some text", 0);
    assert.equal(r.type, "gather");
    assert.equal(r.name, "drinkit");
  });

  test("-- (nested)", () => {
    const r = parseLine("-- (nested) text", 0);
    assert.equal(r.type, "gather");
    assert.equal(r.name, "nested");
  });

  test("- - (drinkfromcup) with spaces between dashes", () => {
    const r = parseLine("		 		- - (drinkfromcup) I lift the cup", 0);
    assert.equal(r.type, "gather");
    assert.equal(r.name, "drinkfromcup");
  });

  test("--- (triple)", () => {
    const r = parseLine("--- (triple) text", 0);
    assert.equal(r.type, "gather");
    assert.equal(r.name, "triple");
  });
});

describe("parseLine — unnamed gather", () => {
  test("- plain gather has no name", () => {
    const r = parseLine("- plain text", 0);
    assert.equal(r.type, "gather");
    assert.equal(r.name, undefined);
  });
});

describe("parseLine — var/const", () => {
  test("VAR x = 0", () => {
    const r = parseLine("VAR x = 0", 0);
    assert.equal(r.type, "var");
  });

  test("CONST FOO = 1", () => {
    const r = parseLine("CONST FOO = 1", 0);
    assert.equal(r.type, "const");
  });
});

describe("parseLine — divert", () => {
  test("-> somewhere", () => {
    const r = parseLine("-> somewhere", 0);
    assert.equal(r.type, "divert");
  });
});

describe("parseLine — choice", () => {
  test("* choice text", () => {
    const r = parseLine("* choice text", 0);
    assert.equal(r.type, "choice");
  });
});

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

  test("** nested choice", () => {
    assert.equal(parseLine("** deeper", 0).type, "choice");
  });

  test("+ sticky choice", () => {
    assert.equal(parseLine("+ sticky", 0).type, "choice");
  });

  test("++ double sticky", () => {
    assert.equal(parseLine("++ double", 0).type, "choice");
  });
});

describe("parseLine — divert variants", () => {
  test("-> END", () => {
    assert.equal(parseLine("-> END", 0).type, "divert");
  });

  test("<- thread", () => {
    assert.equal(parseLine("<- threadName", 0).type, "divert");
  });

  test("->-> tunnel return", () => {
    // regex alternation (->|->->|<-): -> matches first, so ->-> still → divert
    assert.equal(parseLine("->->", 0).type, "divert");
  });
});

describe("parseLine — EXTERNAL", () => {
  test("EXTERNAL myFunc", () => {
    const r = parseLine("EXTERNAL myFunc", 0);
    assert.equal(r.type, "external");
    assert.equal(r.name, "myFunc");
  });

  test("  EXTERNAL myFunc (leading whitespace)", () => {
    const r = parseLine("  EXTERNAL myFunc", 0);
    assert.equal(r.type, "external");
    assert.equal(r.name, "myFunc");
  });

  test("EXTERNAL myFunc(a, b) — name is word before paren", () => {
    const r = parseLine("EXTERNAL myFunc(a, b)", 0);
    assert.equal(r.type, "external");
    assert.equal(r.name, "myFunc");
  });
});

describe("parseLine — INCLUDE", () => {
  test("INCLUDE other.ink", () => {
    const r = parseLine("INCLUDE other.ink", 0);
    assert.equal(r.type, "include");
    assert.equal(r.name, undefined);
  });

  test("  INCLUDE path/to/file.ink (leading whitespace)", () => {
    assert.equal(parseLine("  INCLUDE path/to/file.ink", 0).type, "include");
  });
});

describe("parseLine — TEMP and LIST", () => {
  test("TEMP myVar = 0", () => {
    assert.equal(parseLine("TEMP myVar = 0", 0).type, "temp");
  });

  test("LIST myList = a, b — loosely mapped to var", () => {
    // Intentional: LIST is mapped to "var" type in parser (see comment in source)
    assert.equal(parseLine("LIST myList = a, b", 0).type, "var");
  });
});

describe("parseLine — comment and TODO", () => {
  test("// regular comment", () => {
    assert.equal(parseLine("// regular comment", 0).type, "comment");
  });

  test("// TODO: something", () => {
    assert.equal(parseLine("// TODO: something", 0).type, "todo");
  });

  test("//TODO no space — still todo (regex allows \\s*)", () => {
    assert.equal(parseLine("//TODO no space", 0).type, "todo");
  });

  test("// TODOS plural — not todo (word boundary after TODO)", () => {
    assert.equal(parseLine("// TODOS: plural", 0).type, "comment");
  });
});

describe("parseLine — edge cases", () => {
  test("empty string → text", () => {
    assert.equal(parseLine("", 0).type, "text");
  });

  test("plain prose → text", () => {
    assert.equal(parseLine("She walked into the room.", 0).type, "text");
  });

  test("=name without space → text (stitch requires '= name' with space)", () => {
    // stitch regex: /^\s*(=\s+)(\w+)/ — space required after =
    // knot regex:   /^\s*(={2,}\s*)(\w+)/ — needs 2+ equals
    // so =name matches neither → text
    assert.equal(parseLine("=name", 0).type, "text");
  });
});

import { test, describe } from "node:test";
import assert from "node:assert/strict";
import { parseLine } from "./parser.ts";
import type { OutlineNode } from "./outline.ts";

/**
 * Pure re-implementation of InkOutlineView.parse() for testing,
 * mirroring the logic in outline.ts exactly.
 */
function parseOutline(text: string): OutlineNode[] {
  const lines = text.split("\n");
  const roots: OutlineNode[] = [];
  let lastKnot: OutlineNode | null = null;

  lines.forEach((lineContent, i) => {
    const parsed = parseLine(lineContent, i);

    if (parsed.type === "knot" && parsed.name) {
      const node: OutlineNode = { type: "knot", name: parsed.name, line: i, children: [] };
      roots.push(node);
      lastKnot = node;
    } else if (parsed.type === "function" && parsed.name) {
      const node: OutlineNode = { type: "function", name: parsed.name, line: i, children: [] };
      roots.push(node);
      lastKnot = null;
    } else if (parsed.type === "stitch" && parsed.name) {
      const node: OutlineNode = { type: "stitch", name: parsed.name, line: i, children: [] };
      if (lastKnot) {
        lastKnot.children.push(node);
      } else {
        roots.push(node);
      }
    } else if (parsed.type === "external" && parsed.name) {
      const node: OutlineNode = { type: "external", name: parsed.name, line: i, children: [] };
      roots.push(node);
    }
  });

  return roots;
}

describe("parseOutline — knots", () => {
  test("single knot appears as root", () => {
    const nodes = parseOutline("== start ===\nSome text.");
    assert.equal(nodes.length, 1);
    assert.equal(nodes[0].type, "knot");
    assert.equal(nodes[0].name, "start");
    assert.equal(nodes[0].line, 0);
  });

  test("multiple knots produce multiple roots", () => {
    const nodes = parseOutline("== knotA\n== knotB\n== knotC");
    assert.equal(nodes.length, 3);
    assert.deepEqual(nodes.map(n => n.name), ["knotA", "knotB", "knotC"]);
  });
});

describe("parseOutline — stitches as children", () => {
  test("stitch becomes child of preceding knot", () => {
    const nodes = parseOutline("== myKnot\n= intro\n= details");
    assert.equal(nodes.length, 1);
    assert.equal(nodes[0].children.length, 2);
    assert.equal(nodes[0].children[0].name, "intro");
    assert.equal(nodes[0].children[1].name, "details");
  });

  test("stitches attach to correct parent knot", () => {
    const text = "== knotA\n= s1\n== knotB\n= s2";
    const nodes = parseOutline(text);
    assert.equal(nodes.length, 2);
    assert.equal(nodes[0].children[0].name, "s1");
    assert.equal(nodes[1].children[0].name, "s2");
  });

  test("orphan stitch (no preceding knot) becomes root", () => {
    const nodes = parseOutline("= orphan\nSome text.");
    assert.equal(nodes.length, 1);
    assert.equal(nodes[0].type, "stitch");
    assert.equal(nodes[0].name, "orphan");
  });
});

describe("parseOutline — functions", () => {
  test("function appears as root", () => {
    const nodes = parseOutline("== function double(n) ===\n~ return n * 2");
    assert.equal(nodes.length, 1);
    assert.equal(nodes[0].type, "function");
    assert.equal(nodes[0].name, "double");
  });

  test("function resets lastKnot so following stitch becomes orphan root", () => {
    const text = "== function myFn\n= orphanStitch";
    const nodes = parseOutline(text);
    assert.equal(nodes.length, 2);
    assert.equal(nodes[0].type, "function");
    assert.equal(nodes[1].type, "stitch");
    assert.equal(nodes[1].name, "orphanStitch");
  });
});

describe("parseOutline — externals", () => {
  test("EXTERNAL appears as root node", () => {
    const nodes = parseOutline("EXTERNAL playSound(name)");
    assert.equal(nodes.length, 1);
    assert.equal(nodes[0].type, "external");
    assert.equal(nodes[0].name, "playSound");
  });
});

describe("parseOutline — empty and non-structural lines", () => {
  test("plain text produces no nodes", () => {
    const nodes = parseOutline("Hello world.\nThis is narrative.\n");
    assert.equal(nodes.length, 0);
  });

  test("diverts and choices produce no nodes", () => {
    const nodes = parseOutline("-> somewhere\n* A choice\n+ Sticky");
    assert.equal(nodes.length, 0);
  });

  test("empty document produces empty array", () => {
    assert.deepEqual(parseOutline(""), []);
  });
});

describe("parseOutline — line numbers", () => {
  test("records correct line numbers", () => {
    const text = "Some prose.\n== knotA\nMore text.\n= stitch1\n== knotB";
    const nodes = parseOutline(text);
    assert.equal(nodes[0].line, 1); // knotA
    assert.equal(nodes[0].children[0].line, 3); // stitch1
    assert.equal(nodes[1].line, 4); // knotB
  });
});

import { parseLine } from "./parser.ts"; // .ts extension required for Node --experimental-strip-types test runner

/**
 * Given all document lines, find the 0-indexed line number of the definition
 * for `target`, resolved from `clickLineIndex`. Returns -1 if not found.
 */
export function findDefinition(
  lines: string[],
  target: string,
  clickLineIndex: number
): number {
  // Ignore keywords
  if (/^(VAR|CONST|TEMP|LIST|EXTERNAL|INCLUDE|function|END|DONE)$/.test(target))
    return -1;

  // Determine context knot at click position
  let contextKnot = "";
  for (let i = clickLineIndex - 1; i >= 0; i--) {
    const parsed = parseLine(lines[i], i);
    if ((parsed.type === "knot" || parsed.type === "function") && parsed.name) {
      contextKnot = parsed.name;
      break;
    }
  }

  // Handle "knot.stitch" paths
  const parts = target.split(".");
  const searchKnot = parts.length > 1 ? parts[0] : null;
  const searchName = parts.length > 1 ? parts[1] : target;

  // Priorities (lower = better):
  // 0 — exact global (knot/function/var/const/external) OR local stitch/label in same context
  // 1 — named gather/label in other context
  // 2 — stitch in other context
  let bestLine = -1;
  let bestPriority = 999;
  let currentScanKnot = "";

  for (let i = 0; i < lines.length; i++) {
    const parsed = parseLine(lines[i], i);

    if (parsed.type === "knot")    currentScanKnot = parsed.name || "";
    if (parsed.type === "function") currentScanKnot = parsed.name || "";

    if (!parsed.name) continue;

    // --- Explicit path "knot.stitch" ---
    if (searchKnot) {
      if (
        currentScanKnot === searchKnot &&
        parsed.type === "stitch" &&
        parsed.name === searchName
      ) {
        return i; // exact path match
      }
      continue;
    }

    // --- Simple name ---

    // Global definitions
    if (
      (parsed.type === "knot" ||
        parsed.type === "function" ||
        parsed.type === "var" ||
        parsed.type === "const" ||
        parsed.type === "external") &&
      parsed.name === searchName
    ) {
      return i; // highest priority, stop immediately
    }

    // Stitch
    if (parsed.type === "stitch" && parsed.name === searchName) {
      if (currentScanKnot === contextKnot) {
        return i; // local stitch, stop immediately
      }
      if (bestPriority > 2) {
        bestLine = i;
        bestPriority = 2;
      }
    }

    // Named gather / label
    if (parsed.type === "gather" && parsed.name === searchName) {
      const priority = currentScanKnot === contextKnot ? 0 : 1;
      if (priority < bestPriority) {
        bestLine = i;
        bestPriority = priority;
        if (priority === 0) return i; // local label, stop immediately
      }
    }
  }

  return bestLine;
}

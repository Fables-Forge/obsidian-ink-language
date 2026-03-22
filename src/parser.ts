export interface InkLine {
  type: "knot" | "stitch" | "function" | "external" | "choice" | "gather"
        | "divert" | "var" | "const" | "temp" | "include" | "comment"
        | "todo" | "text";
  name?: string;        // for knots, stitches, functions, externals, variables
  line: number;         // 0-indexed line number
  raw: string;          // original line text
}

export function parseLine(text: string, lineNumber: number): InkLine {
    const result: InkLine = { type: "text", line: lineNumber, raw: text };

    // Check comments first
    if (/^\s*\/\//.test(text)) {
        if (/^\s*\/\/\s*TODO\b/.test(text)) {
             result.type = "todo";
        } else {
             result.type = "comment";
        }
        return result;
    }

    // Knot w/ function: ^\s*={2,}\s*(function\s+)(\w+)
    const fnMatch = text.match(/^\s*={2,}\s*(function\s+)(\w+)/);
    if (fnMatch) {
        result.type = "function";
        result.name = fnMatch[2];
        return result;
    }

    // Knot: ^\s*(={2,}\s*)(\w+)
    const knotMatch = text.match(/^\s*(={2,}\s*)(\w+)/);
    if (knotMatch) {
        result.type = "knot";
        result.name = knotMatch[2];
        return result;
    }

    // Stitch: ^\s*(=\s+)(\w+)
    const stitchMatch = text.match(/^\s*(=\s+)(\w+)/);
    if (stitchMatch) {
        result.type = "stitch";
        result.name = stitchMatch[2];
        return result;
    }

    // External: ^\s*EXTERNAL\s+(\w+)
    const extMatch = text.match(/^\s*EXTERNAL\s+(\w+)/);
    if (extMatch) {
        result.type = "external";
        result.name = extMatch[1];
        return result;
    }

    // Include
    if (/^\s*INCLUDE\s+/.test(text)) {
        result.type = "include";
        return result;
    }

    // Var/Const/Temp/List
    if (/^\s*VAR\b/.test(text)) { result.type = "var"; return result; }
    if (/^\s*CONST\b/.test(text)) { result.type = "const"; return result; }
    if (/^\s*TEMP\b/.test(text)) { result.type = "temp"; return result; }
    if (/^\s*LIST\b/.test(text)) { result.type = "var"; return result; } // loosely mapping LIST to var for this purpose

    // Choice
    if (/^\s*(\*+|\+\+?)(\s*)/.test(text)) {
        result.type = "choice";
        return result;
    }

    // Named gather / label: - (name) or -- (name) or - - (name)
    const labelMatch = text.match(/^\s*(-\s*)+\((\w+)\)/);
    if (labelMatch) {
        result.type = "gather";
        result.name = labelMatch[2];
        return result;
    }

    // Gather (start of line)
    // - (space) ...
    if (/^\s*(-+)(\s+)/.test(text)) {
        result.type = "gather";
        return result;
    }

    // Divert / Tunnel / Thread
    if (/^\s*(->|->->|<-)/.test(text)) {
        result.type = "divert";
        return result;
    }

    return result;
}

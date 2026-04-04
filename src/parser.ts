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
    const fnMatch = text.match(/^\s*={2,}\s*(function\s+)([\p{L}\p{N}_]+)/u);
    if (fnMatch) {
        result.type = "function";
        result.name = fnMatch[2];
        return result;
    }

    // Knot: ^\s*(={2,}\s*)(\w+)
    const knotMatch = text.match(/^\s*(={2,}\s*)([\p{L}\p{N}_]+)/u);
    if (knotMatch) {
        result.type = "knot";
        result.name = knotMatch[2];
        return result;
    }

    // Stitch: ^\s*(=\s+)(\w+)
    const stitchMatch = text.match(/^\s*(=\s+)([\p{L}\p{N}_]+)/u);
    if (stitchMatch) {
        result.type = "stitch";
        result.name = stitchMatch[2];
        return result;
    }

    // External: ^\s*EXTERNAL\s+(\w+)
    const extMatch = text.match(/^\s*EXTERNAL\s+([\p{L}\p{N}_]+)/u);
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
    const varMatch = text.match(/^\s*VAR\s+([\p{L}\p{N}_]+)/u);
    if (varMatch) { result.type = "var"; result.name = varMatch[1]; return result; }
    const constMatch = text.match(/^\s*CONST\s+([\p{L}\p{N}_]+)/u);
    if (constMatch) { result.type = "const"; result.name = constMatch[1]; return result; }
    const tempMatch = text.match(/^\s*TEMP\s+([\p{L}\p{N}_]+)/u);
    if (tempMatch) { result.type = "temp"; result.name = tempMatch[1]; return result; }
    const listMatch = text.match(/^\s*LIST\s+([\p{L}\p{N}_]+)/u);
    if (listMatch) { result.type = "var"; result.name = listMatch[1]; return result; } // loosely mapping LIST to var for this purpose

    // Choice
    if (/^\s*(\*+|\+\+?)(\s*)/.test(text)) {
        result.type = "choice";
        return result;
    }

    // Named gather / label: - (name) or -- (name) or - - (name)
    const labelMatch = text.match(/^\s*(-\s*)+\(([\p{L}\p{N}_]+)\)/u);
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

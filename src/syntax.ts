import {
  Decoration,
  DecorationSet,
  EditorView,
  ViewPlugin,
  ViewUpdate,
} from "@codemirror/view";
import { RangeSetBuilder } from "@codemirror/state";

// Match definition
export interface InkToken {
  from: number;
  to: number;
  className: string;
  priority: number; // Higher is better
}

// Regex rules
// Priority:
// 0: General (Markers, Arrows)
// 1: Keywords, Variables, Types
// 2: Strings
// 3: Comments
// 4: TODO (inside comments)

export const RULES: { regex: RegExp; handler: (match: RegExpExecArray, from: number) => InkToken[] }[] = [
  // Knot header: === name ===
  {
    regex: /^\s*(={2,}\s*)(\w+)(\s*={0,}\s*$)/,
    handler: (m, from) => {
        const start = from + m.index;
        // m[1] = marker (pre)
        // m[2] = name
        // m[3] = marker (post)
        const t1 = { from: start + m[0].indexOf(m[1]), to: start + m[0].indexOf(m[1]) + m[1].length, className: "ink-knot-marker", priority: 0 };
        const t2 = { from: start + m[0].indexOf(m[2]), to: start + m[0].indexOf(m[2]) + m[2].length, className: "ink-knot-name", priority: 1 };
        // post marker might be empty or whitespace
        const t3 = { from: start + m[0].lastIndexOf(m[3]), to: start + m[0].lastIndexOf(m[3]) + m[3].length, className: "ink-knot-marker", priority: 0 };
        return [t1, t2, t3].filter(t => t.to > t.from);
    }
  },
  // Knot w/ function: === function name(params) ===
  {
    regex: /^\s*={2,}\s*(function\s+)(\w+)(\(.*\))?/,
    handler: (m, from) => {
        const start = from + m.index;
        // Using indexOf is risky if text repeats, but for strict structure it's okay-ish.
        // Better to accumulate lengths.
        // Full match m[0].
        // m[1] "function "
        // m[2] name
        // m[3] params
        let pos = start + m[0].indexOf(m[1]);
        const tokens: InkToken[] = [];
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
        const start = from + m.index;
        // m[1] "= "
        // m[2] name
        let pos = start + m[0].indexOf(m[1]);
        const tokens: InkToken[] = [];
        tokens.push({ from: pos, to: pos + m[1].length, className: "ink-stitch-marker", priority: 0 });

        pos = start + m[0].indexOf(m[2], m[0].indexOf(m[1]));
        tokens.push({ from: pos, to: pos + m[2].length, className: "ink-stitch-name", priority: 1 });
        return tokens;
    }
  },
  // Choice bullets: * or +
  {
    regex: /^\s*(\*+|\+\+?)(\s*)/,
    handler: (m, from) => {
        const start = from + m.index + m[0].indexOf(m[1]);
        return [{ from: start, to: start + m[1].length, className: "ink-choice-bullet", priority: 0 }];
    }
  },
  // Choice label: (label)
  {
    regex: /\((\w+)\)/g, // Global because multiple or anywhere? Usually after bullet.
    handler: (m, from) => {
        const start = from + m.index;
        return [{ from: start, to: start + m[0].length, className: "ink-label", priority: 1 }];
    }
  },
  // Choice suppress: [text]
  {
    regex: /\[[^\]]*\]/g,
    handler: (m, from) => {
        return [{ from: from + m.index, to: from + m.index + m[0].length, className: "ink-choice-suppress", priority: 1 }];
    }
  },
  // Gather: -
  {
    regex: /^\s*(-+)(\s+)/,
    handler: (m, from) => {
        const start = from + m.index + m[0].indexOf(m[1]);
        return [{ from: start, to: start + m[1].length, className: "ink-gather", priority: 0 }];
    }
  },
  // Divert: ->
  {
    regex: /(->\s*)/g,
    handler: (m, from) => {
        // Exclude if it's part of ->-> (Tunnel)
        // But we handle Tunnel separately. If Tunnel has higher priority or same, we need resolution.
        // Let's give Tunnel higher priority.
        return [{ from: from + m.index, to: from + m.index + m[1].length, className: "ink-divert-arrow", priority: 0 }];
    }
  },
  // Divert target: -> target
  {
    regex: /(->\s*)([\w.]+|END|DONE)/g,
    handler: (m, from) => {
         const start = from + m.index;
         // m[1] arrow
         // m[2] target
         const arrowLen = m[1].length;
         const targetLen = m[2].length;
         // We already match arrow in previous rule, but here we match target.
         // Let's just match the target here.
         return [{ from: start + arrowLen, to: start + arrowLen + targetLen, className: "ink-divert-target", priority: 1 }];
    }
  },
  // Tunnel: ->->
  {
    regex: /(->->)/g,
    handler: (m, from) => [{ from: from + m.index, to: from + m.index + m[0].length, className: "ink-tunnel", priority: 2 }]
  },
  // Thread: <- target
  {
    regex: /(<-\s*)([\w.]+)/g,
    handler: (m, from) => {
        const start = from + m.index;
        return [
            { from: start, to: start + m[1].length, className: "ink-thread-arrow", priority: 0 },
            { from: start + m[1].length, to: start + m[1].length + m[2].length, className: "ink-thread-target", priority: 1 }
        ];
    }
  },
  // Glue: <>
  {
    regex: /<>/g,
    handler: (m, from) => [{ from: from + m.index, to: from + m.index + m[0].length, className: "ink-glue", priority: 1 }]
  },
  // Keywords
  {
    regex: /^\s*(VAR|CONST|TEMP|INCLUDE|EXTERNAL|LIST)\b/g, // anchored to start usually
    handler: (m, from) => {
         const start = from + m.index + m[0].indexOf(m[1]);
         return [{ from: start, to: start + m[1].length, className: "ink-keyword", priority: 1 }];
    }
  },
  // Variable name (declaration)
  {
    regex: /(VAR|CONST|TEMP)\s+(\w+)/g,
    handler: (m, from) => {
         // m[1] keyword (already handled above? or here? Above rule is anchored. This one finds name.)
         // The above rule is `^\s*...`. This rule matches `VAR name`.
         // Overlap: `VAR` matched by both.
         // We only want `name` here.
         const start = from + m.index;
         const kwLen = m[0].indexOf(m[2]);
         return [{ from: start + kwLen, to: start + kwLen + m[2].length, className: "ink-variable", priority: 1 }];
    }
  },
  // Tilde
  {
    regex: /^\s*(~)/,
    handler: (m, from) => {
        const start = from + m.index + m[0].indexOf(m[1]);
        return [{ from: start, to: start + m[1].length, className: "ink-tilde", priority: 0 }];
    }
  },
  // Logic braces
  {
    regex: /\{[^}]*\}/g,
    handler: (m, from) => [{ from: from + m.index, to: from + m.index + m[0].length, className: "ink-logic", priority: 0 }]
  },
  // String literals
  {
    regex: /"[^"]*"/g,
    handler: (m, from) => [{ from: from + m.index, to: from + m.index + m[0].length, className: "ink-string", priority: 2 }]
  },
  // Tags
  {
    regex: /#\s*[^\n#]+/g,
    handler: (m, from) => [{ from: from + m.index, to: from + m.index + m[0].length, className: "ink-tag", priority: 1 }]
  },
  // Comments (Line)
  {
    regex: /(\/\/.*)/g,
    handler: (m, from) => [{ from: from + m.index, to: from + m.index + m[0].length, className: "ink-comment", priority: 3 }]
  },
  // Block comment (Single line)
  {
    regex: /\/\*.*?\*\//g,
    handler: (m, from) => [{ from: from + m.index, to: from + m.index + m[0].length, className: "ink-comment", priority: 3 }]
  },
  // TODO
  {
    regex: /\/\/\s*TODO\b.*/g,
    handler: (m, from) => [{ from: from + m.index, to: from + m.index + m[0].length, className: "ink-todo", priority: 4 }]
  },
  // INCLUDE path
  {
    regex: /INCLUDE\s+([^\n]+)/g,
    handler: (m, from) => {
        const start = from + m.index + m[0].indexOf(m[1]);
        return [{ from: start, to: start + m[1].length, className: "ink-include-path", priority: 1 }];
    }
  }
];

export const inkSyntax = ViewPlugin.fromClass(
  class {
    decorations: DecorationSet;

    constructor(view: EditorView) {
      this.decorations = this.buildDecorations(view);
    }

    update(update: ViewUpdate) {
      if (update.docChanged || update.viewportChanged) {
        this.decorations = this.buildDecorations(update.view);
      }
    }

    buildDecorations(view: EditorView): DecorationSet {
      // 1. Check file extension
      // In Obsidian, we might check view.state or workspace.
      // ViewPlugin is generic — file-extension scoping is handled by main.ts
      // which registers this extension only for the markdown editor (ink files
      // are registered as markdown via registerExtensions). The editorAttributes
      // extension adds the `ink-editor` class only when editorInfoField confirms
      // the file has a .ink extension, so highlighting runs for all editors but
      // only produces visible classes on .ink files.

      const builder = new RangeSetBuilder<Decoration>();
      const visibleRanges = view.visibleRanges;

      for (const { from, to } of visibleRanges) {
        // Process line by line
        for (let pos = from; pos <= to; ) {
          const line = view.state.doc.lineAt(pos);
          this.highlightLine(line.text, line.from, builder);
          pos = line.to + 1;
        }
      }

      return builder.finish();
    }

    highlightLine(text: string, from: number, builder: RangeSetBuilder<Decoration>) {
      const tokens: InkToken[] = [];

      // 1. Collect all matches
      for (const rule of RULES) {
        // Reset regex state if global
        if (rule.regex.global) rule.regex.lastIndex = 0;

        let match;
        // Handle global vs non-global
        if (rule.regex.global) {
            while ((match = rule.regex.exec(text)) !== null) {
                tokens.push(...rule.handler(match, from));
            }
        } else {
            match = rule.regex.exec(text);
            if (match) {
                tokens.push(...rule.handler(match, from));
            }
        }
      }

      // 2. Flatten / Resolve overlaps
      // Sort by position
      tokens.sort((a, b) => a.from - b.from || a.priority - b.priority);

      // Simple flattening: "Painter's algorithm" on a 1D array is tricky with ranges.
      // Better: Create split points.
      const points = new Set<number>();
      for (const t of tokens) {
          points.add(t.from);
          points.add(t.to);
      }
      const sortedPoints = Array.from(points).sort((a, b) => a - b);

      for (let i = 0; i < sortedPoints.length - 1; i++) {
          const start = sortedPoints[i];
          const end = sortedPoints[i+1];

          // Find best token covering this segment
          // "Best" = highest priority, then... shortest length? Spec says "shorter".
          let bestToken: InkToken | null = null;

          for (const t of tokens) {
              if (t.from <= start && t.to >= end) {
                  if (!bestToken) {
                      bestToken = t;
                  } else {
                      if (t.priority > bestToken.priority) {
                          bestToken = t;
                      } else if (t.priority === bestToken.priority) {
                          // Tie-break: Shorter match wins
                          const lenT = t.to - t.from;
                          const lenBest = bestToken.to - bestToken.from;
                          if (lenT < lenBest) {
                              bestToken = t;
                          }
                      }
                  }
              }
          }

          if (bestToken) {
              builder.add(start, end, Decoration.mark({ class: bestToken.className }));
          }
      }
    }
  },
  {
    decorations: (v) => v.decorations,
  }
);

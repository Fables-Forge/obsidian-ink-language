# Obsidian Ink Language Plugin — Technical Spec v1

## Overview

An Obsidian community plugin that brings first-class support for **inkle's Ink scripting language** (`.ink` files) into Obsidian. The goal is to give narrative designers/writers a comfortable authoring experience without leaving Obsidian — syntax highlighting, slash-command snippet insertion, command palette actions, and a structural outline panel.

**Out of scope:** Story playback/preview (the existing "Ink Player" plugin covers that).

## References

- Ink language spec: <https://github.com/inkle/ink/blob/master/Documentation/WritingWithInk.md>
- Inky editor (reference UX): <https://github.com/inkle/inky>
- Official TextMate grammar: <https://github.com/inkle/ink-tmlanguage>
- Obsidian plugin API: <https://docs.obsidian.md/Plugins/Getting+started/Build+a+plugin>
- CM6 extension docs: <https://codemirror.net/docs/guide/>
- EditorSuggest API: <https://docs.obsidian.md/Reference/TypeScript+API/EditorSuggest>

---

## 1. File Registration

Register `.ink` extension to open in Obsidian's built-in markdown editor view via `this.registerExtensions(["ink"], "markdown")` in `onload()`.

This gives us:
- `.ink` files visible in the file explorer
- Full CM6 editor with undo/redo, search, etc.
- Ability to layer custom CM6 extensions on top

**No custom view type needed.** We reuse the markdown view.

---

## 2. Syntax Highlighting

Implemented as a **CM6 ViewPlugin** registered via `this.registerEditorExtension()`. The plugin scans visible lines and applies `Decoration.mark()` spans with CSS classes.

### 2.1 File Guard

The highlighter MUST only activate when the current file has `.ink` extension. Check via `this.app.workspace.getActiveFile()?.extension === "ink"` and/or by inspecting the EditorView's associated file.

Implementation approach: wrap the ViewPlugin so it checks the active file on each `update()`. If not `.ink`, return an empty `DecorationSet`.

### 2.2 Token Types & CSS Classes

Each token type gets a CSS class. The stylesheet uses Obsidian's CSS variables (`--color-yellow`, `--text-muted`, etc.) so it works with all themes.

| Ink construct | Regex / match pattern | CSS class | Visual treatment |
|---|---|---|---|
| **Knot header** `=== name ===` | `^\s*(={2,}\s*)(\w+)(\s*={0,}\s*$)` | `.ink-knot-marker`, `.ink-knot-name` | Marker: faint, bold. Name: yellow, bold, 1.1em |
| **Knot w/ function** `=== function fn() ===` | `^\s*={2,}\s*(function\s+)(\w+)(\(.*\))?` | `.ink-keyword`, `.ink-fn-name`, `.ink-params` | Keyword: red bold. Name: cyan bold. Params: muted |
| **Stitch** `= name` | `^\s*(=\s+)(\w+)` (NOT `==`) | `.ink-stitch-marker`, `.ink-stitch-name` | Marker: faint. Name: orange, 600 weight |
| **Choice bullet** `*` or `+` | `^\s*(\*+|\+\+?)(\s*)` | `.ink-choice-bullet` | Green, bold, 1.1em |
| **Sticky choice** `+` | (same as above, `+` variant) | `.ink-choice-bullet` | Same as choice |
| **Choice label** `(label)` | `\((\w+)\)` after choice bullet | `.ink-label` | Purple, italic |
| **Choice suppress** `[text]` | `\[[^\]]*\]` on choice lines | `.ink-choice-suppress` | Muted, italic, 0.7 opacity |
| **Gather** `- ` | `^\s*(-+)(\s+)` (NOT `->`) | `.ink-gather` | Blue, bold |
| **Gather label** `- (label)` | `\((\w+)\)` after gather | `.ink-label` | Purple, italic |
| **Divert arrow** `->` | `(->\s*)` | `.ink-divert-arrow` | Blue, bold |
| **Divert target** `-> target` | `(->\s*)([\w.]+\|END\|DONE)` | `.ink-divert-target` | Blue, underline dotted |
| **Tunnel** `->->` | `(->->)` | `.ink-tunnel` | Purple, bold |
| **Thread** `<- target` | `(<-\s*)([\w.]+)` | `.ink-thread-arrow`, `.ink-thread-target` | Pink, bold / pink underline |
| **Glue** `<>` | `<>` | `.ink-glue` | Orange, bold, 0.8 opacity |
| **Keywords** `VAR`, `CONST`, `TEMP`, `INCLUDE`, `EXTERNAL`, `LIST` | `^\s*(VAR\|CONST\|TEMP\|INCLUDE\|EXTERNAL\|LIST)\b` | `.ink-keyword` | Red, bold, uppercase |
| **Variable name** (after keyword) | `(VAR\|CONST\|TEMP)\s+(\w+)` | `.ink-variable` | Cyan |
| **Tilde** `~` | `^\s*(~)` | `.ink-tilde` | Red, bold |
| **Logic braces** `{ ... }` | `\{[^}]*\}` | `.ink-logic` | Purple |
| **String literals** `"..."` | `"[^"]*"` | `.ink-string` | Green |
| **Tag** `# text` | `#\s*[^\n#]+` (outside braces) | `.ink-tag` | Muted, bg hover, small badge-style |
| **Line comment** `// ...` | `^\s*\/\/` or inline `//` | `.ink-comment` | Faint, italic |
| **Block comment** `/* ... */` | `\/\*.*\*\/` (single-line simple case) | `.ink-comment` | Faint, italic |
| **TODO** `// TODO: ...` | `^\s*\/\/\s*TODO\b` | `.ink-todo` | Orange, italic, 600 weight |
| **INCLUDE path** | After `INCLUDE\s+` | `.ink-include-path` | Cyan, underline dotted |

### 2.3 Multi-line Block Comments

Single-pass line-by-line tokenization can't handle multi-line `/* */` blocks natively. Two options:

- **Option A (recommended for MVP):** Track a `insideBlockComment` state using a CM6 `StateField` that scans the full document for `/*` and `*/` boundaries. Mark all lines inside as `.ink-comment`.
- **Option B (simpler):** Only highlight single-line `/* ... */` on the same line. Document as known limitation.

### 2.4 Overlap Resolution

When multiple regex patterns match overlapping ranges on the same line:
1. Collect all tokens
2. Sort by `from` position
3. On overlap, keep the **shorter** (more specific) span
4. Feed the non-overlapping sorted list to `RangeSetBuilder`

### 2.5 Performance

- Only tokenize lines in `view.visibleRanges` (CM6 viewport)
- Re-tokenize on `docChanged || viewportChanged`
- No full-document scan on every keystroke

---

## 3. Slash Commands (EditorSuggest)

Implements `EditorSuggest<InkSnippet>` to provide a `/` triggered popup with Ink-specific snippets. Mirrors the structure of Inky's `Ink` menu.

### 3.1 Trigger

- Character: `/`
- Activation: at start of line OR after whitespace
- Regex: `(^|\s)(\/[\w\s]*)$` on text before cursor
- **Only triggers on `.ink` files** (check `file?.extension === "ink"` in `onTrigger`)

### 3.2 Snippet Categories & Items

#### Structure
| Name | Description | Inserted text |
|---|---|---|
| Knot | New story section | `=== knot_name ===\n` |
| Stitch | Sub-section | `= stitch_name\n` |
| Function | Function definition | `=== function func_name(param) ===\n~ return param\n` |
| INCLUDE | Include file | `INCLUDE filename.ink\n` |

#### Choices
| Name | Description | Inserted text |
|---|---|---|
| Choice | One-time choice | `* Choice text\n  Result text.\n` |
| Sticky Choice | Reusable choice | `+ Sticky choice text\n  Result text.\n` |
| Choice with Suppress | Suppress text in output | `* "What did you say?"[] I asked.\n` |
| Labelled Choice | Choice with condition label | `* (label_name) Choice text\n` |
| Conditional Choice | Condition-gated choice | `* {condition} Conditional choice text\n` |
| Fallback Choice | Auto-selected fallback | `* -> fallback_knot\n` |

#### Flow
| Name | Description | Inserted text |
|---|---|---|
| Divert | Jump to target | `-> target_name\n` |
| Divert to END | End story | `-> END\n` |
| Divert to DONE | Complete thread | `-> DONE\n` |
| Tunnel | Subroutine call | `-> tunnel_name ->\n` |
| Tunnel Return | Return from tunnel | `->->\n` |
| Thread | Fork content | `<- thread_name\n` |
| Gather | Rejoin point | `- ` |
| Labelled Gather | Gather with label | `- (label_name) ` |
| Glue | Join without linebreak | `<>` |

#### Logic
| Name | Description | Inserted text |
|---|---|---|
| VAR | Global variable | `VAR variable_name = 0\n` |
| CONST | Constant | `CONST CONSTANT_NAME = 0\n` |
| TEMP | Local variable | `~ temp variable_name = 0\n` |
| Assignment | Set value | `~ variable_name = value\n` |
| If / Else | Conditional block | `{ condition:\n  True branch text.\n- else:\n  False branch text.\n}\n` |
| Switch | Multi-branch | `{\n- condition_a:\n  Branch A.\n- condition_b:\n  Branch B.\n- else:\n  Default.\n}\n` |
| EXTERNAL | External function decl | `EXTERNAL functionName(param)\n` |
| LIST | List type declaration | `LIST listName = item_a, item_b, item_c\n` |

#### Varying Text
| Name | Description | Inserted text |
|---|---|---|
| Sequence | Stopping sequence | `{stopping: first\|second\|final}` |
| Cycle | Looping cycle | `{cycle: one\|two\|three}` |
| Shuffle | Random each time | `{shuffle: option_a\|option_b\|option_c}` |
| Once-only | Shown once | `{once: This is shown only the first time.}` |
| Alternatives | Simple `{a\|b\|c}` | `{first\|second\|third}` |

#### Tags & Comments
| Name | Description | Inserted text |
|---|---|---|
| Tag | Metadata tag | `# tag_text` |
| Line Comment | `// comment` | `// ` |
| Block Comment | `/* ... */` | `/*\n * \n */\n` |
| TODO | TODO marker | `// TODO: ` |

### 3.3 Suggestion UI

Each suggestion row renders:
```
[Snippet Name]                    [Category badge]
Description text in muted color
```

CSS classes: `.ink-snippet-suggestion`, `.ink-snippet-header`, `.ink-snippet-name`, `.ink-snippet-category`, `.ink-snippet-desc`.

### 3.4 Cursor Placement

After inserting a snippet, place the cursor at the first "placeholder" position. Each snippet definition includes a `cursorOffset` (number of characters from insertion start) indicating where to place the cursor. For multi-line snippets, calculate the target line + ch by walking the inserted text.

### 3.5 Filtering

When user types `/k`, filter snippets where `name`, `description`, or `category` contains the query (case-insensitive). When just `/` is typed, show all snippets.

---

## 4. Command Palette Commands

Register via `this.addCommand()`. Each command uses `editorCallback` so it's only active when an editor is focused. All commands are prefixed with `Ink:` in the palette.

| Command ID | Palette name | Action |
|---|---|---|
| `ink:insert-knot` | Ink: Insert Knot | Insert `=== knot_name ===\n`, cursor on name |
| `ink:insert-stitch` | Ink: Insert Stitch | Insert `= stitch_name\n`, cursor on name |
| `ink:insert-choice` | Ink: Insert Choice | Insert `* `, cursor after |
| `ink:insert-sticky-choice` | Ink: Insert Sticky Choice | Insert `+ `, cursor after |
| `ink:insert-divert` | Ink: Insert Divert | Insert `-> `, cursor after |
| `ink:insert-var` | Ink: Insert Variable | Insert `VAR variable_name = 0\n`, cursor on name |
| `ink:insert-conditional` | Ink: Insert Conditional | Insert if/else block |
| `ink:wrap-logic` | Ink: Wrap in Logic Braces | Wrap selection in `{ }`, or insert `{}` with cursor inside |

---

## 5. Knot/Stitch Outline Panel

A sidebar view (like Inky's outline) showing the structure of the current `.ink` file.

### 5.1 View Registration

- Register a custom view type `ink-outline` via `this.registerView()`
- Add a ribbon icon (use `list-tree` or `network` from Lucide) to toggle the panel
- Also register a command `ink:toggle-outline` for keyboard access

### 5.2 Parsing

On file open and on document change (debounced ~300ms), scan all lines of the active `.ink` file:

```
for each line:
  if matches /^\s*={2,}\s*function\s+(\w+)/ → type: "function", name: $1
  if matches /^\s*={2,}\s*(\w+)/            → type: "knot", name: $1
  if matches /^\s*=\s+(\w+)/ (not ==)       → type: "stitch", name: $1, parent: last knot
  if matches /^\s*EXTERNAL\s+(\w+)/         → type: "external", name: $1
```

Result: a tree of `OutlineNode { type, name, line, children? }`.

### 5.3 Rendering

Render as a nested tree in the sidebar panel:

```
📖 Knots
  ├── start (line 1)
  │   ├── intro (stitch, line 5)
  │   └── departure (stitch, line 14)
  ├── london (line 28)
  │   ├── pub (stitch, line 32)
  │   └── station (stitch, line 45)
  └── ending (line 60)

⚙️ Functions
  └── has_visited(place) (line 70)

🔌 Externals
  └── playSound(name) (line 2)
```

Icons per type:
- Knot: `bookmark` or `git-branch`
- Stitch: `corner-down-right`
- Function: `function-square`
- External: `plug`

### 5.4 Interactions

- **Click** on any node → scroll editor to that line and highlight briefly
- **Active tracking** → highlight the node corresponding to the current cursor position (debounce 100ms)
- **Collapse/expand** knot nodes that have stitch children

### 5.5 Multi-file Awareness

For MVP: outline only shows the **currently active `.ink` file**. The panel title shows the filename.

Future improvement: parse `INCLUDE` statements and show a combined outline, but this is post-v1.

---

## 6. Project Structure

```
obsidian-ink-language/
├── manifest.json
├── package.json
├── tsconfig.json
├── esbuild.config.mjs
├── styles.css              ← All CSS (highlighting + snippets + outline)
├── src/
│   ├── main.ts             ← Plugin entry: onload/onunload, registrations
│   ├── syntax.ts           ← CM6 ViewPlugin for syntax highlighting
│   ├── snippets.ts         ← EditorSuggest + snippet definitions (uses i18n)
│   ├── outline.ts          ← ItemView for outline panel (uses i18n)
│   ├── parser.ts           ← Shared ink line parser (used by syntax + outline)
│   └── i18n/
│       ├── types.ts        ← TranslationKeys interface
│       ├── en.ts           ← English strings (default / source of truth)
│       ├── pl.ts           ← Polish strings
│       └── index.ts        ← initLocale() + t(key) resolver
└── README.md
```

### 6.1 Shared Parser (`parser.ts`)

Both the syntax highlighter and the outline panel need to understand ink structure. Extract a shared module:

```typescript
export interface InkLine {
  type: "knot" | "stitch" | "function" | "external" | "choice" | "gather"
        | "divert" | "var" | "const" | "temp" | "include" | "comment"
        | "todo" | "text";
  name?: string;        // for knots, stitches, functions, externals, variables
  line: number;         // 0-indexed line number
  raw: string;          // original line text
}

export function parseLine(text: string, lineNumber: number): InkLine;
```

The syntax highlighter calls `parseLine()` to determine line type, then applies fine-grained token decorations. The outline parser calls it for every line in the document to build the tree.

### 6.2 Build

Standard Obsidian plugin esbuild setup. Bundle `src/main.ts` → `main.js`. External: `obsidian`, all `@codemirror/*` packages, `electron`, node builtins.

Use `--legacy-peer-deps` for npm install due to Obsidian's pinned CM6 versions.

---

## 7. Localization (i18n)

The plugin ships with **English (default)** and **Polish** translations. The active locale is detected at load time from Obsidian's API and affects command palette names, snippet names/descriptions, outline panel labels, and settings UI.

### 7.1 Locale Detection

```typescript
// In onload():
const locale = window.localStorage.getItem("language") || "en";
// Obsidian stores the UI language in localStorage under "language".
// Values: "en", "pl", "de", "fr", "ja", etc.
```

Pick the matching translation file; fall back to `"en"` for unsupported locales.

### 7.2 File Structure

```
src/
├── i18n/
│   ├── types.ts        ← TranslationKeys interface
│   ├── en.ts           ← English strings (default / source of truth)
│   ├── pl.ts           ← Polish strings
│   └── index.ts        ← locale resolver: export function t(key): string
```

### 7.3 Translation Keys & Strings

`types.ts` defines the shape:

```typescript
export interface TranslationKeys {
  // ── Command palette ──────────────────────
  "cmd.insert-knot": string;
  "cmd.insert-stitch": string;
  "cmd.insert-choice": string;
  "cmd.insert-sticky-choice": string;
  "cmd.insert-divert": string;
  "cmd.insert-var": string;
  "cmd.insert-conditional": string;
  "cmd.wrap-logic": string;
  "cmd.toggle-outline": string;

  // ── Snippet names ────────────────────────
  "snippet.knot.name": string;
  "snippet.knot.desc": string;
  "snippet.stitch.name": string;
  "snippet.stitch.desc": string;
  "snippet.function.name": string;
  "snippet.function.desc": string;
  "snippet.include.name": string;
  "snippet.include.desc": string;
  "snippet.choice.name": string;
  "snippet.choice.desc": string;
  "snippet.sticky-choice.name": string;
  "snippet.sticky-choice.desc": string;
  "snippet.choice-suppress.name": string;
  "snippet.choice-suppress.desc": string;
  "snippet.labelled-choice.name": string;
  "snippet.labelled-choice.desc": string;
  "snippet.conditional-choice.name": string;
  "snippet.conditional-choice.desc": string;
  "snippet.fallback-choice.name": string;
  "snippet.fallback-choice.desc": string;
  "snippet.divert.name": string;
  "snippet.divert.desc": string;
  "snippet.divert-end.name": string;
  "snippet.divert-end.desc": string;
  "snippet.divert-done.name": string;
  "snippet.divert-done.desc": string;
  "snippet.tunnel.name": string;
  "snippet.tunnel.desc": string;
  "snippet.tunnel-return.name": string;
  "snippet.tunnel-return.desc": string;
  "snippet.thread.name": string;
  "snippet.thread.desc": string;
  "snippet.gather.name": string;
  "snippet.gather.desc": string;
  "snippet.labelled-gather.name": string;
  "snippet.labelled-gather.desc": string;
  "snippet.glue.name": string;
  "snippet.glue.desc": string;
  "snippet.var.name": string;
  "snippet.var.desc": string;
  "snippet.const.name": string;
  "snippet.const.desc": string;
  "snippet.temp.name": string;
  "snippet.temp.desc": string;
  "snippet.assignment.name": string;
  "snippet.assignment.desc": string;
  "snippet.if-else.name": string;
  "snippet.if-else.desc": string;
  "snippet.switch.name": string;
  "snippet.switch.desc": string;
  "snippet.external.name": string;
  "snippet.external.desc": string;
  "snippet.list.name": string;
  "snippet.list.desc": string;
  "snippet.sequence.name": string;
  "snippet.sequence.desc": string;
  "snippet.cycle.name": string;
  "snippet.cycle.desc": string;
  "snippet.shuffle.name": string;
  "snippet.shuffle.desc": string;
  "snippet.once.name": string;
  "snippet.once.desc": string;
  "snippet.alternatives.name": string;
  "snippet.alternatives.desc": string;
  "snippet.tag.name": string;
  "snippet.tag.desc": string;
  "snippet.line-comment.name": string;
  "snippet.line-comment.desc": string;
  "snippet.block-comment.name": string;
  "snippet.block-comment.desc": string;
  "snippet.todo.name": string;
  "snippet.todo.desc": string;

  // ── Snippet categories ───────────────────
  "cat.structure": string;
  "cat.choices": string;
  "cat.flow": string;
  "cat.logic": string;
  "cat.varying-text": string;
  "cat.tags": string;

  // ── Outline panel ────────────────────────
  "outline.title": string;
  "outline.knots": string;
  "outline.functions": string;
  "outline.externals": string;
  "outline.empty": string;
}
```

### 7.4 English Strings (`en.ts`)

```typescript
export const en: TranslationKeys = {
  "cmd.insert-knot":          "Ink: Insert Knot",
  "cmd.insert-stitch":        "Ink: Insert Stitch",
  "cmd.insert-choice":        "Ink: Insert Choice",
  "cmd.insert-sticky-choice": "Ink: Insert Sticky Choice",
  "cmd.insert-divert":        "Ink: Insert Divert",
  "cmd.insert-var":           "Ink: Insert Variable",
  "cmd.insert-conditional":   "Ink: Insert Conditional",
  "cmd.wrap-logic":           "Ink: Wrap in Logic Braces",
  "cmd.toggle-outline":       "Ink: Toggle Outline",

  "snippet.knot.name":              "Knot",
  "snippet.knot.desc":              "New story section (=== name ===)",
  "snippet.stitch.name":            "Stitch",
  "snippet.stitch.desc":            "Sub-section within a knot (= name)",
  "snippet.function.name":          "Function",
  "snippet.function.desc":          "Ink function definition",
  "snippet.include.name":           "INCLUDE",
  "snippet.include.desc":           "Include another ink file",
  "snippet.choice.name":            "Choice",
  "snippet.choice.desc":            "One-time choice (* text)",
  "snippet.sticky-choice.name":     "Sticky Choice",
  "snippet.sticky-choice.desc":     "Reusable choice (+ text)",
  "snippet.choice-suppress.name":   "Choice with Suppress",
  "snippet.choice-suppress.desc":   "Choice with suppressed text",
  "snippet.labelled-choice.name":   "Labelled Choice",
  "snippet.labelled-choice.desc":   "Choice with a label for conditions",
  "snippet.conditional-choice.name":"Conditional Choice",
  "snippet.conditional-choice.desc":"Choice shown only if condition met",
  "snippet.fallback-choice.name":   "Fallback Choice",
  "snippet.fallback-choice.desc":   "Auto-selected when others exhausted",
  "snippet.divert.name":            "Divert",
  "snippet.divert.desc":            "Jump to a knot or stitch (-> target)",
  "snippet.divert-end.name":        "Divert to END",
  "snippet.divert-end.desc":        "End the story (-> END)",
  "snippet.divert-done.name":       "Divert to DONE",
  "snippet.divert-done.desc":       "Mark thread as done (-> DONE)",
  "snippet.tunnel.name":            "Tunnel",
  "snippet.tunnel.desc":            "Subroutine call (-> tunnel ->)",
  "snippet.tunnel-return.name":     "Tunnel Return",
  "snippet.tunnel-return.desc":     "Return from tunnel (->->)",
  "snippet.thread.name":            "Thread",
  "snippet.thread.desc":            "Fork content (<- target)",
  "snippet.gather.name":            "Gather",
  "snippet.gather.desc":            "Rejoin point after choices (- )",
  "snippet.labelled-gather.name":   "Labelled Gather",
  "snippet.labelled-gather.desc":   "Gather with label (- (label))",
  "snippet.glue.name":              "Glue",
  "snippet.glue.desc":              "Join text without line break (<>)",
  "snippet.var.name":               "VAR declaration",
  "snippet.var.desc":               "Declare a global variable",
  "snippet.const.name":             "CONST declaration",
  "snippet.const.desc":             "Declare a constant",
  "snippet.temp.name":              "TEMP variable",
  "snippet.temp.desc":              "Declare a temporary (local) variable",
  "snippet.assignment.name":        "Assignment",
  "snippet.assignment.desc":        "Set a variable value (~ var = val)",
  "snippet.if-else.name":           "If / Else",
  "snippet.if-else.desc":           "Conditional block",
  "snippet.switch.name":            "Switch",
  "snippet.switch.desc":            "Multi-branch conditional",
  "snippet.external.name":          "External Function",
  "snippet.external.desc":          "Declare an external (game engine) function",
  "snippet.list.name":              "LIST declaration",
  "snippet.list.desc":              "Declare an ink LIST type",
  "snippet.sequence.name":          "Sequence",
  "snippet.sequence.desc":          "Text that cycles once through options",
  "snippet.cycle.name":             "Cycle",
  "snippet.cycle.desc":             "Text that loops through options",
  "snippet.shuffle.name":           "Shuffle",
  "snippet.shuffle.desc":           "Random text each time",
  "snippet.once.name":              "Once-only",
  "snippet.once.desc":              "Text shown only once",
  "snippet.alternatives.name":      "Alternatives",
  "snippet.alternatives.desc":      "Simple alternatives {a|b|c}",
  "snippet.tag.name":               "Tag",
  "snippet.tag.desc":               "Metadata tag (# tag_text)",
  "snippet.line-comment.name":      "Line Comment",
  "snippet.line-comment.desc":      "Single-line comment",
  "snippet.block-comment.name":     "Block Comment",
  "snippet.block-comment.desc":     "Multi-line comment block",
  "snippet.todo.name":              "TODO",
  "snippet.todo.desc":              "TODO comment for issue tracking",

  "cat.structure":    "Structure",
  "cat.choices":      "Choices",
  "cat.flow":         "Flow",
  "cat.logic":        "Logic",
  "cat.varying-text": "Varying Text",
  "cat.tags":         "Tags",

  "outline.title":     "Ink Outline",
  "outline.knots":     "Knots",
  "outline.functions": "Functions",
  "outline.externals": "Externals",
  "outline.empty":     "No knots found. Open an .ink file.",
};
```

### 7.5 Polish Strings (`pl.ts`)

```typescript
export const pl: TranslationKeys = {
  "cmd.insert-knot":          "Ink: Dodaj węzeł",
  "cmd.insert-stitch":        "Ink: Dodaj ścieg",
  "cmd.insert-choice":        "Ink: Dodaj wybór",
  "cmd.insert-sticky-choice": "Ink: Dodaj stały wybór",
  "cmd.insert-divert":        "Ink: Dodaj przekierowanie",
  "cmd.insert-var":           "Ink: Dodaj zmienną",
  "cmd.insert-conditional":   "Ink: Dodaj warunek",
  "cmd.wrap-logic":           "Ink: Otocz klamrami logiki",
  "cmd.toggle-outline":       "Ink: Przełącz zarys",

  "snippet.knot.name":              "Węzeł",
  "snippet.knot.desc":              "Nowa sekcja fabuły (=== nazwa ===)",
  "snippet.stitch.name":            "Ścieg",
  "snippet.stitch.desc":            "Podsekcja w węźle (= nazwa)",
  "snippet.function.name":          "Funkcja",
  "snippet.function.desc":          "Definicja funkcji Ink",
  "snippet.include.name":           "INCLUDE",
  "snippet.include.desc":           "Dołącz inny plik ink",
  "snippet.choice.name":            "Wybór",
  "snippet.choice.desc":            "Jednorazowy wybór (* tekst)",
  "snippet.sticky-choice.name":     "Stały wybór",
  "snippet.sticky-choice.desc":     "Wielorazowy wybór (+ tekst)",
  "snippet.choice-suppress.name":   "Wybór z ukryciem",
  "snippet.choice-suppress.desc":   "Wybór z ukrytym tekstem",
  "snippet.labelled-choice.name":   "Wybór z etykietą",
  "snippet.labelled-choice.desc":   "Wybór z etykietą do warunków",
  "snippet.conditional-choice.name":"Wybór warunkowy",
  "snippet.conditional-choice.desc":"Wybór widoczny gdy warunek spełniony",
  "snippet.fallback-choice.name":   "Wybór zastępczy",
  "snippet.fallback-choice.desc":   "Automatyczny gdy inne wyczerpane",
  "snippet.divert.name":            "Przekierowanie",
  "snippet.divert.desc":            "Skok do węzła lub ściegu (-> cel)",
  "snippet.divert-end.name":        "Przekierowanie do END",
  "snippet.divert-end.desc":        "Zakończ fabułę (-> END)",
  "snippet.divert-done.name":       "Przekierowanie do DONE",
  "snippet.divert-done.desc":       "Oznacz wątek jako ukończony (-> DONE)",
  "snippet.tunnel.name":            "Tunel",
  "snippet.tunnel.desc":            "Wywołanie podprocedury (-> tunel ->)",
  "snippet.tunnel-return.name":     "Powrót z tunelu",
  "snippet.tunnel-return.desc":     "Powrót z tunelu (->->)",
  "snippet.thread.name":            "Wątek",
  "snippet.thread.desc":            "Rozwidlenie treści (<- cel)",
  "snippet.gather.name":            "Zbieranie",
  "snippet.gather.desc":            "Punkt scalenia po wyborach (- )",
  "snippet.labelled-gather.name":   "Zbieranie z etykietą",
  "snippet.labelled-gather.desc":   "Punkt scalenia z etykietą (- (etykieta))",
  "snippet.glue.name":              "Sklejenie",
  "snippet.glue.desc":              "Połącz tekst bez nowej linii (<>)",
  "snippet.var.name":               "Deklaracja VAR",
  "snippet.var.desc":               "Zadeklaruj zmienną globalną",
  "snippet.const.name":             "Deklaracja CONST",
  "snippet.const.desc":             "Zadeklaruj stałą",
  "snippet.temp.name":              "Zmienna TEMP",
  "snippet.temp.desc":              "Zadeklaruj zmienną tymczasową (lokalną)",
  "snippet.assignment.name":        "Przypisanie",
  "snippet.assignment.desc":        "Ustaw wartość zmiennej (~ zm = wart)",
  "snippet.if-else.name":           "Jeśli / W przeciwnym razie",
  "snippet.if-else.desc":           "Blok warunkowy",
  "snippet.switch.name":            "Przełącznik",
  "snippet.switch.desc":            "Warunek wielogałęziowy",
  "snippet.external.name":          "Funkcja zewnętrzna",
  "snippet.external.desc":          "Deklaracja funkcji silnika gry",
  "snippet.list.name":              "Deklaracja LIST",
  "snippet.list.desc":              "Zadeklaruj typ LIST w Ink",
  "snippet.sequence.name":          "Sekwencja",
  "snippet.sequence.desc":          "Tekst przechodzący przez opcje jednokrotnie",
  "snippet.cycle.name":             "Cykl",
  "snippet.cycle.desc":             "Tekst zapętlony przez opcje",
  "snippet.shuffle.name":           "Losowanie",
  "snippet.shuffle.desc":           "Losowy tekst za każdym razem",
  "snippet.once.name":              "Jednorazowy",
  "snippet.once.desc":              "Tekst pokazany tylko raz",
  "snippet.alternatives.name":      "Alternatywy",
  "snippet.alternatives.desc":      "Proste alternatywy {a|b|c}",
  "snippet.tag.name":               "Tag",
  "snippet.tag.desc":               "Tag metadanych (# tekst_tagu)",
  "snippet.line-comment.name":      "Komentarz liniowy",
  "snippet.line-comment.desc":      "Komentarz jednoliniowy",
  "snippet.block-comment.name":     "Komentarz blokowy",
  "snippet.block-comment.desc":     "Wieloliniowy blok komentarza",
  "snippet.todo.name":              "TODO",
  "snippet.todo.desc":              "Komentarz TODO do śledzenia zadań",

  "cat.structure":    "Struktura",
  "cat.choices":      "Wybory",
  "cat.flow":         "Przepływ",
  "cat.logic":        "Logika",
  "cat.varying-text": "Tekst zmienny",
  "cat.tags":         "Tagi",

  "outline.title":     "Zarys Ink",
  "outline.knots":     "Węzły",
  "outline.functions": "Funkcje",
  "outline.externals": "Zewnętrzne",
  "outline.empty":     "Brak węzłów. Otwórz plik .ink.",
};
```

### 7.6 Resolver (`i18n/index.ts`)

```typescript
import { en } from "./en";
import { pl } from "./pl";
import type { TranslationKeys } from "./types";

const locales: Record<string, TranslationKeys> = { en, pl };
let active: TranslationKeys = en;

export function initLocale(): void {
  const lang = window.localStorage.getItem("language") || "en";
  // Obsidian stores e.g. "pl", "en", "de"
  active = locales[lang] ?? en;
}

export function t(key: keyof TranslationKeys): string {
  return active[key] ?? en[key] ?? key;
}
```

Call `initLocale()` at the top of `onload()`. Then use `t("cmd.insert-knot")` everywhere instead of hardcoded strings.

### 7.7 Integration Points

**Command palette** — use `t()` for the `name` field:

```typescript
this.addCommand({
  id: "ink:insert-knot",
  name: t("cmd.insert-knot"),   // "Ink: Insert Knot" or "Ink: Dodaj węzeł"
  editorCallback: (editor) => { ... },
});
```

**Snippet definitions** — snippet `name`, `description`, and `category` come from `t()`:

```typescript
{
  nameKey: "snippet.knot.name",      // resolved at runtime via t()
  descKey: "snippet.knot.desc",
  catKey:  "cat.structure",
  ink: "=== knot_name ===\n",
  cursorOffset: 4,
}
```

The `InkSnippet` interface gains `nameKey`, `descKey`, `catKey` (translation keys) instead of raw strings. `getSuggestions()` resolves them through `t()` before filtering and display.

**Outline panel** — section headers ("Knots", "Functions", "Externals") and empty-state message use `t()`.

**Slash command filtering** — filtering MUST search against the **resolved** (localized) name and description so Polish users can type `/węzeł` or `/wez` and match.

### 7.8 Adding New Locales

To add a new language (e.g. German):
1. Create `src/i18n/de.ts` implementing `TranslationKeys`
2. Import and add to `locales` map in `index.ts`
3. That's it — the resolver picks it up automatically

---

## 8. CSS Design Principles

- **Zero hardcoded colors.** Use Obsidian CSS variables exclusively: `--color-yellow`, `--color-orange`, `--color-green`, `--color-blue`, `--color-purple`, `--color-cyan`, `--color-red`, `--color-pink`, `--text-normal`, `--text-muted`, `--text-faint`, `--background-modifier-hover`.
- Works in both light and dark themes automatically.
- Knot names should feel like headings (bigger, bold).
- Choice bullets should pop (green, bold, slightly larger).
- Diverts should feel like links (blue, underline).
- Comments should recede (faint, italic).
- Tags should look like badges (background, small, rounded).

---

## 9. Edge Cases & Gotchas

1. **Obsidian's native `/` slash commands** — Obsidian has a built-in Slash Commands core plugin. Our EditorSuggest fires on `.ink` files only, so there's no conflict. If a user has Obsidian's slash commands enabled, both will trigger — but since `.ink` files aren't markdown, the native one is largely irrelevant. Document this in README.
2. **`registerExtensions(["ink"], "markdown")`** — This makes Obsidian treat `.ink` as markdown internally. Side effect: Obsidian's markdown parser will try to interpret `#` as headings, `*` as bold/list, etc. in Reading View. This is acceptable because writers will use Source Mode / Live Preview for `.ink` files. Add a note in README recommending Source Mode for `.ink`.
3. **CM6 decoration ordering** — `RangeSetBuilder` requires decorations sorted by position. Always sort token array before building.
4. **Performance** — Only process `view.visibleRanges`. Outline re-parse should be debounced (300ms). Don't full-scan on every keystroke.
5. **Plugin unload** — `registerEditorExtension` and `registerView` are auto-cleaned by Obsidian on plugin disable. No manual cleanup needed.
6. **Outline panel persistence** — Use `this.app.workspace.revealLeaf()` pattern. Save panel visibility state in plugin data if desired.

---

## 10. Manifest

```json
{
  "id": "ink-language",
  "name": "Ink Language",
  "version": "1.0.0",
  "minAppVersion": "1.4.0",
  "description": "Syntax highlighting, slash commands, and outline panel for inkle's Ink scripting language (.ink files)",
  "author": "Fables Forge",
  "isDesktopOnly": false
}
```

---

## 11. Testing Checklist

- [ ] `.ink` file opens in Obsidian editor (not as unknown binary)
- [ ] Knot headers (`=== name ===`) highlighted yellow/bold
- [ ] Stitch headers (`= name`) highlighted orange
- [ ] Choice bullets (`*`, `+`) highlighted green
- [ ] Diverts (`-> target`) highlighted blue with underline
- [ ] Variables (`VAR x = 5`) keyword red, name cyan
- [ ] Logic braces (`{condition}`) highlighted purple
- [ ] Comments (`//`, `/* */`) faint italic
- [ ] Tags (`# tag`) badge-style
- [ ] Highlighting does NOT activate on `.md` files
- [ ] `/` in `.ink` file opens snippet popup
- [ ] Snippet filtering works (typing `/kn` shows "Knot")
- [ ] Snippet insertion places cursor correctly
- [ ] `/` in `.md` file does NOT trigger ink snippets
- [ ] Command palette shows `Ink: Insert Knot` etc.
- [ ] Outline panel opens via ribbon icon
- [ ] Outline shows knots, stitches, functions, externals in tree
- [ ] Clicking outline node scrolls to correct line
- [ ] Outline updates on edit (debounced)
- [ ] Active node tracks cursor position
- [ ] Plugin loads/unloads cleanly (no console errors)
- [ ] Works in dark theme and light theme
- [ ] Works on a 1000+ line `.ink` file without lag

### i18n
- [ ] With Obsidian in English: commands show "Ink: Insert Knot", snippets show "Knot", outline shows "Knots"
- [ ] With Obsidian in Polish: commands show "Ink: Dodaj węzeł", snippets show "Węzeł", outline shows "Węzły"
- [ ] Polish slash filtering: typing `/węz` matches "Węzeł", `/wyb` matches "Wybór"
- [ ] English slash filtering still works: `/kn` matches "Knot"
- [ ] Unsupported locale (e.g. "de") falls back to English gracefully
- [ ] Snippet `ink` insertion text is identical regardless of locale (only UI labels change)

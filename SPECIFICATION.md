# Obsidian Ink Language Plugin — Technical Spec v2

## Overview

An Obsidian community plugin that brings first-class support for **inkle's Ink scripting language** (`.ink` files) into Obsidian. The goal is to give narrative designers and writers a comfortable authoring experience without leaving Obsidian — syntax highlighting, Ctrl+Click navigation, slash-command snippet insertion, command palette actions, a structural outline panel, and configurable editor themes.

**Out of scope:** Story playback/preview (the existing "Ink Player" plugin covers that).

## Inspiration & Credits

This plugin is heavily inspired by **[Inky](https://github.com/inkle/inky)**, inkle's official Ink editor. The two-theme system (Normal / Focus), the outline panel structure, and the overall UX philosophy directly reference Inky's design. Ink is created by [inkle](https://www.inklestudios.com/).

## References

- Ink language guide: <https://github.com/inkle/ink/blob/master/Documentation/WritingWithInk.md>
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

**Source mode enforcement:** Because `.ink` is registered as markdown, Obsidian defaults to Live Preview mode which treats tab-indented lines as code blocks, causing incorrect visual formatting. On `active-leaf-change`, if the newly active leaf is a MarkdownView showing a `.ink` file and is not in source mode, force it with `view.setMode(view.modes.source)`.

---

## 2. Syntax Highlighting

Implemented as a **CM6 ViewPlugin** registered via `this.registerEditorExtension()`. The plugin scans visible lines and applies `Decoration.mark()` spans with CSS classes.

### 2.1 File Guard

The highlighter activates for all editors (registered globally), but only produces decorations for `.ink` files. Access the file via `editorInfoField` (Obsidian StateField): `state.field(editorInfoField)?.file?.extension === "ink"`. If not `.ink`, return an empty `DecorationSet`.

### 2.2 Token Types & CSS Classes

Each token type gets a CSS class. Visual treatment is applied by the active theme (see Section 8).

| Ink construct | Regex / match pattern | CSS class(es) |
|---|---|---|
| **Knot header** `=== name ===` | `^\s*(={2,}\s*)(\w+)(\s*={0,}\s*$)` | `.ink-knot-marker`, `.ink-knot-name` |
| **Knot w/ function** `=== function fn() ===` | `^\s*={2,}\s*(function\s+)(\w+)(\(.*\))?` | `.ink-keyword`, `.ink-fn-name`, `.ink-params` |
| **Stitch** `= name` | `^\s*(=\s+)(\w+)` (not `==`) | `.ink-stitch-marker`, `.ink-stitch-name` |
| **Choice bullet** `*` / `+` | `^\s*(\*+|\+\+?)(\s*)` | `.ink-choice-bullet` |
| **Choice label** `(label)` | `\((\w+)\)` after choice bullet | `.ink-label` |
| **Choice suppress** `[text]` | `\[[^\]]*\]` on choice lines | `.ink-choice-suppress` |
| **Gather** `- ` | `^\s*(-+)(\s+)` (not `->`) | `.ink-gather` |
| **Named gather** `- (label)` | `^\s*(-\s*)+\((\w+)\)` | `.ink-gather` + `.ink-label` |
| **Divert arrow** `->` | `(->\s*)` | `.ink-divert-arrow` |
| **Divert target** | `(->\s*)([\w.]+\|END\|DONE)` | `.ink-divert-target` |
| **Tunnel** `->->` | `(->->)` | `.ink-tunnel` |
| **Thread** `<- target` | `(<-\s*)([\w.]+)` | `.ink-thread-arrow`, `.ink-thread-target` |
| **Glue** `<>` | `<>` | `.ink-glue` |
| **Keywords** | `^\s*(VAR\|CONST\|TEMP\|INCLUDE\|EXTERNAL\|LIST)\b` | `.ink-keyword` |
| **Variable name** | `(VAR\|CONST\|TEMP)\s+(\w+)` | `.ink-variable` |
| **Tilde** `~` | `^\s*(~)` | `.ink-tilde` |
| **Logic braces** `{ ... }` | `\{[^}]*\}` | `.ink-logic` |
| **String literals** | `"[^"]*"` | `.ink-string` |
| **Tag** `# text` | `#\s*[^\n#]+` | `.ink-tag` |
| **Line comment** `// ...` | `^\s*\/\/` | `.ink-comment` |
| **TODO comment** | `^\s*\/\/\s*TODO\b` | `.ink-todo` |
| **Block comment** `/* */` | `\/\*.*\*\/` (single-line) | `.ink-comment` |
| **INCLUDE path** | After `INCLUDE\s+` | `.ink-include-path` |

### 2.3 Multi-line Block Comments

Single-pass line-by-line tokenization handles only single-line `/* ... */`. Multi-line blocks are a known limitation in v1. Future: track `insideBlockComment` state via a CM6 `StateField`.

### 2.4 Overlap Resolution

When multiple regex patterns match overlapping ranges on the same line:
1. Collect all tokens with priority values
2. Sort by `from` position
3. On overlap, keep the higher-priority (more specific) span
4. Feed the non-overlapping sorted list to `RangeSetBuilder`

### 2.5 Performance

- Only tokenize lines in `view.visibleRanges` (CM6 viewport)
- Re-tokenize on `docChanged || viewportChanged`
- No full-document scan on every keystroke

### 2.6 Monospace Font

Apply `font-family: var(--font-monospace)` to all content inside `.ink-editor`:

```css
.ink-editor .cm-content,
.ink-editor .cm-scroller,
.ink-editor .cm-content * {
    font-family: var(--font-monospace) !important;
}
```

The `*` selector is required because Obsidian's theme CSS can override font-family on individual spans (bold, italic, markdown-parsed elements). Without it, subtle alignment inconsistencies appear between lines.

Also suppress markdown code-block styling that Obsidian applies to tab-indented lines:

```css
.ink-editor .cm-inline-code { background: transparent !important; border: none !important; ... }
.ink-editor .HyperMD-codeblock { background: transparent !important; }
```

---

## 3. Slash Commands (EditorSuggest)

Implements `EditorSuggest<InkSnippet>` to provide a `/`-triggered popup with Ink-specific snippets. Mirrors the structure of Inky's Insert menu.

### 3.1 Trigger

```typescript
onTrigger(cursor, editor, file): EditorSuggestTriggerInfo | null {
  if (file?.extension !== "ink") return null;
  // look for "/" on current line before cursor
}
```

### 3.2 Snippet Categories & Items

| Category | Snippets |
|---|---|
| **Structure** | Knot, Stitch, Function, INCLUDE |
| **Choices** | Choice, Sticky Choice, Choice with Suppress, Labelled Choice, Conditional Choice, Fallback Choice |
| **Flow** | Divert, Divert to END, Divert to DONE, Tunnel, Tunnel Return, Thread, Gather, Labelled Gather, Glue |
| **Logic** | VAR, CONST, TEMP, Assignment, If/Else, Switch, EXTERNAL, LIST |
| **Varying Text** | Sequence, Cycle, Shuffle, Once-only, Alternatives |
| **Tags & Comments** | Tag, Line Comment, Block Comment, TODO |

### 3.3 Suggestion UI

Each suggestion renders:
- **Name** (translated) — bold, left side
- **Category badge** — small, muted, right side
- **Description** (translated) — small, muted, below name

### 3.4 Cursor Placement

After insertion, `cursorOffset` positions the cursor inside the snippet at the most useful edit point (e.g., on the knot name for a Knot snippet).

### 3.5 Filtering

`getSuggestions` filters by matching the query against snippet name and description (case-insensitive, locale-aware).

---

## 4. Ctrl+Click Navigation

Implemented as a CM6 `EditorView.domEventHandlers` extension (`mousedown`). Activated by `Ctrl` (Windows/Linux) or `Cmd` (Mac).

### 4.1 Word Detection

Get word under click position using `view.posAtCoords()` + regex scan of the line. Pattern: `/[\w_.]+/g` — allows alphanumeric, underscore, and dot (for `knot.stitch` paths).

### 4.2 Definition Search — `findDefinition(lines, target, clickLineIndex)`

Pure function extracted to `navigation.logic.ts`. Takes all document lines as strings, the target identifier, and the 0-indexed click line. Returns the 0-indexed line of the best match, or `-1`.

**Context resolution:** Scan backwards from click line to determine which knot the click is inside (`contextKnot`).

**Search priorities** (lower = better):

| Priority | Match |
|---|---|
| 0 | Global knot / function / var / const / external with exact name |
| 0 | Local stitch in same knot as click |
| 0 | Named gather label in same knot as click |
| 1 | Named gather label in other knot |
| 2 | Stitch in other knot |

**Named gather labels** (`- (label)`, `- - (label)`) are parsed by `parseLine()` as `{ type: "gather", name: "label" }` and are included in the search.

**Explicit paths** (`knot.stitch`): split on `.`, match the knot scan context against `parts[0]` and stitch name against `parts[1]`.

**Keywords ignored:** `VAR`, `CONST`, `TEMP`, `LIST`, `EXTERNAL`, `INCLUDE`, `function`, `END`, `DONE`.

### 4.3 Scroll Behavior

On match, dispatch a CM6 transaction:
```typescript
view.dispatch({
  selection: { anchor: targetPos },
  effects: getScrollEffect(targetPos, view),
  userEvent: "select.pointer",
});
```
`getScrollEffect()` reads `currentSettings.scrollPosition` (see Section 6).

---

## 5. Command Palette Commands

Register via `this.addCommand()`. All commands are prefixed with `Ink:` in the palette.

| Command ID | Palette name | Action |
|---|---|---|
| `ink:toggle-outline` | Ink: Toggle Outline | Open or close the outline panel |
| `ink:toggle-focus-mode` | Ink: Toggle Focus Mode | Toggle between Normal and Focus editor themes |
| `ink:insert-knot` | Ink: Insert Knot | Insert `=== knot_name ===\n`, cursor on name |
| `ink:insert-stitch` | Ink: Insert Stitch | Insert `= stitch_name\n`, cursor on name |
| `ink:insert-choice` | Ink: Insert Choice | Insert `* ` |
| `ink:insert-sticky-choice` | Ink: Insert Sticky Choice | Insert `+ ` |
| `ink:insert-divert` | Ink: Insert Divert | Insert `-> ` |
| `ink:insert-var` | Ink: Insert Variable | Insert `VAR variable_name = 0\n`, cursor on name |
| `ink:insert-conditional` | Ink: Insert Conditional | Insert if/else block skeleton |
| `ink:wrap-logic` | Ink: Wrap in Logic Braces | Wrap selection in `{ }`, or insert `{}` with cursor inside |

`ink:toggle-focus-mode` toggles `settings.editorTheme` between `"normal"` and `"focus"` and calls `saveSettings()`, which dispatches a CM6 `StateEffect` to all open ink editors (instant, no reload needed).

---

## 6. Knot/Stitch Outline Panel

A sidebar panel (inspired by Inky's outline) showing the structure of the current `.ink` file.

### 6.1 View Registration

- Register view type `ink-outline` via `this.registerView()`
- Ribbon icon (`list-tree`) toggles the panel
- Command `ink:toggle-outline` for keyboard access

### 6.2 Parsing

On file open and on document change (debounced 300ms), scan all lines via `parseLine()`:

- `type === "knot"` → root node
- `type === "function"` → root node (separate section)
- `type === "stitch"` → child of last seen knot
- `type === "external"` → root node (separate section)

Result: tree of `OutlineNode { type, name, line, children }`.

### 6.3 Rendering

Three sections: Knots (with stitches nested), Functions, Externals. Each entry shows a type icon (CSS shape) and the name. Clicking navigates to that line.

### 6.4 Interactions

**Click:** Use `workspace.iterateAllLeaves()` to find the leaf displaying `currentFile` — do NOT use `getActiveViewOfType()`, because clicking the outline panel changes the active leaf to the outline itself. After finding the correct leaf, call `workspace.setActiveLeaf(leaf, { focus: true })`, set cursor, and dispatch `getScrollEffect()` on the underlying CM6 view (`(view.editor as any).cm`).

**Refresh on active-leaf-change:** Ignore events where the newly active leaf is the outline panel itself (`leaf?.view === this`), otherwise the panel clears itself when clicked.

**Refresh on editor-change:** Debounced 300ms, only for `.ink` files.

### 6.5 Multi-file Awareness

Outline shows the currently active `.ink` file only. The panel shows a placeholder when no `.ink` file is active.

---

## 7. Settings

Plugin settings are stored via `this.loadData()` / `this.saveData()`. A shared mutable object `currentSettings` in `settings.ts` is updated via `applySettings()` and read at runtime by navigation and outline.

```typescript
export type ScrollPosition = "top" | "quarter" | "center";
export type EditorTheme    = "normal" | "focus";

export interface InkSettings {
  scrollPosition: ScrollPosition;   // default: "quarter"
  editorTheme:    EditorTheme;      // default: "normal"
}
```

### 7.1 Scroll Position

`getScrollEffect(pos, view)` converts `scrollPosition` to a CM6 `EditorView.scrollIntoView` effect:

| Value | CM6 options |
|---|---|
| `"top"` | `y: "start"`, `yMargin: 5` |
| `"quarter"` | `y: "start"`, `yMargin: view.dom.clientHeight / 4` |
| `"center"` | `y: "center"` |

Used by both Ctrl+Click navigation and Outline click.

### 7.2 Editor Theme

The active theme is stored as a CM6 `StateField<EditorTheme>`. A `StateEffect<EditorTheme>` updates it. `editorAttributes.compute([editorInfoField, themeField], ...)` applies the class `ink-theme-normal` or `ink-theme-focus` to the `.cm-editor` element.

When `saveSettings()` is called (from Settings UI or Toggle Focus Mode command), it iterates all open ink editors and dispatches the theme effect — no file reload required.

```typescript
cm.dispatch({ effects: setThemeEffect.of(settings.editorTheme) });
```

**Why StateField instead of direct classList manipulation:** CM6 re-applies `editorAttributes` on state updates, overwriting manual DOM changes. A StateField is the correct mechanism because `editorAttributes.compute` re-runs when the StateField value changes.

---

## 8. Project Structure

```
obsidian-ink-language/
├── manifest.json
├── package.json
├── tsconfig.json
├── esbuild.config.mjs
├── styles.css                   ← All CSS
├── README.md                    ← User documentation
├── SPECIFICATION.md             ← This file
└── src/
    ├── main.ts                  ← Plugin entry, registrations, settings, theme StateField
    ├── settings.ts              ← InkSettings type, currentSettings, getScrollEffect()
    ├── syntax.ts                ← CM6 ViewPlugin for syntax highlighting
    ├── navigation.ts            ← CM6 domEventHandlers for Ctrl+Click
    ├── navigation.logic.ts      ← Pure findDefinition() function (testable)
    ├── snippets.ts              ← EditorSuggest + snippet definitions
    ├── outline.ts               ← ItemView for outline panel
    ├── parser.ts                ← Shared ink line parser
    ├── parser.test.ts           ← Node built-in test runner tests for parser
    ├── navigation.logic.test.ts ← Tests for findDefinition()
    └── i18n/
        ├── types.ts             ← TranslationKeys interface
        ├── en.ts                ← English strings
        ├── pl.ts                ← Polish strings
        └── index.ts             ← initLocale() + t(key)
```

### 8.1 Shared Parser (`parser.ts`)

```typescript
export interface InkLine {
  type: "knot" | "stitch" | "function" | "external" | "choice" | "gather"
        | "divert" | "var" | "const" | "temp" | "include" | "comment"
        | "todo" | "text";
  name?: string;   // knots, stitches, functions, externals, named gathers
  line: number;    // 0-indexed
  raw: string;
}

export function parseLine(text: string, lineNumber: number): InkLine;
```

**Named gather detection:** Pattern `/^\s*(-\s*)+\((\w+)\)/` matches `- (label)` and `- - (label)` (spaces between dashes are valid Ink). Must be checked before the generic gather pattern.

### 8.2 Testing

Tests use Node's built-in `node:test` runner with `--experimental-strip-types` (Node 22+, no extra dependencies):

```
npm test
→ node --experimental-strip-types --test src/parser.test.ts src/navigation.logic.test.ts
```

Imports in test files use explicit `.ts` extensions (required by Node ESM strip-types).

### 8.3 Build

Standard Obsidian plugin esbuild setup. Bundle `src/main.ts` → `main.js`. External: `obsidian`, all `@codemirror/*` packages, `electron`, node builtins.

---

## 9. Localization (i18n)

English (default) and Polish translations. Detected from `window.localStorage.getItem("language")` at load time; falls back to `"en"`.

### 9.1 File Structure

```
src/i18n/
├── types.ts    ← TranslationKeys interface (source of truth for required keys)
├── en.ts       ← English strings
├── pl.ts       ← Polish strings
└── index.ts    ← initLocale() + t(key: keyof TranslationKeys): string
```

### 9.2 Translation Keys

`cmd.*` — command palette names
`snippet.*.name`, `snippet.*.desc` — snippet display
`cat.*` — snippet category names
`outline.*` — outline panel labels

Full key list in `src/i18n/types.ts`. All keys are required (TypeScript enforces completeness).

Includes: `cmd.toggle-focus` ("Ink: Toggle Focus Mode" / "Ink: Przełącz tryb skupienia").

### 9.3 Adding New Locales

1. Create `src/i18n/xx.ts` implementing `TranslationKeys`
2. Import and add to the `locales` map in `index.ts`
3. TypeScript will error if any key is missing

---

## 10. CSS Design Principles

All colors use Obsidian CSS variables exclusively — no hardcoded hex values. Works in light and dark themes.

### Two themes

**Normal** (`.ink-theme-normal`): Uses Obsidian's color palette (`--color-yellow`, `--color-orange`, etc.) at moderate intensity. Knot names are yellow/bold, choice bullets are green, diverts are blue, logic is purple, comments are faint/italic.

**Focus** (`.ink-theme-focus`): Inspired by Inky's Focus mode. Narrative text reads at full brightness (default, unclassed). Everything else uses only `--text-faint`, `--text-muted`, or `--text-accent`. The single exception: divert targets use `--text-accent` so they remain distinguishable as navigable links.

Theme is applied as a class on `.cm-editor` (`ink-theme-normal` / `ink-theme-focus`). All syntax CSS is prefixed: `.ink-theme-normal .ink-knot-name { ... }`, `.ink-theme-focus .ink-knot-name { ... }`.

### Key rules

- `[Shown choice text]` (`.ink-choice-suppress`) is player-facing narrative — full brightness in both themes
- Diverts must remain visually distinct — they are navigable links
- No `font-size` changes on inline spans — disrupts monospace horizontal alignment
- Markdown code-block and inline-code backgrounds are suppressed within `.ink-editor`

---

## 11. Edge Cases & Gotchas

1. **Live Preview / Source Mode** — Obsidian defaults to Live Preview, which treats tab-indented text as code blocks. Force Source mode on `active-leaf-change` for all `.ink` leaves.
2. **Outline focus steal** — Clicking the outline panel sets it as the active leaf, firing `active-leaf-change`. Guard: `if (leaf?.view === this) return`. For navigation after click, use `workspace.iterateAllLeaves()` to find the ink editor leaf, not `getActiveViewOfType()`.
3. **CM6 editorAttributes vs classList** — `editorAttributes.compute` re-applies on every state update, overwriting direct `classList` changes. Use a `StateField` + `StateEffect` to make theme changes part of CM state.
4. **Named gathers with spaced dashes** — `- - (label)` uses spaces between dashes (valid Ink). Regex must be `/^\s*(-\s*)+\((\w+)\)/`, not `/^\s*(-+)\s*\((\w+)\)/`.
5. **Ink Player plugin compatibility** — Ink Player reads from `getActiveViewOfType(MarkdownView)`. Our `registerExtensions(["ink"], "markdown")` is a prerequisite for Ink Player to work at all.
6. **Obsidian's native `/` slash commands** — Our EditorSuggest fires on `.ink` files only; no conflict with Obsidian's built-in slash commands.
7. **CM6 decoration ordering** — `RangeSetBuilder` requires decorations sorted by position. Always sort token array before building.
8. **Test file imports** — With `--experimental-strip-types`, Node ESM requires `.ts` extensions in import paths (e.g., `import { parseLine } from "./parser.ts"`). Production esbuild ignores these extensions.

---

## 12. Manifest

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

## 13. Testing Checklist

### File handling
- [ ] `.ink` file opens in Obsidian editor (not as unknown binary)
- [ ] File opens in Source mode (not Live Preview)
- [ ] All text uses monospace font, with no alignment inconsistencies between lines
- [ ] Tab-indented narrative text does NOT appear as a code block

### Syntax highlighting — Normal theme
- [ ] Knot headers (`=== name ===`) — name highlighted, markers faint
- [ ] Stitch headers (`= name`) — name highlighted
- [ ] Choice bullets (`*`, `+`) — colored
- [ ] `[Shown choice text]` — full brightness
- [ ] Diverts (`-> target`) — arrow and target colored, target underlined
- [ ] Variables (`VAR x = 5`) — keyword and name colored
- [ ] Logic braces (`{condition}`) — colored
- [ ] Comments (`//`, `/* */`) — faint italic
- [ ] Highlighting does NOT activate on `.md` files

### Focus theme
- [ ] Toggle via Command Palette applies instantly (no file reload)
- [ ] Toggle via Settings applies instantly
- [ ] All structure/logic text is faint; narrative text is full brightness
- [ ] `[Shown choice text]` is full brightness
- [ ] Divert targets still visually distinct (accent color)

### Ctrl+Click navigation
- [ ] `Ctrl+Click` on knot name jumps to knot definition
- [ ] `Ctrl+Click` on stitch name jumps to correct stitch (local preferred over foreign)
- [ ] `Ctrl+Click` on `knot.stitch` path resolves correctly
- [ ] `Ctrl+Click` on named gather label (`- (label)`, `- - (label)`) jumps to it
- [ ] `Ctrl+Click` on keyword (`VAR`, `END`, etc.) does nothing
- [ ] Scroll position matches setting (Top / 1/4 / Center)

### Slash commands
- [ ] `/` in `.ink` file opens snippet popup
- [ ] Snippet filtering works (typing `/kn` shows "Knot")
- [ ] Snippet insertion places cursor correctly
- [ ] `/` in `.md` file does NOT trigger ink snippets

### Outline panel
- [ ] Opens via ribbon icon and command
- [ ] Shows knots, stitches (nested), functions, externals
- [ ] Clicking a node navigates to correct line without clearing the panel
- [ ] Scroll position matches setting
- [ ] Panel shows placeholder when non-ink file is active
- [ ] Panel updates on edit (debounced ~300ms)

### Settings
- [ ] Scroll position change applies to next navigation immediately
- [ ] Editor theme change applies to open files immediately

### i18n
- [ ] English: commands show "Ink: Insert Knot", snippets show "Knot"
- [ ] Polish: commands show "Ink: Dodaj węzeł", snippets show "Węzeł"
- [ ] Unsupported locale falls back to English
- [ ] Snippet `ink` insertion text is locale-independent

### General
- [ ] Plugin loads/unloads cleanly (no console errors)
- [ ] Works in dark and light Obsidian themes
- [ ] No performance issues on 1000+ line `.ink` files

# Ink Language — Obsidian Plugin

An editor plugin for [inkle's Ink](https://www.inklestudios.com/ink/) scripting language inside Obsidian. Open `.ink` files directly in your vault and get syntax highlighting, smart navigation, snippet insertion, and a structural outline panel.

---

## Overview

An Obsidian community plugin that brings first-class support for **inkle's Ink scripting language** (`.ink` files) into Obsidian. The goal is to give narrative designers and writers a comfortable authoring experience without leaving Obsidian — syntax highlighting, Ctrl+Click navigation, slash-command snippet insertion, command palette actions, a structural outline panel, and configurable editor themes. You can also include Obsidian links in your Ink comments - something that's not possible with the official editor.

We built it for ourselves - all of our project notes and storyline live in a shared Obsidian vault. Now we're sharing it with the community.

**Out of scope:** Story playback/preview (the existing [**Ink Player**](https://github.com/uglyboy-tl/obsidian-ink-player) plugin covers that and it plays nicely with our plugin - the two of them make a perfect duo).

## Inspiration & Credits

This plugin is heavily inspired by **[Inky](https://github.com/inkle/inky)**, inkle's official Ink editor. The two-theme system (Normal / Focus), the outline panel structure, and the overall UX philosophy directly reference Inky's design. Inky and Ink are amazing software created by [inkle](https://www.inklestudios.com/).

## Features

### Syntax Highlighting

`.ink` files are automatically highlighted: knots, stitches, choices, diverts, logic expressions, variables, comments, and more are all visually distinguished.

Two themes are available (switchable at any time):

- **Normal** — uses your Obsidian theme's color palette, toned down relative to a typical code editor
- **Focus** — only narrative text reads at full brightness; all structure, logic, and syntax recede into the background so you can concentrate on the story

Switch themes via **Settings → Ink Language → Editor theme**, or instantly with the command **Ink: Toggle Focus Mode**.

### Ctrl+Click Navigation

Hold `Ctrl` (or `Cmd` on Mac) and click on any knot name, stitch name, divert target, or gather label to jump directly to its definition.

Works with:
- Knot names (`=== my_knot ===`)
- Stitch names (`= my_stitch`)
- Named gather labels (`- (my_label)`, `- - (nested_label)`)
- Variables and constants
- Explicit paths (`knot.stitch`)

### Outline Panel

Open the structural outline of your `.ink` file from the ribbon icon or the command **Ink: Toggle Outline**. The panel shows all knots, stitches, functions, and external declarations, organised hierarchically. Click any entry to jump to that line.

### Snippet Insertion

Type `/` anywhere in an `.ink` file to open the snippet menu. Available snippets cover the full Ink syntax:

| Category | Snippets |
|---|---|
| **Structure** | Knot, Stitch, Function, INCLUDE |
| **Choices** | Choice, Sticky Choice, Choice with Suppress, Labelled, Conditional, Fallback |
| **Flow** | Divert, Divert to END/DONE, Tunnel, Tunnel Return, Thread, Gather, Labelled Gather, Glue |
| **Logic** | VAR, CONST, TEMP, Assignment, If/Else, Switch, EXTERNAL, LIST |
| **Varying Text** | Sequence, Cycle, Shuffle, Once-only, Alternatives |
| **Tags & Comments** | Tag, Line Comment, Block Comment, TODO |

### Commands

All commands are available in the Command Palette (`Ctrl+P` / `Cmd+P`):

| Command | Description |
|---|---|
| Ink: Toggle Outline | Open or close the outline panel |
| Ink: Toggle Focus Mode | Switch between Normal and Focus themes |
| Ink: Insert Knot | Insert `=== knot_name ===` |
| Ink: Insert Stitch | Insert `= stitch_name` |
| Ink: Insert Choice | Insert `* ` |
| Ink: Insert Sticky Choice | Insert `+ ` |
| Ink: Insert Divert | Insert `-> ` |
| Ink: Insert Variable | Insert `VAR variable_name = 0` |
| Ink: Insert Conditional | Insert an if/else block |
| Ink: Wrap in Logic Braces | Wrap selection (or insert `{}`) |

---

## Settings

Open **Settings → Community Plugins → Ink Language**.

| Setting | Options | Description |
|---|---|---|
| **Editor theme** | Normal, Focus | Syntax highlighting style |
| **Navigation scroll position** | Top, 1/4 from top, Center | Where the target line lands after Ctrl+Click or Outline navigation |

---

## Installation

### From the Community Plugin Browser

1. Open Obsidian → Settings → Community Plugins → Browse
2. Search for **Ink Language**
3. Click Install, then Enable

### Manual

1. Download `main.js`, `styles.css`, and `manifest.json` from the latest release
2. Copy them to `<your vault>/.obsidian/plugins/ink-language/`
3. Enable the plugin in Settings → Community Plugins

---

## Language Reference

This plugin supports the full Ink syntax. For language documentation see the [official Ink guide](https://github.com/inkle/ink/blob/master/Documentation/WritingWithInk.md).

---

## AI Disclosure

This plugin was built using AI-assisted specs-driven development with Claude and Gemini. We use AI to build tools and automations for our narrative team, so they can spend more time crafting original stories.

---

## Credits

Built by [**Fables Forge**](https://fablesforge.games). Ink is created by [inkle](https://www.inklestudios.com/).

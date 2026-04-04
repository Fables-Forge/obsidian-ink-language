import {
  Editor,
  EditorPosition,
  EditorSuggest,
  EditorSuggestContext,
  EditorSuggestTriggerInfo,
  TFile,
  App
} from "obsidian";
import { t } from "./i18n";
import { TranslationKeys } from "./i18n/types";

export interface InkSnippet {
  nameKey: keyof TranslationKeys;
  descKey: keyof TranslationKeys;
  catKey: keyof TranslationKeys;
  ink: string;
  cursorOffset?: number; // Defaults to end if undefined
}

export const SNIPPETS: InkSnippet[] = [
  // Structure
  { nameKey: "snippet.knot.name", descKey: "snippet.knot.desc", catKey: "cat.structure", ink: "=== knot_name ===\n", cursorOffset: 4 },
  { nameKey: "snippet.stitch.name", descKey: "snippet.stitch.desc", catKey: "cat.structure", ink: "= stitch_name\n", cursorOffset: 2 },
  { nameKey: "snippet.function.name", descKey: "snippet.function.desc", catKey: "cat.structure", ink: "=== function func_name(param) ===\n~ return param\n", cursorOffset: 13 },
  { nameKey: "snippet.include.name", descKey: "snippet.include.desc", catKey: "cat.structure", ink: "INCLUDE filename.ink\n", cursorOffset: 8 },

  // Choices
  { nameKey: "snippet.choice.name", descKey: "snippet.choice.desc", catKey: "cat.choices", ink: "* Choice text\n  Result text.\n", cursorOffset: 2 },
  { nameKey: "snippet.sticky-choice.name", descKey: "snippet.sticky-choice.desc", catKey: "cat.choices", ink: "+ Sticky choice text\n  Result text.\n", cursorOffset: 2 },
  { nameKey: "snippet.choice-suppress.name", descKey: "snippet.choice-suppress.desc", catKey: "cat.choices", ink: "* \"What did you say?\"[] I asked.\n", cursorOffset: 2 },
  { nameKey: "snippet.labelled-choice.name", descKey: "snippet.labelled-choice.desc", catKey: "cat.choices", ink: "* (label_name) Choice text\n", cursorOffset: 3 },
  { nameKey: "snippet.conditional-choice.name", descKey: "snippet.conditional-choice.desc", catKey: "cat.choices", ink: "* {condition} Conditional choice text\n", cursorOffset: 3 },
  { nameKey: "snippet.fallback-choice.name", descKey: "snippet.fallback-choice.desc", catKey: "cat.choices", ink: "* -> fallback_knot\n", cursorOffset: 5 },

  // Flow
  { nameKey: "snippet.divert.name", descKey: "snippet.divert.desc", catKey: "cat.flow", ink: "-> target_name\n", cursorOffset: 3 },
  { nameKey: "snippet.divert-end.name", descKey: "snippet.divert-end.desc", catKey: "cat.flow", ink: "-> END\n" },
  { nameKey: "snippet.divert-done.name", descKey: "snippet.divert-done.desc", catKey: "cat.flow", ink: "-> DONE\n" },
  { nameKey: "snippet.tunnel.name", descKey: "snippet.tunnel.desc", catKey: "cat.flow", ink: "-> tunnel_name ->\n", cursorOffset: 3 },
  { nameKey: "snippet.tunnel-return.name", descKey: "snippet.tunnel-return.desc", catKey: "cat.flow", ink: "->->\n" },
  { nameKey: "snippet.thread.name", descKey: "snippet.thread.desc", catKey: "cat.flow", ink: "<- thread_name\n", cursorOffset: 3 },
  { nameKey: "snippet.gather.name", descKey: "snippet.gather.desc", catKey: "cat.flow", ink: "- " },
  { nameKey: "snippet.labelled-gather.name", descKey: "snippet.labelled-gather.desc", catKey: "cat.flow", ink: "- (label_name) ", cursorOffset: 3 },
  { nameKey: "snippet.glue.name", descKey: "snippet.glue.desc", catKey: "cat.flow", ink: "<>" },

  // Logic
  { nameKey: "snippet.var.name", descKey: "snippet.var.desc", catKey: "cat.logic", ink: "VAR variable_name = 0\n", cursorOffset: 4 },
  { nameKey: "snippet.const.name", descKey: "snippet.const.desc", catKey: "cat.logic", ink: "CONST CONSTANT_NAME = 0\n", cursorOffset: 6 },
  { nameKey: "snippet.temp.name", descKey: "snippet.temp.desc", catKey: "cat.logic", ink: "~ temp variable_name = 0\n", cursorOffset: 7 },
  { nameKey: "snippet.assignment.name", descKey: "snippet.assignment.desc", catKey: "cat.logic", ink: "~ variable_name = value\n", cursorOffset: 2 },
  { nameKey: "snippet.if-else.name", descKey: "snippet.if-else.desc", catKey: "cat.logic", ink: "{ condition:\n  True branch text.\n- else:\n  False branch text.\n}\n", cursorOffset: 2 },
  { nameKey: "snippet.switch.name", descKey: "snippet.switch.desc", catKey: "cat.logic", ink: "{\n- condition_a:\n  Branch A.\n- condition_b:\n  Branch B.\n- else:\n  Default.\n}\n", cursorOffset: 2 },
  { nameKey: "snippet.external.name", descKey: "snippet.external.desc", catKey: "cat.logic", ink: "EXTERNAL functionName(param)\n", cursorOffset: 9 },
  { nameKey: "snippet.list.name", descKey: "snippet.list.desc", catKey: "cat.logic", ink: "LIST listName = item_a, item_b, item_c\n", cursorOffset: 5 },

  // Varying Text
  { nameKey: "snippet.sequence.name", descKey: "snippet.sequence.desc", catKey: "cat.varying-text", ink: "{stopping: first|second|final}", cursorOffset: 11 },
  { nameKey: "snippet.cycle.name", descKey: "snippet.cycle.desc", catKey: "cat.varying-text", ink: "{cycle: one|two|three}", cursorOffset: 8 },
  { nameKey: "snippet.shuffle.name", descKey: "snippet.shuffle.desc", catKey: "cat.varying-text", ink: "{shuffle: option_a|option_b|option_c}", cursorOffset: 10 },
  { nameKey: "snippet.once.name", descKey: "snippet.once.desc", catKey: "cat.varying-text", ink: "{once: This is shown only the first time.}", cursorOffset: 7 },
  { nameKey: "snippet.alternatives.name", descKey: "snippet.alternatives.desc", catKey: "cat.varying-text", ink: "{first|second|third}", cursorOffset: 1 },

  // Tags & Comments
  { nameKey: "snippet.tag.name", descKey: "snippet.tag.desc", catKey: "cat.tags", ink: "# tag_text", cursorOffset: 2 },
  { nameKey: "snippet.line-comment.name", descKey: "snippet.line-comment.desc", catKey: "cat.tags", ink: "// " },
  { nameKey: "snippet.block-comment.name", descKey: "snippet.block-comment.desc", catKey: "cat.tags", ink: "/*\n * \n */\n", cursorOffset: 6 },
  { nameKey: "snippet.todo.name", descKey: "snippet.todo.desc", catKey: "cat.tags", ink: "// TODO: " },
];

export class InkSuggest extends EditorSuggest<InkSnippet> {
  constructor(app: App) {
    super(app);
  }

  onTrigger(
    cursor: EditorPosition,
    editor: Editor,
    file: TFile | null
  ): EditorSuggestTriggerInfo | null {
    if (file?.extension !== "ink") return null;

    const line = editor.getLine(cursor.line);
    const sub = line.substring(0, cursor.ch);
    // Regex: (^|\s)(\/[\w\s]*)$
    // Matches start of line or space, then / then chars
    const match = sub.match(/(^|\s)(\/([\w\s]*))$/);

    if (match) {
      return {
        start: { line: cursor.line, ch: (match.index ?? 0) + match[1].length }, // position of '/'
        end: cursor,
        query: match[3], // text after '/'
      };
    }
    return null;
  }

  getSuggestions(context: EditorSuggestContext): InkSnippet[] {
    const query = context.query.toLowerCase();

    // Resolve strings and filter
    return SNIPPETS.filter((snippet) => {
      const name = t(snippet.nameKey).toLowerCase();
      const desc = t(snippet.descKey).toLowerCase();
      const cat = t(snippet.catKey).toLowerCase();

      // If query is empty, show all
      if (!query) return true;

      return (
        name.includes(query) ||
        desc.includes(query) ||
        cat.includes(query)
      );
    });
  }

  renderSuggestion(snippet: InkSnippet, el: HTMLElement): void {
    el.addClass("ink-snippet-suggestion");
    const header = el.createDiv({ cls: "ink-snippet-header" });
    header.createSpan({ cls: "ink-snippet-name", text: t(snippet.nameKey) });
    header.createSpan({ cls: "ink-snippet-category", text: t(snippet.catKey) });
    el.createDiv({ cls: "ink-snippet-desc", text: t(snippet.descKey) });
  }

  selectSuggestion(snippet: InkSnippet, _evt: MouseEvent | KeyboardEvent): void {
    if (!this.context) return;

    const { editor, start, end } = this.context;
    const replacement = snippet.ink;

    editor.replaceRange(replacement, start, end);

    // Calculate new cursor position
    const offset = snippet.cursorOffset;
    if (offset !== undefined) {
      // We need to find the position 'offset' chars into the inserted text
      // Handle multi-line insertions
      let line = start.line;
      let ch = start.ch;

      let remaining = offset;
      const lines = replacement.split("\n");

      // If offset is simple (single line replacement)
      if (lines.length === 1) {
          editor.setCursor({ line: line, ch: ch + offset });
      } else {
          // Multiline logic
          // Not strictly necessary to be 100% precise if we trust snippet definitions are simple,
          // but let's be safe.
          // Wait, offset is "number of characters from insertion start".
          // If I insert "A\nB", offset 3.
          // "A" (1) + "\n" (1) + "B" (1).
          // Cursor should be at line+1, ch 1.

          let currentLineIdx = 0;
          while (remaining > 0 && currentLineIdx < lines.length) {
              const len = lines[currentLineIdx].length;
              if (remaining <= len) {
                  ch = (currentLineIdx === 0 ? ch : 0) + remaining;
                  remaining = 0;
              } else {
                  // Consume line + newline
                  remaining -= (len + 1); // +1 for newline
                  line++;
                  ch = 0;
                  currentLineIdx++;
              }
          }
          editor.setCursor({ line, ch });
      }
    } else {
        // End of insertion
        const lines = replacement.split("\n");
        const lastLineLen = lines[lines.length - 1].length;
        if (lines.length === 1) {
             editor.setCursor({ line: start.line, ch: start.ch + lastLineLen });
        } else {
             editor.setCursor({ line: start.line + lines.length - 1, ch: lastLineLen });
        }
    }
  }
}

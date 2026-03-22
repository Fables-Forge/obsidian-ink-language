import { Plugin, WorkspaceLeaf, Editor, MarkdownView } from "obsidian";
import { inkSyntax } from "./syntax";
import { InkSuggest } from "./snippets";
import { InkOutlineView, VIEW_TYPE_OUTLINE } from "./outline";
import { initLocale, t } from "./i18n";

export default class InkPlugin extends Plugin {
  async onload() {
    initLocale();

    // 1. File Registration
    this.registerExtensions(["ink"], "markdown");

    // 2. Syntax Highlighting
    this.registerEditorExtension(inkSyntax);

    // 3. Slash Commands
    this.registerEditorSuggest(new InkSuggest(this.app));

    // 5. Outline Panel
    this.registerView(
      VIEW_TYPE_OUTLINE,
      (leaf) => new InkOutlineView(leaf)
    );

    this.addRibbonIcon("list-tree", t("outline.title"), () => {
      this.toggleView();
    });

    this.addCommand({
      id: "ink:toggle-outline",
      name: t("cmd.toggle-outline"),
      callback: () => {
        this.toggleView();
      }
    });

    // 4. Commands
    this.addCommand({ id: "ink:insert-knot", name: t("cmd.insert-knot"), editorCallback: (editor) => this.insertText(editor, "=== knot_name ===\n", 4, 9) });
    this.addCommand({ id: "ink:insert-stitch", name: t("cmd.insert-stitch"), editorCallback: (editor) => this.insertText(editor, "= stitch_name\n", 2, 11) });
    this.addCommand({ id: "ink:insert-choice", name: t("cmd.insert-choice"), editorCallback: (editor) => this.insertText(editor, "* ", 2) });
    this.addCommand({ id: "ink:insert-sticky-choice", name: t("cmd.insert-sticky-choice"), editorCallback: (editor) => this.insertText(editor, "+ ", 2) });
    this.addCommand({ id: "ink:insert-divert", name: t("cmd.insert-divert"), editorCallback: (editor) => this.insertText(editor, "-> ", 3) });
    this.addCommand({ id: "ink:insert-var", name: t("cmd.insert-var"), editorCallback: (editor) => this.insertText(editor, "VAR variable_name = 0\n", 4, 13) });
    this.addCommand({ id: "ink:insert-conditional", name: t("cmd.insert-conditional"), editorCallback: (editor) => this.insertText(editor, "{\n- \n- else:\n\n}\n", 4) });

    this.addCommand({
      id: "ink:wrap-logic",
      name: t("cmd.wrap-logic"),
      editorCallback: (editor) => {
          const sel = editor.getSelection();
          if (sel) {
              editor.replaceSelection(`{${sel}}`);
          } else {
              this.insertText(editor, "{}", 1);
          }
      }
    });
  }

  async toggleView() {
    const { workspace } = this.app;

    const leaves = workspace.getLeavesOfType(VIEW_TYPE_OUTLINE);
    if (leaves.length > 0) {
       leaves.forEach(l => l.detach());
    } else {
       const rightLeaf = workspace.getRightLeaf(false);
       if (rightLeaf) {
           await rightLeaf.setViewState({ type: VIEW_TYPE_OUTLINE, active: true });
           workspace.revealLeaf(workspace.getLeavesOfType(VIEW_TYPE_OUTLINE)[0]);
       }
    }
  }

  insertText(editor: Editor, text: string, cursorOffset: number, selectionLength?: number) {
      const cursor = editor.getCursor();
      editor.replaceRange(text, cursor);
      const line = cursor.line;
      const ch = cursor.ch + cursorOffset;
      editor.setCursor({ line, ch });
      if (selectionLength) {
          editor.setSelection({ line, ch }, { line, ch: ch + selectionLength });
      }
  }

  onunload() {
      // Obsidian automatically unloads views and extensions
  }
}

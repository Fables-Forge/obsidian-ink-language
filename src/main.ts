import {
  Plugin,
  WorkspaceLeaf,
  Editor,
  MarkdownView,
  PluginSettingTab,
  Setting,
  App,
  editorInfoField,
} from "obsidian";
import { InkSettings, DEFAULT_SETTINGS, applySettings, currentSettings, EditorTheme } from "./settings";
import { EditorView } from "@codemirror/view";
import { StateEffect, StateField } from "@codemirror/state";
import { inkSyntax } from "./syntax";
import { inkNavigation } from "./navigation";
import { InkSuggest } from "./snippets";
import { InkOutlineView, VIEW_TYPE_OUTLINE } from "./outline";
import { initLocale, t } from "./i18n";

// StateEffect + StateField so the theme class is part of CM state,
// not a manual DOM change that gets overwritten on next state update.
const setThemeEffect = StateEffect.define<EditorTheme>();
const themeField = StateField.define<EditorTheme>({
  create: () => currentSettings.editorTheme,
  update: (value, tr) => {
    for (const e of tr.effects) if (e.is(setThemeEffect)) return e.value;
    return value;
  },
});

export default class InkPlugin extends Plugin {
  settings: InkSettings = { ...DEFAULT_SETTINGS };

  async onload() {
    initLocale();
    this.settings = Object.assign({}, DEFAULT_SETTINGS, await this.loadData());
    applySettings(this.settings);
    this.addSettingTab(new InkSettingTab(this.app, this));

    // 1. File Registration
    this.registerExtensions(["ink"], "markdown");

    // 2. Syntax Highlighting
    this.registerEditorExtension(inkSyntax);

    // 2.1 Monospace Font + theme class for Ink files
    this.registerEditorExtension([
      themeField,
      EditorView.editorAttributes.compute([editorInfoField, themeField], (state) => {
        const file = state.field(editorInfoField)?.file;
        if (file && file.extension === "ink") {
          return { class: `ink-editor ink-theme-${state.field(themeField)}` };
        }
        return {};
      }),
    ]);

    // 2.2 Navigation (Ctrl+Click)
    this.registerEditorExtension(inkNavigation);

    // 2.3 Force Source mode for .ink files (Live Preview breaks indented lines as code blocks)
    const forceSourceMode = async (leaf: WorkspaceLeaf | null) => {
      if (!leaf) return;
      const view = leaf.view;
      if (view instanceof MarkdownView && view.file?.extension === "ink") {
        if (view.getMode() !== "source") {
          await view.setMode(view.modes.source);
        }
      }
    };
    this.registerEvent(
      this.app.workspace.on("active-leaf-change", forceSourceMode)
    );
    // Also handle files already open when plugin loads
    void forceSourceMode(this.app.workspace.getMostRecentLeaf());

    // 3. Slash Commands
    this.registerEditorSuggest(new InkSuggest(this.app));

    // 5. Outline Panel
    this.registerView(VIEW_TYPE_OUTLINE, (leaf) => new InkOutlineView(leaf));

    this.addRibbonIcon("list-tree", t("outline.title"), () => {
      void this.toggleView();
    });

    this.addCommand({
      id: "ink:toggle-outline",
      name: t("cmd.toggle-outline"),
      callback: () => {
        void this.toggleView();
      },
    });

    this.addCommand({
      id: "ink:toggle-focus-mode",
      name: t("cmd.toggle-focus"),
      callback: async () => {
        this.settings.editorTheme =
          this.settings.editorTheme === "focus" ? "normal" : "focus";
        await this.saveSettings();
      },
    });

    // 4. Commands
    this.addCommand({
      id: "ink:insert-knot",
      name: t("cmd.insert-knot"),
      editorCallback: (editor) =>
        this.insertText(editor, "=== knot_name ===\n", 4, 9),
    });
    this.addCommand({
      id: "ink:insert-stitch",
      name: t("cmd.insert-stitch"),
      editorCallback: (editor) =>
        this.insertText(editor, "= stitch_name\n", 2, 11),
    });
    this.addCommand({
      id: "ink:insert-choice",
      name: t("cmd.insert-choice"),
      editorCallback: (editor) => this.insertText(editor, "* ", 2),
    });
    this.addCommand({
      id: "ink:insert-sticky-choice",
      name: t("cmd.insert-sticky-choice"),
      editorCallback: (editor) => this.insertText(editor, "+ ", 2),
    });
    this.addCommand({
      id: "ink:insert-divert",
      name: t("cmd.insert-divert"),
      editorCallback: (editor) => this.insertText(editor, "-> ", 3),
    });
    this.addCommand({
      id: "ink:insert-var",
      name: t("cmd.insert-var"),
      editorCallback: (editor) =>
        this.insertText(editor, "VAR variable_name = 0\n", 4, 13),
    });
    this.addCommand({
      id: "ink:insert-conditional",
      name: t("cmd.insert-conditional"),
      editorCallback: (editor) =>
        this.insertText(editor, "{\n- \n- else:\n\n}\n", 4),
    });

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
      },
    });
  }

  async toggleView() {
    const { workspace } = this.app;

    const leaves = workspace.getLeavesOfType(VIEW_TYPE_OUTLINE);
    if (leaves.length > 0) {
      leaves.forEach((l) => l.detach());
    } else {
      const rightLeaf = workspace.getRightLeaf(false);
      if (rightLeaf) {
        await rightLeaf.setViewState({ type: VIEW_TYPE_OUTLINE, active: true });
        await workspace.revealLeaf(workspace.getLeavesOfType(VIEW_TYPE_OUTLINE)[0]);
      }
    }
  }

  insertText(
    editor: Editor,
    text: string,
    cursorOffset: number,
    selectionLength?: number,
  ) {
    const cursor = editor.getCursor();
    editor.replaceRange(text, cursor);
    const line = cursor.line;
    const ch = cursor.ch + cursorOffset;
    editor.setCursor({ line, ch });
    if (selectionLength) {
      editor.setSelection({ line, ch }, { line, ch: ch + selectionLength });
    }
  }

  async saveSettings() {
    await this.saveData(this.settings);
    applySettings(this.settings);
    // Dispatch StateEffect so CM recomputes editorAttributes immediately
    this.app.workspace.iterateAllLeaves((leaf) => {
      const view = leaf.view;
      if (view instanceof MarkdownView && view.file?.extension === "ink") {
        const cm = (view.editor as unknown as { cm?: EditorView }).cm;
        cm?.dispatch({ effects: setThemeEffect.of(this.settings.editorTheme) });
      }
    });
  }

  onunload() {
    // Obsidian automatically unloads views and extensions
  }
}

class InkSettingTab extends PluginSettingTab {
  plugin: InkPlugin;

  constructor(app: App, plugin: InkPlugin) {
    super(app, plugin);
    this.plugin = plugin;
  }

  display() {
    const { containerEl } = this;
    containerEl.empty();

    new Setting(containerEl)
      .setName("Editor theme")
      .setDesc("Normal: full syntax highlighting. Focus: only narrative text is bright, structure recedes.")
      .addDropdown((dd) =>
        dd
          .addOption("normal", "Normal")
          .addOption("focus",  "Focus")
          .setValue(this.plugin.settings.editorTheme)
          .onChange(async (value) => {
            this.plugin.settings.editorTheme = value as InkSettings["editorTheme"];
            await this.plugin.saveSettings();
          })
      );

    new Setting(containerEl)
      .setName("Navigation scroll position")
      .setDesc("Where the target line lands after Ctrl+Click or outline navigation.")
      .addDropdown((dd) =>
        dd
          .addOption("top",     "Top")
          .addOption("quarter", "1/4 from top")
          .addOption("center",  "Center")
          .setValue(this.plugin.settings.scrollPosition)
          .onChange(async (value) => {
            this.plugin.settings.scrollPosition = value as InkSettings["scrollPosition"];
            await this.plugin.saveSettings();
          })
      );
  }
}

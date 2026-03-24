import { ItemView, WorkspaceLeaf, TFile, debounce, MarkdownView, Debouncer } from "obsidian";
import { EditorView } from "@codemirror/view";
import { parseLine, InkLine } from "./parser";
import { t } from "./i18n";
import { getScrollEffect } from "./settings";

export const VIEW_TYPE_OUTLINE = "ink-outline";

export interface OutlineNode {
  type: InkLine["type"];
  name: string;
  line: number;
  children: OutlineNode[];
}

export class InkOutlineView extends ItemView {
  private currentFile: TFile | null = null;
  private nodes: OutlineNode[] = [];
  // Debounced refresh for edits
  private debouncedRefresh: Debouncer<[], void>;

  constructor(leaf: WorkspaceLeaf) {
    super(leaf);
    this.debouncedRefresh = debounce(this.refresh.bind(this), 300, true);
  }

  getViewType() { return VIEW_TYPE_OUTLINE; }
  getDisplayText() { return t("outline.title"); }
  getIcon() { return "list-tree"; }

  onOpen() {
    this.refresh();

    this.registerEvent(this.app.workspace.on("active-leaf-change", (leaf) => {
        // Ignore focus changes caused by clicking inside this outline panel
        if (leaf?.view === this) return;
        this.refresh();
    }));

    this.registerEvent(this.app.workspace.on("editor-change", (_editor, info) => {
        if (info.file?.extension === "ink") {
            this.debouncedRefresh();
        }
    }));
  }

  onClose(): void {
    // Nothing to clean up manually
  }

  refresh() {
    const view = this.app.workspace.getActiveViewOfType(MarkdownView);
    if (!view || view.file?.extension !== "ink") {
      this.currentFile = null;
      this.nodes = [];
      this.render();
      return;
    }

    this.currentFile = view.file;
    const text = view.editor.getValue();
    this.parse(text);
    this.render();
  }

  parse(text: string) {
    const lines = text.split("\n");
    const roots: OutlineNode[] = [];
    let lastKnot: OutlineNode | null = null;

    lines.forEach((lineContent, i) => {
      const parsed = parseLine(lineContent, i);

      if (parsed.type === "knot" && parsed.name) {
        const node: OutlineNode = { type: "knot", name: parsed.name, line: i, children: [] };
        roots.push(node);
        lastKnot = node;
      } else if (parsed.type === "function" && parsed.name) {
        // Functions are roots too (usually)
        const node: OutlineNode = { type: "function", name: parsed.name, line: i, children: [] };
        roots.push(node);
        lastKnot = null; // Stitches inside function? No, stitches are in knots.
      } else if (parsed.type === "stitch" && parsed.name) {
        const node: OutlineNode = { type: "stitch", name: parsed.name, line: i, children: [] };
        if (lastKnot) {
          lastKnot.children.push(node);
        } else {
          // Orphan stitch (or maybe inside a function, but functions don't have stitches usually)
          // Treat as root for visibility
          roots.push(node);
        }
      } else if (parsed.type === "external" && parsed.name) {
        const node: OutlineNode = { type: "external", name: parsed.name, line: i, children: [] };
        roots.push(node);
      }
    });

    this.nodes = roots;
  }

  render() {
    const container = this.containerEl.children[1];
    container.empty();

    if (!this.currentFile || this.nodes.length === 0) {
      container.createEl("div", { text: t("outline.empty"), cls: "ink-outline-empty" });
      return;
    }

    // Group by category for display? Spec 5.3 shows nested tree:
    // Knots (with stitches inside), Functions, Externals separate?
    // Spec 5.3:
    // 📖 Knots
    //   ├── start
    // ...
    // ⚙️ Functions
    // ...
    // 🔌 Externals

    // We need to group roots by type
    const knots = this.nodes.filter(n => n.type === "knot" || n.type === "stitch"); // Orphan stitches in Knots? Or separate?
    // Wait, orphan stitches should probably go into Knots section or "Unparented"
    // Let's just put all knots/stitches in "Knots".
    const functions = this.nodes.filter(n => n.type === "function");
    const externals = this.nodes.filter(n => n.type === "external");

    this.renderSection(container, t("outline.knots"), knots);
    this.renderSection(container, t("outline.functions"), functions);
    this.renderSection(container, t("outline.externals"), externals);
  }

  renderSection(container: Element, title: string, nodes: OutlineNode[]) {
    if (nodes.length === 0) return;

    const sectionHeader = container.createEl("div", { cls: "ink-outline-section-header" });
    sectionHeader.createEl("span", { text: title, cls: "ink-outline-section-title" });

    const list = container.createEl("div", { cls: "ink-outline-list" });

    nodes.forEach(node => {
        this.renderNode(list, node);
    });
  }

  renderNode(container: Element, node: OutlineNode) {
    const item = container.createEl("div", { cls: "ink-outline-item" });
    const line = item.createEl("div", { cls: "ink-outline-item-content" });

    line.createSpan({ cls: `ink-outline-icon ${node.type}` });
    line.createSpan({ text: node.name, cls: "ink-outline-name" });

    line.addEventListener("click", () => {
        this.onNodeClick(node);
    });

    if (node.children.length > 0) {
        const childrenContainer = item.createEl("div", { cls: "ink-outline-children" });
        node.children.forEach(child => this.renderNode(childrenContainer, child));
    }
  }

  onNodeClick(node: OutlineNode) {
      if (!this.currentFile) return;

      // Find the leaf showing currentFile (outline may have stolen focus)
      let targetLeaf: WorkspaceLeaf | null = null;
      this.app.workspace.iterateAllLeaves((leaf) => {
          const view = leaf.view;
          if (view instanceof MarkdownView && view.file === this.currentFile) {
              targetLeaf = leaf;
          }
      });
      if (!targetLeaf) return;

      const view = targetLeaf.view as MarkdownView;
      this.app.workspace.setActiveLeaf(targetLeaf, { focus: true });
      view.editor.setCursor({ line: node.line, ch: 0 });

      const cmView = (view.editor as unknown as { cm?: EditorView }).cm;
      const pos = view.editor.posToOffset({ line: node.line, ch: 0 });
      if (cmView) {
          cmView.dispatch({ effects: getScrollEffect(pos, cmView) });
      } else {
          view.editor.scrollIntoView(
              { from: { line: node.line, ch: 0 }, to: { line: node.line, ch: 0 } },
              true
          );
      }
  }
}

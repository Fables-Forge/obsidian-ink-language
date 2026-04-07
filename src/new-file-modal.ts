import { App, Modal, Notice, TFolder, normalizePath } from "obsidian";
import { t } from "./i18n";

export class NewInkFileModal extends Modal {
  private folder: TFolder;
  private onCreated: (filePath: string) => void;

  constructor(app: App, folder: TFolder, onCreated: (filePath: string) => void) {
    super(app);
    this.folder = folder;
    this.onCreated = onCreated;
  }

  onOpen() {
    const { contentEl } = this;
    contentEl.createEl("h2", { text: t("newfile.modal-title") });

    const errorEl = contentEl.createEl("p", { cls: "ink-newfile-error" });
    errorEl.style.display = "none";

    const input = contentEl.createEl("input", {
      type: "text",
      placeholder: t("newfile.placeholder"),
    });
    input.style.width = "100%";

    const submit = () => void this.submit(input.value, errorEl);
    input.addEventListener("keydown", (e) => { if (e.key === "Enter") submit(); });

    const btnRow = contentEl.createEl("div", { cls: "ink-newfile-actions" });
    btnRow.style.marginTop = "12px";
    const btn = btnRow.createEl("button", {
      text: t("newfile.btn-create"),
      cls: "mod-cta",
    });
    btn.addEventListener("click", submit);

    setTimeout(() => input.focus(), 0);
  }

  onClose() {
    this.contentEl.empty();
  }

  private async submit(rawName: string, errorEl: HTMLElement): Promise<void> {
    const name = rawName.trim();
    if (!name) {
      errorEl.textContent = t("newfile.error-empty");
      errorEl.style.display = "block";
      return;
    }
    const base = this.folder.isRoot() ? "" : this.folder.path;
    const filePath = normalizePath(base ? `${base}/${name}.ink` : `${name}.ink`);
    if (this.app.vault.getAbstractFileByPath(filePath)) {
      errorEl.textContent = t("newfile.error-exists");
      errorEl.style.display = "block";
      return;
    }
    try {
      await this.app.vault.create(filePath, "");
      this.close();
      this.onCreated(filePath);
    } catch (err) {
      new Notice(`Failed to create file: ${String(err)}`);
    }
  }
}

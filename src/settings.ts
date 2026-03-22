import { EditorView } from "@codemirror/view";

export type ScrollPosition = "top" | "quarter" | "center";

export interface InkSettings {
  scrollPosition: ScrollPosition;
}

export const DEFAULT_SETTINGS: InkSettings = {
  scrollPosition: "quarter",
};

// Mutable settings object read at runtime by navigation and outline
export let currentSettings: InkSettings = { ...DEFAULT_SETTINGS };

export function applySettings(settings: InkSettings) {
  currentSettings = settings;
}

/** Returns a CodeMirror scrollIntoView effect for the configured scroll position. */
export function getScrollEffect(pos: number, view: EditorView) {
  const sp = currentSettings.scrollPosition;
  return EditorView.scrollIntoView(pos, {
    y: sp === "center" ? "center" : "start",
    yMargin: sp === "quarter" ? view.dom.clientHeight / 4 : 5,
  });
}

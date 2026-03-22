import { EditorView } from "@codemirror/view";
import { Platform } from "obsidian";
import { findDefinition } from "./navigation.logic";
import { getScrollEffect } from "./settings";

export const inkNavigation = EditorView.domEventHandlers({
  mousedown(event, view) {
    // 1. Check modifier (Ctrl on Win/Linux, Meta on Mac)
    const isMod = Platform.isMacOS ? event.metaKey : event.ctrlKey;
    if (!isMod) return;

    // 2. Get click position
    const pos = view.posAtCoords({ x: event.clientX, y: event.clientY });
    if (pos === null) return;

    // 3. Get word at position
    const doc = view.state.doc;
    const clickLineObj = doc.lineAt(pos);
    const lineText = clickLineObj.text;
    const relativePos = pos - clickLineObj.from;

    const wordPattern = /[\w_.]+/g;
    let match;
    let target = "";

    while ((match = wordPattern.exec(lineText)) !== null) {
      if (
        match.index <= relativePos &&
        match.index + match[0].length >= relativePos
      ) {
        target = match[0];
        break;
      }
    }

    if (!target) return;

    // 4. Collect all lines and find definition
    const allLines: string[] = [];
    for (let i = 1; i <= doc.lines; i++) allLines.push(doc.line(i).text);

    const clickLineIndex = clickLineObj.number - 1; // 0-indexed
    const bestLine = findDefinition(allLines, target, clickLineIndex);

    if (bestLine !== -1) {
      event.preventDefault();
      event.stopPropagation();

      const targetPos = doc.line(bestLine + 1).from;
      view.dispatch({
        selection: { anchor: targetPos },
        effects: getScrollEffect(targetPos, view),
        userEvent: "select.pointer",
      });
    }
  },
});

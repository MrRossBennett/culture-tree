export type AddToTreeShortcutIntent =
  | "stage-top-result"
  | "submit-tray"
  | "remove-last-staged"
  | "close";

export function addToTreeShortcutIntent(input: {
  key: string;
  metaKey?: boolean;
  ctrlKey?: boolean;
  searchValue: string;
  canStageTopResult: boolean;
  canSubmitTray: boolean;
  hasTrayItems: boolean;
}): AddToTreeShortcutIntent | null {
  if (input.key === "Escape") {
    return "close";
  }

  if (input.key === "Enter" && (input.metaKey || input.ctrlKey)) {
    return input.canSubmitTray ? "submit-tray" : null;
  }

  if (input.key === "Enter") {
    return input.canStageTopResult ? "stage-top-result" : null;
  }

  if (input.key === "Backspace" && input.searchValue.length === 0 && input.hasTrayItems) {
    return "remove-last-staged";
  }

  return null;
}

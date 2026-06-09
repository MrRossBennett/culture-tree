import { describe, expect, it } from "vite-plus/test";

import { addToTreeShortcutIntent } from "./add-to-tree-shortcuts";

describe("addToTreeShortcutIntent", () => {
  it("maps Enter to staging the top visible result", () => {
    expect(
      addToTreeShortcutIntent({
        key: "Enter",
        searchValue: "samourai",
        canStageTopResult: true,
        canSubmitTray: false,
        hasTrayItems: false,
      }),
    ).toBe("stage-top-result");
  });

  it("maps Cmd+Enter and Ctrl+Enter to tray submit when the tray can submit", () => {
    expect(
      addToTreeShortcutIntent({
        key: "Enter",
        metaKey: true,
        searchValue: "",
        canStageTopResult: true,
        canSubmitTray: true,
        hasTrayItems: true,
      }),
    ).toBe("submit-tray");
    expect(
      addToTreeShortcutIntent({
        key: "Enter",
        ctrlKey: true,
        searchValue: "",
        canStageTopResult: true,
        canSubmitTray: true,
        hasTrayItems: true,
      }),
    ).toBe("submit-tray");
  });

  it("does not submit the tray when Cmd+Enter is pressed with no submittable tray", () => {
    expect(
      addToTreeShortcutIntent({
        key: "Enter",
        metaKey: true,
        searchValue: "",
        canStageTopResult: true,
        canSubmitTray: false,
        hasTrayItems: false,
      }),
    ).toBeNull();
  });

  it("maps Backspace to removing the last staged Branch only with an empty search", () => {
    expect(
      addToTreeShortcutIntent({
        key: "Backspace",
        searchValue: "",
        canStageTopResult: false,
        canSubmitTray: true,
        hasTrayItems: true,
      }),
    ).toBe("remove-last-staged");
    expect(
      addToTreeShortcutIntent({
        key: "Backspace",
        searchValue: "samourai",
        canStageTopResult: false,
        canSubmitTray: true,
        hasTrayItems: true,
      }),
    ).toBeNull();
  });

  it("maps Escape to close and discard", () => {
    expect(
      addToTreeShortcutIntent({
        key: "Escape",
        searchValue: "",
        canStageTopResult: false,
        canSubmitTray: false,
        hasTrayItems: true,
      }),
    ).toBe("close");
  });
});

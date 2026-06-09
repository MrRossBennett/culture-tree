import { describe, expect, it } from "vite-plus/test";

import { buildPass1Prompt, buildPass2Prompt } from "./prompts";

describe("generation prompts", () => {
  it("requires Join The Dots to be omitted when documented context is weak or absent", () => {
    const prompt = buildPass1Prompt("Station Eleven", { count: "10-14" });

    expect(prompt).toContain("optionally Join The Dots");
    expect(prompt).toContain("direct or documented context");
    expect(prompt).toContain("omit Join The Dots entirely");
  });

  it("keeps Join The Dots optional during improvement passes", () => {
    const prompt = buildPass2Prompt("Station Eleven", {
      seed: "Station Eleven",
      seedType: "root",
      guideSections: [],
      items: [],
    });

    expect(prompt).toContain("optional Join The Dots");
    expect(prompt).toContain("loose interpretation");
  });
});

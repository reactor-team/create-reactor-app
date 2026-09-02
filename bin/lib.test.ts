import { describe, expect, it } from "vitest";
import {
  resolveTemplateFolder,
  formatAvailableModels,
  parseArgs,
} from "./lib.js";

describe("resolveTemplateFolder", () => {
  it("returns the name unchanged when there is no alias", () => {
    expect(resolveTemplateFolder("helios")).toBe("helios");
  });
});

describe("formatAvailableModels", () => {
  it("lists remaining folders sorted, with a placeholder when empty", () => {
    expect(formatAvailableModels(["lingbot", "helios"])).toBe(
      "  helios\n  lingbot"
    );
    expect(formatAvailableModels([])).toBe("  (none)");
  });
});

describe("parseArgs", () => {
  it("parses a project name and --model=<name>", () => {
    expect(parseArgs(["my-app", "--model=helios"])).toEqual({
      help: false,
      projectName: "my-app",
      model: "helios",
    });
  });

  it("parses --model/-m and --token/-t as separate flag+value pairs", () => {
    expect(
      parseArgs(["--model", "lingbot", "my-app", "--token", "ghp_x"])
    ).toEqual({
      help: false,
      projectName: "my-app",
      model: "lingbot",
      token: "ghp_x",
    });
  });

  it("sets help on --help/-h", () => {
    expect(parseArgs(["--help"]).help).toBe(true);
    expect(parseArgs(["-h"]).help).toBe(true);
  });

  it("leaves projectName undefined when no positional arg is given", () => {
    expect(parseArgs(["--model=helios"]).projectName).toBeUndefined();
  });
});

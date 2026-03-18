import { describe, expect, it } from "vitest";
import packageJson from "../package.json";
import { CLI_VERSION } from "./package-info";

describe("CLI_VERSION", () => {
  it("matches package.json version", () => {
    expect(CLI_VERSION).toBe(packageJson.version);
  });
});
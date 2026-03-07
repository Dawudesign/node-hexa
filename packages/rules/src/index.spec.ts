import { describe, it, expect } from "vitest";
import { runRules, computeScore } from "../src/index";
import type { ArchitectureModel, ArchitectureNode } from "@node-hexa/model";

function makeNode(name: string, layer: string, imports: string[] = [], filePath = ""): ArchitectureNode {
  return { name, layer: layer as ArchitectureNode["layer"], kind: "unknown", filePath: filePath || `src/${layer}/${name}.ts`, imports };
}

describe("runRules", () => {
  it("allows infrastructure → domain", () => {
    const model: ArchitectureModel = {
      nodes: [
        makeNode("User", "domain", []),
        makeNode("UserRepository", "infrastructure", ["../../domain/user.ts"]),
      ],
    };
    const violations = runRules(model);
    expect(violations).toHaveLength(0);
  });

  it("allows application → domain", () => {
    const model: ArchitectureModel = {
      nodes: [
        makeNode("User", "domain", []),
        makeNode("CreateUserUseCase", "application", ["../../domain/user.ts"]),
      ],
    };
    const violations = runRules(model);
    expect(violations).toHaveLength(0);
  });

  it("flags domain → infrastructure", () => {
    const model: ArchitectureModel = {
      nodes: [
        makeNode("UserRepository", "infrastructure", [], "src/infrastructure/user.repository.ts"),
        makeNode("User", "domain", ["../../infrastructure/user.repository"]),
      ],
    };
    const violations = runRules(model);
    expect(violations.some((v) => v.message.includes("Domain must not depend on infrastructure"))).toBe(true);
  });

  it("flags domain → application", () => {
    const model: ArchitectureModel = {
      nodes: [
        makeNode("CreateUserUseCase", "application", [], "src/application/create-user.usecase.ts"),
        makeNode("User", "domain", ["../../application/create-user.usecase"]),
      ],
    };
    const violations = runRules(model);
    expect(violations.some((v) => v.message.includes("Domain must not depend on application"))).toBe(true);
  });

  it("flags domain importing @nestjs", () => {
    const model: ArchitectureModel = {
      nodes: [
        makeNode("User", "domain", ["@nestjs/common"]),
      ],
    };
    const violations = runRules(model);
    expect(violations.some((v) => v.message.includes("Domain must not depend on frameworks"))).toBe(true);
  });

  it("flags application → infrastructure", () => {
    const model: ArchitectureModel = {
      nodes: [
        makeNode("UserRepository", "infrastructure", [], "src/infrastructure/user.repository.ts"),
        makeNode("CreateUserUseCase", "application", ["../../infrastructure/user.repository"]),
      ],
    };
    const violations = runRules(model);
    expect(violations.some((v) => v.message.includes("Application must not depend on infrastructure"))).toBe(true);
  });
});

describe("computeScore", () => {
  it("returns 100 for no violations", () => {
    expect(computeScore([])).toEqual({ score: 100, max: 100 });
  });

  it("deducts 25 per critical violation", () => {
    const fakeViolations = new Array(3).fill({ message: "x", node: "y", filePath: "z", severity: "critical" as const });
    expect(computeScore(fakeViolations)).toEqual({ score: 25, max: 100 });
  });

  it("deducts 15 per high violation", () => {
    const fakeViolations = new Array(2).fill({ message: "x", node: "y", filePath: "z", severity: "high" as const });
    expect(computeScore(fakeViolations)).toEqual({ score: 70, max: 100 });
  });

  it("never goes below 0", () => {
    const fakeViolations = new Array(20).fill({ message: "x", node: "y", filePath: "z", severity: "critical" as const });
    expect(computeScore(fakeViolations)).toEqual({ score: 0, max: 100 });
  });
});

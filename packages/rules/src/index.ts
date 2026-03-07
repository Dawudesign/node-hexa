import type { ArchitectureModel, ArchitectureNode } from "@node-hexa/model";

export type ViolationSeverity = "critical" | "high" | "medium";

export type RuleViolation = {
  message: string;
  node: string;
  filePath: string;
  severity: ViolationSeverity;
};

const SEVERITY_PENALTY: Record<ViolationSeverity, number> = {
  critical: 25,
  high: 15,
  medium: 10,
};

function findNodeByImport(
  importPath: string,
  nodes: ArchitectureNode[],
): ArchitectureNode | undefined {
  // Normalize separators, then use endsWith to avoid false positives from shared substrings
  const normalizedImport = importPath.replaceAll("\\", "/").toLowerCase();
  return nodes.find((n) => {
    const filename =
      n.filePath
        .replaceAll("\\", "/")
        .split("/")
        .pop()
        ?.replace(/\.ts$/, "")
        .toLowerCase() ?? "";
    return filename.length > 0 && normalizedImport.endsWith(filename);
  });
}

function isOuterLayer(layer: string): boolean {
  return (
    layer === "infrastructure" ||
    layer === "adapter-in" ||
    layer === "adapter-out"
  );
}

function checkLayerViolation(
  node: ArchitectureNode,
  target: ArchitectureNode,
  violations: RuleViolation[],
): void {
  if (node.layer === "domain" && isOuterLayer(target.layer)) {
    violations.push({
      message: "Domain must not depend on infrastructure",
      node: node.name,
      filePath: node.filePath,
      severity: "critical",
    });
    return;
  }

  if (node.layer === "domain" && target.layer === "application") {
    violations.push({
      message: "Domain must not depend on application",
      node: node.name,
      filePath: node.filePath,
      severity: "critical",
    });
    return;
  }

  if (node.layer === "application" && isOuterLayer(target.layer)) {
    violations.push({
      message: "Application must not depend on infrastructure",
      node: node.name,
      filePath: node.filePath,
      severity: "high",
    });
  }
}

function checkFrameworkViolations(
  node: ArchitectureNode,
  violations: RuleViolation[],
): void {
  if (node.layer !== "domain") return;

  const forbidden = ["@nestjs", "express", "prisma", "mongoose", "typeorm"];

  for (const imp of node.imports) {
    if (forbidden.some((f) => imp.includes(f))) {
      violations.push({
        message: "Domain must not depend on frameworks",
        node: node.name,
        filePath: node.filePath,
        severity: "critical",
      });
      break;
    }
  }
}

export function runRules(
  model: ArchitectureModel,
  strict = true,
): RuleViolation[] {
  const violations: RuleViolation[] = [];

  for (const node of model.nodes) {
    for (const imp of node.imports) {
      const target = findNodeByImport(imp, model.nodes);
      if (target) {
        checkLayerViolation(node, target, violations);
      }
    }

    checkFrameworkViolations(node, violations);
  }

  return strict
    ? violations
    : violations.filter((v) => v.severity !== "medium");
}

export function computeScore(violations: RuleViolation[]) {
  const penalty = violations.reduce(
    (sum, v) => sum + SEVERITY_PENALTY[v.severity],
    0,
  );

  return {
    score: Math.max(100 - penalty, 0),
    max: 100,
  };
}

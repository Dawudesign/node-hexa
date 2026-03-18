import { describe, expect, it } from "vitest";
import {
  computeQualityGate,
  formatAuditCiMessage,
  formatAuditCiViolations,
  formatAuditVscodeDiagnostics,
  isCiFormat,
  isHtmlReportFormat,
  isJsonOutput,
  isVscodeOutput,
  resolveFailUnder,
  serializeAuditReportJson,
  shouldFailQualityGate,
} from "./audit-command";
import type { ArchitectureAuditReport } from "@node-hexa/core";

function makeReport(): ArchitectureAuditReport {
  return {
    score: 72,
    maxScore: 100,
    estimatedTechnicalDebtDays: 1.2,
    categoryScores: {
      dependencyDirection: 20,
      layerIsolation: 20,
      namingConventions: 12,
      folderStructure: 10,
      dddPatterns: 10,
    },
    dddCompliance: "WARNING",
    hexagonalBoundaries: "ERROR",
    dependencyViolations: "ERROR",
    findings: [
      {
        ruleId: "NXH001",
        category: "DEPENDENCY",
        code: "dependency-direction",
        severity: "ERROR",
        message: "Domain depends on infrastructure",
        filePath: "src/contexts/iam/domain/entities/user.entity.ts",
      },
      {
        ruleId: "NXH004",
        category: "DDD",
        code: "missing-port",
        severity: "WARNING",
        message: "Missing port interface",
      },
    ],
    recommendations: ["Create a domain port"],
    config: {
      architecture: { hexagonal: true, ddd: true },
      rules: {
        forbiddenDependencies: ["infra -> domain"],
        enforcePorts: true,
        enforceUseCases: true,
      },
      qualityGate: { minScore: 80 },
    },
  };
}

describe("resolveFailUnder", () => {
  it("uses config default when flag is missing", () => {
    expect(resolveFailUnder(undefined, 80)).toBe(80);
  });

  it("parses numeric flag value", () => {
    expect(resolveFailUnder("75", 80)).toBe(75);
  });

  it("clamps values to 0..100", () => {
    expect(resolveFailUnder("-5", 80)).toBe(0);
    expect(resolveFailUnder("999", 80)).toBe(100);
  });

  it("throws on invalid numeric value", () => {
    expect(() => resolveFailUnder("abc", 80)).toThrowError(/Invalid --fail-under value/);
  });
});

describe("isHtmlReportFormat", () => {
  it("matches html report option case-insensitively", () => {
    expect(isHtmlReportFormat("html")).toBe(true);
    expect(isHtmlReportFormat("HTML")).toBe(true);
  });

  it("returns false for unsupported formats", () => {
    expect(isHtmlReportFormat(undefined)).toBe(false);
    expect(isHtmlReportFormat("json")).toBe(false);
  });
});

describe("isCiFormat", () => {
  it("matches ci format option", () => {
    expect(isCiFormat("ci")).toBe(true);
    expect(isCiFormat("CI")).toBe(true);
  });

  it("returns false for unsupported values", () => {
    expect(isCiFormat(undefined)).toBe(false);
    expect(isCiFormat("table")).toBe(false);
  });
});

describe("isJsonOutput", () => {
  it("matches json output option", () => {
    expect(isJsonOutput("json")).toBe(true);
    expect(isJsonOutput("JSON")).toBe(true);
  });

  it("returns false for unsupported output values", () => {
    expect(isJsonOutput(undefined)).toBe(false);
    expect(isJsonOutput("yaml")).toBe(false);
  });
});

describe("isVscodeOutput", () => {
  it("matches vscode output option", () => {
    expect(isVscodeOutput("vscode")).toBe(true);
    expect(isVscodeOutput("VSCODE")).toBe(true);
  });

  it("returns false for unsupported output values", () => {
    expect(isVscodeOutput(undefined)).toBe(false);
    expect(isVscodeOutput("yaml")).toBe(false);
  });
});

describe("formatAuditCiMessage", () => {
  it("returns github error message when below threshold", () => {
    expect(formatAuditCiMessage(72, 80)).toBe("::error::Architecture score 72 below threshold 80");
  });

  it("returns github notice message when passing threshold", () => {
    expect(formatAuditCiMessage(84, 80)).toBe("::notice::Architecture score 84 meets threshold 80");
  });
});

describe("formatAuditCiViolations", () => {
  it("renders one CI line per violation with rule id", () => {
    const lines = formatAuditCiViolations(makeReport());
    expect(lines).toEqual([
      "::error::NXH001 Domain depends on infrastructure",
      "::warning::NXH004 Missing port interface",
    ]);
  });
});

describe("formatAuditVscodeDiagnostics", () => {
  it("renders one diagnostic line per finding", () => {
    const lines = formatAuditVscodeDiagnostics(makeReport());
    expect(lines).toEqual([
      "src/contexts/iam/domain/entities/user.entity.ts:1:1: error: [NXH001] Domain depends on infrastructure",
      "node-hexa:1:1: warning: [NXH004] Missing port interface",
    ]);
  });

  it("returns single info line when there are no findings", () => {
    const report = makeReport();
    report.findings = [];
    const lines = formatAuditVscodeDiagnostics(report);
    expect(lines).toEqual([
      "node-hexa:1:1: info: [NXH000] No architecture violations detected",
    ]);
  });
});

describe("serializeAuditReportJson", () => {
  it("includes enterprise keys for integrations", () => {
    const serialized = serializeAuditReportJson(makeReport(), {
      schemaVersion: "1.0",
      toolVersion: "0.1.0",
      qualityGateStatus: "FAIL",
      failureReasons: ["LOW_SCORE"],
    });
    const parsed = JSON.parse(serialized) as Record<string, unknown>;

    expect(parsed.schemaVersion).toBe("1.0");
    expect(parsed.toolVersion).toBe("0.1.0");
    expect(parsed.qualityGateStatus).toBe("FAIL");
    expect(Array.isArray(parsed.failureReasons)).toBe(true);
    expect(parsed.score).toBe(72);
    expect(Array.isArray(parsed.violations)).toBe(true);
    expect(Array.isArray(parsed.ruleIds)).toBe(true);
    expect(Array.isArray(parsed.severity)).toBe(true);
    expect(Array.isArray(parsed.severities)).toBe(true);
    expect(Array.isArray(parsed.categories)).toBe(true);
    expect(Array.isArray(parsed.recommendations)).toBe(true);
  });
});

describe("computeQualityGate", () => {
  it("returns FAIL with reasons when score is below threshold", () => {
    const result = computeQualityGate(makeReport(), 80);
    expect(result.qualityGateStatus).toBe("FAIL");
    expect(result.failureReasons).toContain("LOW_SCORE");
  });

  it("returns PASS with empty reasons when no gate failures", () => {
    const report = makeReport();
    report.score = 95;
    report.dddCompliance = "OK";
    report.hexagonalBoundaries = "OK";
    report.dependencyViolations = "OK";
    report.findings = [];

    const result = computeQualityGate(report, 80);
    expect(result.qualityGateStatus).toBe("PASS");
    expect(result.failureReasons).toEqual([]);
  });
});

describe("shouldFailQualityGate", () => {
  it("fails when score is lower than threshold", () => {
    expect(shouldFailQualityGate(79, 80)).toBe(true);
  });

  it("passes when score is equal or above threshold", () => {
    expect(shouldFailQualityGate(80, 80)).toBe(false);
    expect(shouldFailQualityGate(95, 80)).toBe(false);
  });
});
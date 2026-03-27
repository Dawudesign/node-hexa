import type {
  ArchitectureAuditReport,
  AuditBaselineComparison,
  AuditTrend,
} from "@node-hexa/core";

export type AuditCliOptions = {
  failUnder?: string;
  report?: string;
  format?: string;
  output?: string;
  badge?: boolean;
};

function clampScore(value: number): number {
  if (!Number.isFinite(value)) return 0;
  return Math.max(0, Math.min(100, Math.round(value)));
}

export function resolveFailUnder(
  failUnderOption: string | undefined,
  defaultMinScore: number,
): number {
  if (failUnderOption === undefined) {
    return clampScore(defaultMinScore);
  }

  const parsed = Number(failUnderOption);
  if (!Number.isFinite(parsed)) {
    throw new TypeError(`Invalid --fail-under value '${failUnderOption}'. Expected a number between 0 and 100.`);
  }

  return clampScore(parsed);
}

export function isHtmlReportFormat(report: string | undefined): boolean {
  if (!report) return false;
  return report.trim().toLowerCase() === "html";
}

export function isCiFormat(format: string | undefined): boolean {
  if (!format) return false;
  return format.trim().toLowerCase() === "ci";
}

export function isJsonOutput(output: string | undefined): boolean {
  if (!output) return false;
  return output.trim().toLowerCase() === "json";
}

export function isVscodeOutput(output: string | undefined): boolean {
  if (!output) return false;
  return output.trim().toLowerCase() === "vscode";
}

export function formatAuditCiMessage(score: number, threshold: number): string {
  if (score < threshold) {
    return `::error::Architecture score ${score} below threshold ${threshold}`;
  }

  return `::notice::Architecture score ${score} meets threshold ${threshold}`;
}

function ciLevelFromSeverity(severity: ArchitectureAuditReport["findings"][number]["severity"]): "error" | "warning" | "notice" {
  if (severity === "ERROR") return "error";
  if (severity === "WARNING") return "warning";
  return "notice";
}

export function formatAuditCiViolations(report: ArchitectureAuditReport): string[] {
  if (report.findings.length === 0) {
    return ["::notice::No architecture violations detected"];
  }

  return report.findings.map((finding) => {
    const level = ciLevelFromSeverity(finding.severity);
    return `::${level}::${finding.ruleId} ${finding.message}`;
  });
}

function vscodeSeverityFromFinding(
  severity: ArchitectureAuditReport["findings"][number]["severity"],
): "error" | "warning" | "info" {
  if (severity === "ERROR") return "error";
  if (severity === "WARNING") return "warning";
  return "info";
}

export function formatAuditVscodeDiagnostics(report: ArchitectureAuditReport): string[] {
  if (report.findings.length === 0) {
    return ["node-hexa:1:1: info: [NXH000] No architecture violations detected"];
  }

  return report.findings.map((finding) => {
    const file = finding.filePath ?? "node-hexa";
    const severity = vscodeSeverityFromFinding(finding.severity);
    return `${file}:1:1: ${severity}: [${finding.ruleId}] ${finding.message}`;
  });
}

export function shouldFailQualityGate(score: number, threshold: number): boolean {
  return score < threshold;
}

export type QualityGateStatus = "PASS" | "FAIL";

export type FailureReason =
  | "LOW_SCORE"
  | "DDD_VIOLATIONS"
  | "DEPENDENCY_VIOLATIONS"
  | "HEXAGONAL_VIOLATIONS";

export function computeQualityGate(
  report: ArchitectureAuditReport,
  threshold: number,
): {
  qualityGateStatus: QualityGateStatus;
  failureReasons: FailureReason[];
} {
  const failureReasons: FailureReason[] = [];

  if (report.score < threshold) {
    failureReasons.push("LOW_SCORE");
  }

  if (report.dddCompliance === "ERROR") {
    failureReasons.push("DDD_VIOLATIONS");
  }

  if (report.dependencyViolations === "ERROR") {
    failureReasons.push("DEPENDENCY_VIOLATIONS");
  }

  if (report.hexagonalBoundaries === "ERROR") {
    failureReasons.push("HEXAGONAL_VIOLATIONS");
  }

  return {
    qualityGateStatus: failureReasons.length === 0 ? "PASS" : "FAIL",
    failureReasons,
  };
}

function printCategoryStatus(title: string, value: string): void {
  console.log(`${title}: ${value}`);
}

export function printAuditReport(report: ArchitectureAuditReport): void {
  console.log("\nNode Hexa Architecture Report\n");
  console.log(`Architecture score: ${report.score}/${report.maxScore}\n`);
  console.log(`Estimated technical debt: ${report.estimatedTechnicalDebtDays} days\n`);

  const { byContext, topViolations } = report.debtBreakdown;
  const contextEntries = Object.entries(byContext).sort(([, a], [, b]) => b - a);
  if (contextEntries.length > 0) {
    console.log("Debt by context:");
    for (const [ctx, days] of contextEntries) {
      const label = ctx === "__global" ? "(global)" : ctx;
      console.log(`  ${label}: ${days}d`);
    }
    console.log("");
  }

  if (topViolations.length > 0) {
    console.log("Top violations by debt cost:");
    for (const v of topViolations) {
      const file = v.filePath ? ` (${v.filePath})` : "";
      console.log(`  [${v.code}] ${v.debtDays}d — ${v.message}${file}`);
    }
    console.log("");
  }

  printCategoryStatus("DDD compliance", report.dddCompliance);
  printCategoryStatus("Hexagonal boundaries", report.hexagonalBoundaries);
  printCategoryStatus("Dependency violations", report.dependencyViolations);

  console.log("\nDetected problems:\n");
  if (report.findings.length === 0) {
    console.log("- none\n");
  } else {
    for (const finding of report.findings) {
      const header = `[${finding.ruleId}][${finding.severity.toUpperCase()}][${finding.category}]`;
      if (finding.filePath) {
        console.log(`- ${header} ${finding.message} (${finding.filePath})`);
      } else {
        console.log(`- ${header} ${finding.message}`);
      }
    }
    console.log("");
  }

  console.log("Recommendations:\n");
  if (report.recommendations.length === 0) {
    console.log("- no recommendations\n");
  } else {
    for (const recommendation of report.recommendations) {
      console.log(`- ${recommendation}`);
    }
    console.log("");
  }
}

export function printBaselineComparison(comparison: AuditBaselineComparison): void {
  const deltaSign = comparison.delta >= 0 ? "+" : "";

  console.log("Baseline Comparison\n");
  console.log(`New violations: ${comparison.newViolations}`);
  console.log(`Resolved violations: ${comparison.resolvedViolations}`);
  console.log(`Unchanged: ${comparison.unchanged}\n`);
  console.log(`Previous score: ${comparison.previousScore}`);
  console.log(`Current score: ${comparison.currentScore}`);
  console.log(`Improvement: ${deltaSign}${comparison.delta}\n`);
}

export function serializeAuditReportJson(
  report: ArchitectureAuditReport,
  options: {
    schemaVersion: string;
    toolVersion: string;
    qualityGateStatus: QualityGateStatus;
    failureReasons: FailureReason[];
    baselineComparison?: AuditBaselineComparison;
  },
): string {
  const ruleIds = [...new Set(report.findings.map((finding) => finding.ruleId))];
  const severities = [...new Set(report.findings.map((finding) => finding.severity))];
  const categories = [...new Set(report.findings.map((finding) => finding.category))];

  const payload = {
    schemaVersion: options.schemaVersion,
    toolVersion: options.toolVersion,
    score: report.score,
    maxScore: report.maxScore,
    estimatedTechnicalDebtDays: report.estimatedTechnicalDebtDays,
    debtBreakdown: report.debtBreakdown,
    qualityGateStatus: options.qualityGateStatus,
    failureReasons: options.failureReasons,
    violations: report.findings,
    ruleIds,
    severity: severities,
    severities,
    categories,
    recommendations: report.recommendations,
    baselineComparison: options.baselineComparison,
  };

  return JSON.stringify(payload, null, 2);
}
export function printDebtTrend(trend: AuditTrend): void {
  console.log("\nTechnical Debt History\n");

  if (trend.entries.length === 0) {
    console.log("  No history recorded yet. Run with --history to start tracking.\n");
    return;
  }

  const trendIcon = trend.improving ? "↑" : trend.scoreDelta === null ? "—" : "↓";
  const last5 = trend.entries.slice(-5);

  console.log("  Date                  Score   Debt (d)   Violations");
  console.log("  ─────────────────────────────────────────────────────");
  for (const entry of last5) {
    const date = new Date(entry.timestamp).toISOString().slice(0, 16).replace("T", " ");
    console.log(
      `  ${date}    ${String(entry.score).padStart(3)}     ${String(entry.totalDebtDays).padStart(6)}     ${entry.violationCount}`,
    );
  }

  console.log("");

  if (trend.scoreDelta !== null) {
    const sign = trend.scoreDelta >= 0 ? "+" : "";
    console.log(`  Score trend : ${trendIcon} ${sign}${trend.scoreDelta} pts vs previous run`);
  }
  if (trend.debtDelta !== null) {
    const sign = trend.debtDelta <= 0 ? "" : "+";
    console.log(`  Debt trend  : ${sign}${trend.debtDelta}d vs previous run`);
  }
  if (trend.worstContext) {
    console.log(`  Worst context  : ${trend.worstContext}`);
  }
  if (trend.mostImprovedContext) {
    console.log(`  Most improved  : ${trend.mostImprovedContext}`);
  }
  console.log("");
}

import fs from "node:fs";
import path from "node:path";
import type { ArchitectureAuditReport } from "./audit";

export type AuditHistoryEntry = {
  /** ISO timestamp of the audit run. */
  timestamp: string;
  /** Architecture score (0–100). */
  score: number;
  /** Total estimated technical debt in engineer-days. */
  totalDebtDays: number;
  /** Number of findings in the report. */
  violationCount: number;
  /** Debt per bounded context (context name → days). */
  debtByContext: Record<string, number>;
  /** Debt per audit category (category key → days). */
  debtByCategory: Record<string, number>;
};

export type AuditTrend = {
  /** All entries from the history file (oldest first). */
  entries: AuditHistoryEntry[];
  /** Most recent audit entry, or null if no history. */
  latest: AuditHistoryEntry | null;
  /** Second-to-last entry, or null if fewer than 2 runs. */
  previous: AuditHistoryEntry | null;
  /** Score change vs previous run (positive = improving). */
  scoreDelta: number | null;
  /** Debt change vs previous run in days (negative = improving). */
  debtDelta: number | null;
  /** True when score improved vs previous run. */
  improving: boolean;
  /** Context with the highest debt in the latest run. */
  worstContext: string | null;
  /** Context with the largest debt reduction vs the previous run. */
  mostImprovedContext: string | null;
};

const HISTORY_FILENAME = "node-hexa-history.jsonl";

/**
 * Append the current audit result as a new line to node-hexa-history.jsonl.
 * Uses newline-delimited JSON so large histories can be appended without
 * re-parsing the full file.
 *
 * @returns Absolute path to the history file.
 */
export function appendAuditHistory(
  report: ArchitectureAuditReport,
  projectPath: string,
): string {
  const historyPath = path.join(projectPath, HISTORY_FILENAME);
  const entry: AuditHistoryEntry = {
    timestamp: new Date().toISOString(),
    score: report.score,
    totalDebtDays: report.estimatedTechnicalDebtDays,
    violationCount: report.findings.length,
    debtByContext: report.debtBreakdown.byContext,
    debtByCategory: report.debtBreakdown.byCategory,
  };
  fs.appendFileSync(historyPath, JSON.stringify(entry) + "\n", "utf8");
  return historyPath;
}

/** Read all historical audit entries from node-hexa-history.jsonl (oldest first). */
export function readAuditHistory(projectPath: string): AuditHistoryEntry[] {
  const historyPath = path.join(projectPath, HISTORY_FILENAME);
  if (!fs.existsSync(historyPath)) return [];
  return fs
    .readFileSync(historyPath, "utf8")
    .split("\n")
    .filter((line) => line.trim().length > 0)
    .map((line) => JSON.parse(line) as AuditHistoryEntry);
}

/** Compute trend statistics from an ordered list of historical entries. */
export function computeAuditTrend(entries: AuditHistoryEntry[]): AuditTrend {
  if (entries.length === 0) {
    return {
      entries: [],
      latest: null,
      previous: null,
      scoreDelta: null,
      debtDelta: null,
      improving: false,
      worstContext: null,
      mostImprovedContext: null,
    };
  }

  const latest = entries[entries.length - 1]!;
  const previous = entries.length > 1 ? entries[entries.length - 2]! : null;

  const scoreDelta = previous !== null ? latest.score - previous.score : null;
  const debtDelta =
    previous !== null
      ? Number((latest.totalDebtDays - previous.totalDebtDays).toFixed(1))
      : null;
  const improving = scoreDelta !== null ? scoreDelta > 0 : false;

  // Worst context by debt in the latest run
  const worstContext =
    Object.keys(latest.debtByContext).length > 0
      ? (Object.entries(latest.debtByContext).sort(
          ([, a], [, b]) => b - a,
        )[0]?.[0] ?? null)
      : null;

  // Most improved context (biggest debt reduction vs previous run)
  let mostImprovedContext: string | null = null;
  if (previous !== null) {
    let maxImprovement = 0;
    for (const [ctx, prevDebt] of Object.entries(previous.debtByContext)) {
      const currDebt = latest.debtByContext[ctx] ?? 0;
      const improvement = prevDebt - currDebt;
      if (improvement > maxImprovement) {
        maxImprovement = improvement;
        mostImprovedContext = ctx;
      }
    }
  }

  return {
    entries,
    latest,
    previous,
    scoreDelta,
    debtDelta,
    improving,
    worstContext,
    mostImprovedContext,
  };
}

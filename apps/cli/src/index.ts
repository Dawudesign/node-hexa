import { Command } from "commander";

import {
  analyzeProject,
  buildArchitectureAuditReport,
  compareAuditBaseline,
  generateAuditSarif,
  generateAuditBadgeSvg,
  generateMermaidGraph,
  generateDocs,
  generateAuditHtmlReport,
  generateGraphFile,
  detectContexts,
  generateProject,
  generateContext,
  generateUseCase,
  generateAggregate,
  generateDomainEvent,
  generateDemoProject,
  listContexts,
  readAuditBaseline,
  writeAuditBaseline,
  appendAuditHistory,
  readAuditHistory,
  computeAuditTrend,
} from "@node-hexa/core";
import type { RuleViolation, ConfigIssue } from "@node-hexa/core";
import type { ArchitectureNode } from "@node-hexa/model";
import {
  computeQualityGate,
  formatAuditCiMessage,
  formatAuditCiViolations,
  formatAuditVscodeDiagnostics,
  isCiFormat,
  isHtmlReportFormat,
  isJsonOutput,
  isVscodeOutput,
  printBaselineComparison,
  printAuditReport,
  printDebtTrend,
  resolveFailUnder,
  serializeAuditReportJson,
  shouldFailQualityGate,
} from "./audit-command";
import { printDoctorReport, runDoctor } from "./doctor-command";
import { CLI_VERSION } from "./package-info";

// ─── Helpers ─────────────────────────────────────────────────────────────────

function severityBadge(severity: RuleViolation["severity"]): string {
  if (severity === "critical") return "CRITICAL";
  if (severity === "high") return "HIGH";
  return "MEDIUM";
}

function printLayers(nodes: ArchitectureNode[]) {
  const layers = ["domain", "application", "infrastructure", "adapter-in", "adapter-out"];
  for (const layer of layers) {
    const layerNodes = nodes.filter((n) => n.layer === layer);
    if (!layerNodes.length) continue;
    console.log(layer.toUpperCase());
    layerNodes.forEach((n) => console.log(`  ✓ ${n.name} (${n.kind})`));
    console.log("");
  }
}

function printViolations(violations: RuleViolation[], title = "Violations") {
  console.log(`${title}\n`);
  if (!violations.length) {
    console.log(`  ✓ No ${title.toLowerCase()} found\n`);
    return;
  }
  for (const v of violations) {
    console.log(`  ✗ [${severityBadge(v.severity)}] ${v.message} → ${v.node}`);
    console.log(`       File: ${v.filePath}`);
    if (v.suggestion) {
      console.log(`       Fix:  ${v.suggestion}`);
    }
    console.log("");
  }
}

function printConfigIssues(issues: ConfigIssue[]) {
  if (!issues.length) return;
  console.log("Configuration Issues\n");
  for (const issue of issues) {
    const icon = issue.severity === "error" ? "✗" : "⚠";
    console.log(`  ${icon} [${issue.severity.toUpperCase()}] ${issue.message}`);
    console.log(`       Field: ${issue.field}`);
    console.log(`       Fix:   ${issue.suggestion}`);
    console.log("");
  }
}

function printContexts(nodes: ArchitectureNode[]) {
  const contexts = detectContexts(nodes);
  console.log("\nBounded Contexts\n");
  for (const [name, ctxNodes] of Object.entries(contexts)) {
    console.log(name.toUpperCase());
    ctxNodes.forEach((n) => console.log(`  - ${n.name} (${n.kind})`));
    console.log("");
  }
}

function die(message: string, code = 1): never {
  console.error(`✗ ${message}`);
  process.exit(code);
}

function handleError(err: unknown): never {
  die(err instanceof Error ? err.message : String(err), 1);
}

// ─── Commands ────────────────────────────────────────────────────────────────

const program = new Command();

program
  .name("node-hexa")
  .description("Architecture governance CLI for hexagonal DDD projects")
  .version(CLI_VERSION);

program
  .command("analyze")
  .description("Analyze architecture layers, violations and bounded contexts")
  .argument("<path>", "project path")
  .action(async (projectPath: string) => {
    try {
      const result = await analyzeProject(projectPath);
      console.log("\nArchitecture Graph (Mermaid)\n");
      console.log(generateMermaidGraph(result.model));
      printLayers(result.model.nodes);
      printViolations(result.violations, "Architecture Violations");
      printContexts(result.model.nodes);
      console.log("\nArchitecture Score\n");
      console.log(`Score: ${result.score.score}/${result.score.max}\n`);
      console.log("\n───\n");
      printViolations(result.cleanViolations, "Clean Code Violations");
      console.log("Clean Code Score\n");
      console.log(`Score: ${result.cleanScore.score}/${result.cleanScore.max}\n`);
      console.log("\n───\n");
      printViolations(result.greenViolations, "Green Code Violations (Eco-Design)");
      console.log("Green Code Score\n");
      console.log(`Score: ${result.greenScore.score}/${result.greenScore.max}\n`);
      printConfigIssues(result.configIssues);
    } catch (err) {
      handleError(err);
    }
  });

program
  .command("docs")
  .description("Generate architecture.md with Mermaid diagram and violations")
  .argument("<path>", "project path")
  .action(async (projectPath: string) => {
    try {
      const result = await analyzeProject(projectPath);
      generateDocs(result, projectPath);
    } catch (err) {
      handleError(err);
    }
  });

program
  .command("graph")
  .description("Generate architecture.svg dependency graph")
  .argument("<path>", "project path")
  .action(async (projectPath: string) => {
    try {
      const result = await analyzeProject(projectPath);
      const svgFile = generateGraphFile(result);
      console.log(`Architecture graph generated: ${svgFile}`);
    } catch (err) {
      handleError(err);
    }
  });

program
  .command("init")
  .description("Create a new NestJS Hexagonal DDD project")
  .argument("<name>", "project name (lowercase, hyphens allowed)")
  .option("--template <type>", "starter template (api|microservice|event-driven)", "api")
  .option("--ci", "generate CI templates for GitHub Actions and GitLab")
  .action((name: string, options: { template?: string; ci?: boolean }) => {
    try {
      const template = (options.template ?? "api").trim().toLowerCase();
      if (!["api", "microservice", "event-driven"].includes(template)) {
        die(`Unsupported template '${options.template}'. Supported values: api, microservice, event-driven`);
      }

      generateProject(name, {
        template: template as "api" | "microservice" | "event-driven",
        withCi: options.ci ?? false,
      });
    } catch (err) {
      handleError(err);
    }
  });

program
  .command("generate")
  .description("Generate a context, use case, aggregate, or domain event in an existing project")
  .argument("<type>", "context | usecase | aggregate | event")
  .argument("<name>", "resource name (kebab-case)")
  .argument("[context]", "bounded context name (required for usecase and aggregate)")
  .action((type: string, name: string, context: string | undefined) => {
    try {
      if (type === "context") {
        generateContext(name);
      } else if (type === "usecase") {
        if (!context) die("Missing argument: <context> is required for generate usecase.\n  Usage: node-hexa generate usecase <name> <context>");
        generateUseCase(name, context);
        console.log(`✓ Use case '${name}' generated in context '${context}'`);
      } else if (type === "aggregate") {
        if (!context) die("Missing argument: <context> is required for generate aggregate.\n  Usage: node-hexa generate aggregate <name> <context>");
        generateAggregate(name, context);
      } else if (type === "event") {
        if (!context) die("Missing argument: <context> is required for generate event.\n  Usage: node-hexa generate event <name> <context>");
        generateDomainEvent(name, context);
      } else {
        die(`Unknown type: '${type}'. Use context | usecase | aggregate | event`);
      }
    } catch (err) {
      handleError(err);
    }
  });

program
  .command("audit")
  .description("Audit Hexagonal DDD architecture and compute an architecture score")
  .argument("[path]", "project path", ".")
  .option("--fail-under <score>", "fail with exit code 1 when score is lower than threshold")
  .option("--badge", "generate node-hexa-score.svg badge")
  .option("--baseline", "generate node-hexa-baseline.json")
  .option("--compare-baseline", "compare current audit against node-hexa-baseline.json")
  .option("--format <format>", "output format (ci|sarif)")
  .option("--output <type>", "output type (json|vscode)")
  .option("--report <format>", "optional report format (html)")
  .option("--history", "append this run to node-hexa-history.jsonl and show debt trend")
  .action(async (projectPath: string, options: { failUnder?: string; report?: string; badge?: boolean; format?: string; output?: string; baseline?: boolean; compareBaseline?: boolean; history?: boolean }) => {
    try {
      const analysis = await analyzeProject(projectPath);
      const report = buildArchitectureAuditReport(projectPath, {
        model: analysis.model,
        violations: analysis.violations,
      });

      if (options.output && !isJsonOutput(options.output) && !isVscodeOutput(options.output)) {
        die(`Unsupported output type '${options.output}'. Supported values: json, vscode`);
      }

      if (options.format && !["ci", "sarif"].includes(options.format.toLowerCase())) {
        die(`Unsupported format '${options.format}'. Supported values: ci, sarif`);
      }

      const failUnder = resolveFailUnder(options.failUnder, report.config.qualityGate.minScore);
      const qualityGate = computeQualityGate(report, failUnder);
      const toolVersion = CLI_VERSION;

      let baselineComparison: ReturnType<typeof compareAuditBaseline> | undefined;
      if (options.compareBaseline) {
        const baseline = readAuditBaseline(projectPath);
        baselineComparison = compareAuditBaseline(baseline, report);
      }

      if (isJsonOutput(options.output)) {
        console.log(
          serializeAuditReportJson(report, {
            schemaVersion: "1.0",
            toolVersion,
            qualityGateStatus: qualityGate.qualityGateStatus,
            failureReasons: qualityGate.failureReasons,
            baselineComparison,
          }),
        );
      } else if (isVscodeOutput(options.output)) {
        const diagnostics = formatAuditVscodeDiagnostics(report);
        for (const line of diagnostics) {
          console.log(line);
        }
      } else if (options.format?.toLowerCase() === "sarif") {
        console.log(generateAuditSarif(report, toolVersion));
      } else if (isCiFormat(options.format)) {
        const ciLines = formatAuditCiViolations(report);
        for (const line of ciLines) {
          console.log(line);
        }

        const ciSummary = formatAuditCiMessage(report.score, failUnder);
        console.log(ciSummary);

        // GitLab-compatible plain fallback for logs
        if (report.findings.length > 0) {
          for (const finding of report.findings) {
            console.log(`${finding.severity}: ${finding.ruleId} ${finding.message}`);
          }
        } else {
          console.log("INFO: No architecture violations detected");
        }

        if (ciSummary.startsWith("::error::")) {
          console.log(`ERROR: Architecture score ${report.score} below threshold ${failUnder}`);
        } else {
          console.log(`INFO: Architecture score ${report.score} meets threshold ${failUnder}`);
        }
      } else {
        printAuditReport(report);
        if (baselineComparison) {
          printBaselineComparison(baselineComparison);
        }
      }

      if (options.report && !isHtmlReportFormat(options.report)) {
        die(`Unsupported report format '${options.report}'. Supported values: html`);
      }

      if (isHtmlReportFormat(options.report)) {
        const reportPath = generateAuditHtmlReport(report, projectPath);
        console.log(`HTML report generated: ${reportPath}`);
      }

      if (options.badge) {
        const badgePath = generateAuditBadgeSvg(report, projectPath);
        console.log(`Badge generated: ${badgePath}`);
      }

      if (options.baseline) {
        const baselinePath = writeAuditBaseline(report, projectPath);
        console.log(`Baseline generated: ${baselinePath}`);
      }

      if (options.history) {
        const historyPath = appendAuditHistory(report, projectPath);
        console.log(`History appended: ${historyPath}`);
        const entries = readAuditHistory(projectPath);
        const trend = computeAuditTrend(entries);
        printDebtTrend(trend);
      }

      if (shouldFailQualityGate(report.score, failUnder)) {
        console.error(`✗ Quality gate failed: score ${report.score} is below ${failUnder}`);
        process.exit(1);
      }

      process.exit(0);
    } catch (err) {
      handleError(err);
    }
  });

program
  .command("doctor")
  .description("Check local environment readiness for node-hexa usage")
  .argument("[path]", "project path", ".")
  .action((projectPath: string) => {
    try {
      const checks = runDoctor(projectPath);
      printDoctorReport(checks);
      const hasErrors = checks.some((check) => check.status === "error");
      process.exit(hasErrors ? 1 : 0);
    } catch (err) {
      handleError(err);
    }
  });

program
  .command("demo")
  .description("Generate a demo project with good and bad architecture samples")
  .argument("[name]", "demo directory name", "node-hexa-demo")
  .action((name: string) => {
    try {
      const demoPath = generateDemoProject(name);
      console.log(`✓ Demo project generated at ${demoPath}`);
      console.log(`  Next: cd ${name} && npx @dawudesign/node-hexa-cli audit .`);
    } catch (err) {
      handleError(err);
    }
  });

program
  .command("check")
  .description("Check architecture rules — exits 1 on violations, 0 if clean")
  .argument("<path>", "project path")
  .option("-w, --watch", "re-run every 2s")
  .action(async (projectPath: string, options: { watch?: boolean }) => {
    const runCheck = async (): Promise<boolean> => {
      if (options.watch) process.stdout.write("\x1Bc");
      const result = await analyzeProject(projectPath);

      // Config errors are blocking — a misconfigured project cannot be trusted
      const configErrors = result.configIssues.filter((i) => i.severity === "error");
      if (configErrors.length) {
        console.log("\u2717 Configuration errors detected — fix them before running check\n");
        printConfigIssues(result.configIssues);
        return false;
      }

      // Show config warnings non-blocking
      if (result.configIssues.length) printConfigIssues(result.configIssues);

      if (!result.violations.length && !result.cleanViolations.length && !result.greenViolations.length) {
        console.log("✓ All checks passed (architecture, clean code, green code)");
        return true;
      }

      let passed = true;

      if (result.violations.length) {
        passed = false;
        console.log("✗ Architecture violations detected\n");
        for (const v of result.violations) {
          console.log(`  [${severityBadge(v.severity)}] ${v.message} → ${v.node}`);
          console.log(`       File: ${v.filePath}`);
          if (v.suggestion) console.log(`       Fix:  ${v.suggestion}`);
          console.log("");
        }
      }

      if (result.cleanViolations.length) {
        passed = false;
        console.log("✗ Clean code violations detected\n");
        for (const v of result.cleanViolations) {
          console.log(`  [${severityBadge(v.severity)}] ${v.message} → ${v.node}`);
          console.log(`       File: ${v.filePath}`);
          if (v.suggestion) console.log(`       Fix:  ${v.suggestion}`);
          console.log("");
        }
      }

      if (result.greenViolations.length) {
        passed = false;
        console.log("❗ Green code violations detected\n");
        for (const v of result.greenViolations) {
          console.log(`  [${severityBadge(v.severity)}] ${v.message} → ${v.node}`);
          console.log(`       File: ${v.filePath}`);
          if (v.suggestion) console.log(`       Fix:  ${v.suggestion}`);
          console.log("");
        }
      }

      return passed;
    };

    try {
      const passed = await runCheck();
      if (!options.watch) process.exit(passed ? 0 : 1);
    } catch (err: unknown) {
      console.error(`✗ ${err instanceof Error ? err.message : String(err)}`);
      if (!options.watch) process.exit(2);
    }

    if (options.watch) {
      console.log("\nWatching for changes… (Ctrl+C to stop)");
      setInterval(async () => {
        try {
          await runCheck();
        } catch (err: unknown) {
          console.error(`✗ ${err instanceof Error ? err.message : String(err)}`);
        }
      }, 2000);
    }
  });

program
  .command("list")
  .description("List all bounded contexts and their components")
  .argument("<path>", "project path")
  .action((projectPath: string) => {
    try {
      const contexts = listContexts(projectPath);

      if (contexts.length === 0) {
        console.log("No bounded contexts found. Expected: <path>/src/contexts/");
        return;
      }

      console.log(`\nBounded Contexts (${contexts.length})\n`);

      for (const ctx of contexts) {
        console.log(`  ${ctx.name.toUpperCase()}`);
        if (ctx.entities.length) console.log(`    Entities      : ${ctx.entities.join(", ")}`);
        if (ctx.valueObjects.length) console.log(`    Value Objects : ${ctx.valueObjects.join(", ")}`);
        if (ctx.ports.length) console.log(`    Ports         : ${ctx.ports.join(", ")}`);
        if (ctx.useCases.length) console.log(`    Use Cases     : ${ctx.useCases.join(", ")}`);
        if (ctx.domainEvents?.length) console.log(`    Domain Events : ${ctx.domainEvents.join(", ")}`);
        console.log("");
      }
    } catch (err) {
      handleError(err);
    }
  });

program
  .command("history")
  .description("Show technical debt trend from node-hexa-history.jsonl")
  .argument("[path]", "project path", ".")
  .action((projectPath: string) => {
    try {
      const entries = readAuditHistory(projectPath);
      const trend = computeAuditTrend(entries);
      printDebtTrend(trend);
    } catch (err) {
      handleError(err);
    }
  });

program.parse(process.argv);

#!/usr/bin/env node
import { Command } from "commander";
import { checkLicense, activateLicense } from "./license.js";
import {
  analyzeProject,
  generateMermaidGraph,
  generateDocs,
  generateGraphFile,
  detectContexts,
  generateProject,
  generateContext,
  generateUseCase,
  generateAggregate,
  listContexts,
} from "@node-hexa/core";
import type { RuleViolation } from "@node-hexa/core";
import type { ArchitectureNode } from "@node-hexa/model";

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

function printViolations(violations: RuleViolation[]) {
  console.log("Violations\n");
  if (!violations.length) {
    console.log("  ✓ No architecture violations found\n");
    return;
  }
  for (const v of violations) {
    console.log(`  ✗ [${severityBadge(v.severity)}] ${v.message} → ${v.node}`);
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
  .description("Architecture analyzer and scaffolder for NestJS Hexagonal DDD")
  .version(process.env["npm_package_version"] ?? "0.1.0");

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
      printViolations(result.violations);
      printContexts(result.model.nodes);
      console.log("\nArchitecture Score\n");
      console.log(`Score: ${result.score.score}/${result.score.max}\n`);
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
  .action((name: string) => {
    try {
      generateProject(name);
    } catch (err) {
      handleError(err);
    }
  });

program
  .command("generate")
  .description("Generate a context, use case, or aggregate in an existing project")
  .argument("<type>", "context | usecase | aggregate")
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
      } else {
        die(`Unknown type: '${type}'. Use context | usecase | aggregate`);
      }
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

      if (!result.violations.length) {
        console.log("✓ Architecture check passed");
        return true;
      }

      console.log("✗ Architecture violations detected\n");
      result.violations.forEach((v) =>
        console.log(`  [${severityBadge(v.severity)}] ${v.message} → ${v.node}`),
      );
      return false;
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
        console.log("");
      }
    } catch (err) {
      handleError(err);
    }
  });

program
  .command("activate")
  .description("Activate your node-hexa license")
  .argument("<key>", "license key received after purchase")
  .action((key: string) => {
    activateLicense(key);
  });

// Skip license check for the activate command itself
const isActivating = process.argv[2] === "activate";
if (!isActivating) checkLicense();

program.parse(process.argv);

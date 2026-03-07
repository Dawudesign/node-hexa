import { generateMermaidGraph } from "./mermaid";
import fs from "node:fs";
import path from "node:path";
import type { ArchitectureNode } from "@node-hexa/model";
import type { RuleViolation } from "@node-hexa/rules";

type AnalysisResult = {
  model: { nodes: ArchitectureNode[] };
  violations: RuleViolation[];
  score: { score: number; max: number };
};

export function generateDocs(result: AnalysisResult, projectPath?: string): string {
  const graph = generateMermaidGraph(result.model);

  const domain = result.model.nodes.filter((n) => n.layer === "domain");
  const application = result.model.nodes.filter((n) => n.layer === "application");
  const infrastructure = result.model.nodes.filter((n) => n.layer === "infrastructure");

  let doc = "# Architecture Documentation\n\n";

  doc += "## Architecture Diagram\n\n";
  doc += "```mermaid\n";
  doc += graph + "\n";
  doc += "```\n\n";

  doc += "## Domain\n";
  domain.forEach((n) => {
    doc += `- **${n.name}** (${n.kind}) — \`${n.filePath}\`\n`;
  });

  doc += "\n## Application\n";
  application.forEach((n) => {
    doc += `- **${n.name}** (${n.kind}) — \`${n.filePath}\`\n`;
  });

  doc += "\n## Infrastructure\n";
  infrastructure.forEach((n) => {
    doc += `- **${n.name}** (${n.kind}) — \`${n.filePath}\`\n`;
  });

  doc += "\n## Violations\n";

  if (result.violations.length === 0) {
    doc += "- ✓ None\n";
  } else {
    result.violations.forEach((v) => {
      doc += `- ✗ **${v.message}** — \`${v.node}\` (${v.filePath})\n`;
    });
  }

  doc += `\n## Architecture Score\n\n`;
  doc += `**${result.score.score} / ${result.score.max}**\n`;

  if (projectPath) {
    const outputPath = path.join(projectPath, "architecture.md");
    fs.writeFileSync(outputPath, doc);
    console.log(`Architecture documentation generated: ${outputPath}`);
  }

  return doc;
}
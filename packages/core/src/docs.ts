import { generateMermaidGraph } from "./mermaid";
import fs from "node:fs";
import path from "node:path";
import type { ArchitectureNode } from "@node-hexa/model";
import type { RuleViolation } from "@node-hexa/rules";

type AnalysisResult = {
  model: { nodes: ArchitectureNode[] };
  violations: RuleViolation[];
  score: { score: number; max: number };
  cleanViolations?: RuleViolation[];
  cleanScore?: { score: number; max: number };
  greenViolations?: RuleViolation[];
  greenScore?: { score: number; max: number };
};

export function generateDocs(result: AnalysisResult, projectPath?: string): string {
  const graph = generateMermaidGraph(result.model);

  const domain = result.model.nodes.filter((n) => n.layer === "domain");
  const application = result.model.nodes.filter((n) => n.layer === "application");
  const infrastructure = result.model.nodes.filter((n) => n.layer === "infrastructure");
  const adapterIn = result.model.nodes.filter((n) => n.layer === "adapter-in");
  const adapterOut = result.model.nodes.filter((n) => n.layer === "adapter-out");

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

  if (adapterIn.length) {
    doc += "\n## Adapter In (HTTP / Controllers)\n";
    adapterIn.forEach((n) => {
      doc += `- **${n.name}** (${n.kind}) — \`${n.filePath}\`\n`;
    });
  }

  if (adapterOut.length) {
    doc += "\n## Adapter Out (Persistence / Repositories)\n";
    adapterOut.forEach((n) => {
      doc += `- **${n.name}** (${n.kind}) — \`${n.filePath}\`\n`;
    });
  }

  doc += "\n## Violations\n";

  if (result.violations.length === 0) {
    doc += "- ✓ None\n";
  } else {
    result.violations.forEach((v) => {
      doc += `- ✗ **${v.message}** — \`${v.node}\` (${v.filePath})\n`;
    });
  }

  if (result.cleanViolations && result.cleanViolations.length > 0) {
    doc += "\n## Clean Code Violations\n";
    result.cleanViolations.forEach((v) => {
      doc += `- ✗ **${v.message}** — \`${v.node}\` (${v.filePath})\n`;
    });
  }

  if (result.greenViolations && result.greenViolations.length > 0) {
    doc += "\n## Green Code Violations\n";
    result.greenViolations.forEach((v) => {
      doc += `- ✗ **${v.message}** — \`${v.node}\` (${v.filePath})\n`;
    });
  }

  doc += `\n## Scores\n\n`;
  doc += `- Architecture: **${result.score.score} / ${result.score.max}**\n`;
  if (result.cleanScore) {
    doc += `- Clean Code: **${result.cleanScore.score} / ${result.cleanScore.max}**\n`;
  }
  if (result.greenScore) {
    doc += `- Green Code: **${result.greenScore.score} / ${result.greenScore.max}**\n`;
  }

  if (projectPath) {
    const outputPath = path.join(projectPath, "architecture.md");
    fs.writeFileSync(outputPath, doc);
    console.log(`Architecture documentation generated: ${outputPath}`);
  }

  return doc;
}
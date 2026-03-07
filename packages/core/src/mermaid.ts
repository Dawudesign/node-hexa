import type { ArchitectureModel, ArchitectureNode } from "@node-hexa/model";

function generateSubgraph(label: string, nodes: ArchitectureNode[]): string[] {
  if (!nodes.length) return [];
  return [`\nsubgraph ${label}`, ...nodes.map((n) => `  ${n.name}`), "end"];
}

function importsTarget(imp: string, target: ArchitectureNode): boolean {
  const fileBaseName = target.filePath.split("/").pop()?.replace(".ts", "") ?? "";
  if (!fileBaseName) return false;
  const normalizedImp = imp.replace(/\.ts$/, "");
  return normalizedImp === fileBaseName || normalizedImp.endsWith(`/${fileBaseName}`);
}

function generateEdges(nodes: ArchitectureNode[]): string[] {
  const seen = new Set<string>();
  const lines: string[] = [];

  for (const node of nodes) {
    for (const imp of node.imports) {
      for (const target of nodes) {
        if (target === node) continue;
        const edgeKey = `${node.name}-->${target.name}`;
        if (!seen.has(edgeKey) && importsTarget(imp, target)) {
          seen.add(edgeKey);
          lines.push(`${node.name} --> ${target.name}`);
        }
      }
    }
  }

  return lines;
}

export function generateMermaidGraph(model: ArchitectureModel): string {
  const { nodes } = model;

  const byLayer = (layer: string) => nodes.filter((n) => n.layer === layer);

  const subgraphs = [
    ...generateSubgraph("Domain", byLayer("domain")),
    ...generateSubgraph("Application", byLayer("application")),
    ...generateSubgraph('AdapterIn["Adapter In (HTTP)"]', byLayer("adapter-in")),
    ...generateSubgraph('AdapterOut["Adapter Out (Persistence)"]', byLayer("adapter-out")),
    ...generateSubgraph("Infrastructure", byLayer("infrastructure")),
  ];

  return ["flowchart LR", ...subgraphs, ...generateEdges(nodes)].join("\n");
}

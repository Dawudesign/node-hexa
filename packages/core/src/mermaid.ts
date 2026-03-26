import type { ArchitectureModel, ArchitectureNode } from "@node-hexa/model";

/**
 * Derive a Mermaid-safe unique node ID from the file path.
 * Ensures two nodes with the same class name in different contexts
 * are rendered as distinct nodes in the graph.
 */
function nodeId(node: ArchitectureNode): string {
  return node.filePath
    .replace(/\\/g, "/")
    .replace(/\.tsx?$/, "")
    .replace(/[^a-zA-Z0-9]/g, "_")
    .replace(/_{2,}/g, "_")
    .replace(/^_|_$/g, "");
}

function generateSubgraph(label: string, nodes: ArchitectureNode[]): string[] {
  if (!nodes.length) return [];
  return [
    `\nsubgraph ${label}`,
    ...nodes.map((n) => `  ${nodeId(n)}["${n.name}"]`),
    "end",
  ];
}

/**
 * Resolve a relative import specifier from a source file to an absolute-style
 * path, so Mermaid edges are drawn only between nodes that genuinely reference
 * each other — not just nodes that share a filename across different contexts.
 */
function resolveImportPath(imp: string, sourceFilePath: string): string | null {
  if (!imp.startsWith(".")) return null;

  const normalizedImp = imp.replace(/\.(ts|tsx|d\.ts)$/, "");
  const sourceParts = sourceFilePath.replace(/\\/g, "/").split("/");
  sourceParts.pop();

  const impParts = normalizedImp.split("/");
  const combined = [...sourceParts];

  for (const part of impParts) {
    if (part === "..") {
      combined.pop();
    } else if (part !== ".") {
      combined.push(part);
    }
  }

  return combined.join("/");
}

function generateEdges(nodes: ArchitectureNode[]): string[] {
  const seen = new Set<string>();
  const lines: string[] = [];

  for (const node of nodes) {
    for (const imp of node.imports) {
      const resolvedImp = resolveImportPath(imp, node.filePath);
      if (!resolvedImp) continue;

      for (const target of nodes) {
        if (target === node) continue;
        const targetPathNoExt = target.filePath
          .replace(/\\/g, "/")
          .replace(/\.(ts|tsx|d\.ts)$/, "");

        if (
          targetPathNoExt === resolvedImp ||
          targetPathNoExt === resolvedImp + "/index"
        ) {
          const edgeKey = `${nodeId(node)}-->${nodeId(target)}`;
          if (!seen.has(edgeKey)) {
            seen.add(edgeKey);
            lines.push(`${nodeId(node)} --> ${nodeId(target)}`);
          }
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

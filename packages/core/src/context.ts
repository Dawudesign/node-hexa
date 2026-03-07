import type { ArchitectureNode } from "@node-hexa/model";
import path from "node:path";

export interface ContextMap {
  [contextName: string]: ArchitectureNode[];
}

export function detectContexts(nodes: ArchitectureNode[]): ContextMap {
  const contexts: ContextMap = {};

  for (const node of nodes) {
    const parts = path.normalize(node.filePath).split(path.sep);

    const contextIndex = parts.findIndex((p) =>
      ["domain", "application", "infrastructure"].includes(p)
    );

    if (contextIndex <= 0) continue;

    const contextName = parts[contextIndex - 1];

    if (!contexts[contextName]) {
      contexts[contextName] = [];
    }

    contexts[contextName].push(node);
  }

  return contexts;
}
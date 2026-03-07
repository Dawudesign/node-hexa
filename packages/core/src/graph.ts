import { generateMermaidGraph } from "./mermaid";
import fs from "node:fs";
import { execSync } from "node:child_process";
import nodePath from "node:path";
import type { ArchitectureNode } from "@node-hexa/model";
import type { RuleViolation } from "@node-hexa/rules";

function getCandidateChromePaths() {
  const candidates: string[] = [];

  if (process.env.PUPPETEER_EXECUTABLE_PATH) {
    candidates.push(process.env.PUPPETEER_EXECUTABLE_PATH);
  }

  candidates.push(
    "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
    "/Applications/Google Chrome for Testing.app/Contents/MacOS/Google Chrome for Testing"
  );

  const cwdChromeDir = nodePath.join(process.cwd(), "chrome");
  if (fs.existsSync(cwdChromeDir)) {
    const entries = fs.readdirSync(cwdChromeDir, { withFileTypes: true });

    for (const entry of entries) {
      if (!entry.isDirectory()) continue;

      const localCandidate = nodePath.join(
        cwdChromeDir,
        entry.name,
        "chrome-mac-arm64",
        "Google Chrome for Testing.app",
        "Contents",
        "MacOS",
        "Google Chrome for Testing"
      );

      candidates.push(localCandidate);
    }
  }

  return candidates;
}

function resolveChromeExecutablePath() {
  const candidates = getCandidateChromePaths();

  for (const candidate of candidates) {
    if (candidate && fs.existsSync(candidate)) {
      return candidate;
    }
  }

  return undefined;
}

type AnalysisResult = {
  model: { nodes: ArchitectureNode[] };
  violations: RuleViolation[];
  score: { score: number; max: number };
};

export function generateGraphFile(result: AnalysisResult) {
  const graph = generateMermaidGraph(result.model);

  const mermaidFile = "architecture.mmd";
  const svgFile = "architecture.svg";

  fs.writeFileSync(mermaidFile, graph);

  const chromeExecutablePath = resolveChromeExecutablePath();

  execSync(
    ["npx", "mmdc", "-i", mermaidFile, "-o", svgFile].join(" "),
    {
      env: {
        ...process.env,
        ...(chromeExecutablePath
          ? { PUPPETEER_EXECUTABLE_PATH: chromeExecutablePath }
          : {}),
      },
      stdio: "inherit",
    },
  );

  return svgFile;
}
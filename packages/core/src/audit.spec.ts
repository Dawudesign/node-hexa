import { describe, it, expect } from "vitest";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import {
  buildArchitectureAuditReport,
  compareAuditBaseline,
  createAuditBaseline,
  generateAuditSarif,
  generateAuditBadgeSvg,
  loadAuditEngineConfig,
  readAuditBaseline,
  writeAuditBaseline,
} from "./index";
import type { ArchitectureNode } from "@node-hexa/model";
import type { RuleViolation } from "@node-hexa/rules";

function makeNode(
  name: string,
  layer: ArchitectureNode["layer"],
  kind: ArchitectureNode["kind"],
  filePath: string,
  imports: string[] = [],
): ArchitectureNode {
  return { name, layer, kind, filePath, imports };
}

function withTempProject(run: (projectPath: string) => void): void {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "node-hexa-audit-"));
  fs.mkdirSync(path.join(tmp, "src", "contexts", "iam", "domain"), {
    recursive: true,
  });
  fs.mkdirSync(path.join(tmp, "src", "contexts", "iam", "application"), {
    recursive: true,
  });
  fs.mkdirSync(path.join(tmp, "src", "contexts", "iam", "infrastructure"), {
    recursive: true,
  });

  try {
    run(tmp);
  } finally {
    fs.rmSync(tmp, { recursive: true, force: true });
  }
}

describe("buildArchitectureAuditReport", () => {
  it("is deterministic for the same input", () => {
    withTempProject((projectPath) => {
      const nodes: ArchitectureNode[] = [
        makeNode(
          "OrderController",
          "infrastructure",
          "controller",
          path.join(
            projectPath,
            "src/contexts/iam/infrastructure/http/order.controller.ts",
          ),
        ),
        makeNode(
          "OrderRepository",
          "infrastructure",
          "repository",
          path.join(
            projectPath,
            "src/contexts/iam/infrastructure/persistence/order.repository.ts",
          ),
        ),
        makeNode(
          "OrderPort",
          "domain",
          "port",
          path.join(projectPath, "src/contexts/iam/domain/ports/order.port.ts"),
        ),
        makeNode(
          "Order",
          "domain",
          "entity",
          path.join(
            projectPath,
            "src/contexts/iam/domain/entities/order.entity.ts",
          ),
          ["../../infrastructure/persistence/order.repository"],
        ),
      ];

      const violations: RuleViolation[] = [
        {
          message: "Domain must not depend on infrastructure",
          node: "Order",
          filePath: path.join(
            projectPath,
            "src/contexts/iam/domain/entities/order.entity.ts",
          ),
          severity: "critical",
        },
      ];

      const left = buildArchitectureAuditReport(projectPath, {
        model: { nodes },
        violations,
      });
      const right = buildArchitectureAuditReport(projectPath, {
        model: { nodes },
        violations,
      });

      expect(left).toEqual(right);
      expect(left.score).toBeGreaterThanOrEqual(0);
      expect(left.score).toBeLessThanOrEqual(100);
      expect(left.findings).toEqual(right.findings);
    });
  });

  it("detects direct controller -> repository dependency as violation", () => {
    withTempProject((projectPath) => {
      const nodes: ArchitectureNode[] = [
        makeNode(
          "OrderController",
          "infrastructure",
          "controller",
          path.join(
            projectPath,
            "src/contexts/iam/infrastructure/http/order.controller.ts",
          ),
          ["../persistence/order.repository"],
        ),
        makeNode(
          "OrderRepository",
          "infrastructure",
          "repository",
          path.join(
            projectPath,
            "src/contexts/iam/infrastructure/persistence/order.repository.ts",
          ),
        ),
      ];

      const report = buildArchitectureAuditReport(projectPath, {
        model: { nodes },
        violations: [],
      });

      expect(
        report.findings.some((finding) =>
          finding.message.includes(
            "Controller directly depends on repository implementation",
          ),
        ),
      ).toBe(true);
      expect(report.dddCompliance).toBe("ERROR");
    });
  });

  it("detects missing ports and use cases when enforced", () => {
    withTempProject((projectPath) => {
      const nodes: ArchitectureNode[] = [
        makeNode(
          "OrderController",
          "infrastructure",
          "controller",
          path.join(
            projectPath,
            "src/contexts/iam/infrastructure/http/order.controller.ts",
          ),
        ),
      ];

      const report = buildArchitectureAuditReport(projectPath, {
        model: { nodes },
        violations: [],
      });

      expect(
        report.findings.some((f) => f.message.includes("has no domain port")),
      ).toBe(true);
      expect(
        report.findings.some((f) =>
          f.message.includes("has controller(s) but no use case"),
        ),
      ).toBe(true);
      expect(report.findings.every((f) => f.ruleId.startsWith("NXH"))).toBe(
        true,
      );
      expect(report.findings.every((f) => Boolean(f.category))).toBe(true);
      expect(report.estimatedTechnicalDebtDays).toBeGreaterThan(0);
      expect(report.findings.some((f) => f.category === "DDD")).toBe(true);
    });
  });

  it("computes technical debt with ERROR/WARNING/INFO formula", () => {
    withTempProject((projectPath) => {
      const report = buildArchitectureAuditReport(projectPath, {
        model: {
          nodes: [
            makeNode(
              "OrdersHttp",
              "infrastructure",
              "controller",
              path.join(
                projectPath,
                "src/contexts/iam/infrastructure/http/orders-http.ts",
              ),
            ),
          ],
        },
        violations: [],
      });

      // Expected findings: missing-port (ERROR), missing-usecase (ERROR), missing-entity (WARNING), controller-name (INFO)
      expect(report.estimatedTechnicalDebtDays).toBe(1.3);
      expect(
        report.findings.some((finding) => finding.severity === "INFO"),
      ).toBe(true);
      expect(
        report.findings.some(
          (finding) =>
            finding.category === "HEXAGONAL" || finding.category === "DDD",
        ),
      ).toBe(true);
    });
  });

  it("stays under 2 seconds for medium synthetic projects", () => {
    withTempProject((projectPath) => {
      const nodeCount = 600;
      const nodes: ArchitectureNode[] = [];

      for (let i = 0; i < nodeCount; i += 1) {
        nodes.push(
          makeNode(
            `Order${i}`,
            "domain",
            "entity",
            path.join(
              projectPath,
              `src/contexts/iam/domain/entities/order-${i}.entity.ts`,
            ),
          ),
        );
      }

      const start = Date.now();
      const report = buildArchitectureAuditReport(projectPath, {
        model: { nodes },
        violations: [],
      });
      const elapsedMs = Date.now() - start;

      expect(report.score).toBeGreaterThanOrEqual(0);
      expect(elapsedMs).toBeLessThan(2000);
    });
  });

  it("supports config-level ignoredRules suppression", () => {
    withTempProject((projectPath) => {
      fs.writeFileSync(
        path.join(projectPath, "node-hexa.config.ts"),
        `export default {
  rules: {
    ignoredRules: ["NXH012"]
  }
};\n`,
      );

      const report = buildArchitectureAuditReport(projectPath, {
        model: {
          nodes: [
            makeNode(
              "OrderController",
              "infrastructure",
              "controller",
              path.join(
                projectPath,
                "src/contexts/iam/infrastructure/http/order.controller.ts",
              ),
            ),
          ],
        },
        violations: [],
      });

      expect(
        report.findings.some((finding) => finding.ruleId === "NXH012"),
      ).toBe(false);
    });
  });

  it("supports inline node-hexa-ignore suppression", () => {
    withTempProject((projectPath) => {
      const filePath = path.join(
        projectPath,
        "src/contexts/iam/domain/entities/user.entity.ts",
      );
      fs.mkdirSync(path.dirname(filePath), { recursive: true });
      fs.writeFileSync(
        filePath,
        `// node-hexa-ignore NXH001\nexport class UserEntity {}\n`,
      );

      const report = buildArchitectureAuditReport(projectPath, {
        model: {
          nodes: [
            makeNode("UserEntity", "domain", "entity", filePath, [
              "../../infrastructure/persistence/user.repository",
            ]),
            makeNode(
              "UserRepository",
              "infrastructure",
              "repository",
              path.join(
                projectPath,
                "src/contexts/iam/infrastructure/persistence/user.repository.ts",
              ),
            ),
          ],
        },
        violations: [
          {
            message: "Domain must not depend on infrastructure",
            node: "UserEntity",
            filePath,
            severity: "critical",
          },
        ],
      });

      expect(
        report.findings.some((finding) => finding.ruleId === "NXH001"),
      ).toBe(false);
    });
  });

  it("generates an SVG badge file", () => {
    withTempProject((projectPath) => {
      const report = buildArchitectureAuditReport(projectPath, {
        model: {
          nodes: [
            makeNode(
              "OrderController",
              "infrastructure",
              "controller",
              path.join(
                projectPath,
                "src/contexts/iam/infrastructure/http/order.controller.ts",
              ),
            ),
          ],
        },
        violations: [],
      });

      const badgePath = generateAuditBadgeSvg(report, projectPath);
      expect(fs.existsSync(badgePath)).toBe(true);
      const badgeContent = fs.readFileSync(badgePath, "utf8");
      expect(badgeContent).toContain("<svg");
      expect(badgeContent).toContain("Node Hexa Architecture Score");
      expect(badgeContent).toContain(`${report.score}/${report.maxScore}`);
    });
  });
});

describe("loadAuditEngineConfig", () => {
  it("loads node-hexa.config.ts and overrides defaults", () => {
    withTempProject((projectPath) => {
      fs.writeFileSync(
        path.join(projectPath, "node-hexa.config.ts"),
        `export default {
  architecture: { hexagonal: true, ddd: true },
  rules: {
    forbiddenDependencies: ["controller -> repository"],
    enforcePorts: true,
    enforceUseCases: false,
  },
  qualityGate: { minScore: 72 },
};\n`,
      );

      const config = loadAuditEngineConfig(projectPath);
      expect(config.qualityGate.minScore).toBe(72);
      expect(config.rules.enforceUseCases).toBe(false);
      expect(config.rules.forbiddenDependencies).toContain(
        "controller -> repository",
      );
    });
  });
});

describe("baseline and sarif", () => {
  it("writes and reads baseline file", () => {
    withTempProject((projectPath) => {
      const report = buildArchitectureAuditReport(projectPath, {
        model: {
          nodes: [
            makeNode(
              "OrderController",
              "infrastructure",
              "controller",
              path.join(
                projectPath,
                "src/contexts/iam/infrastructure/http/order.controller.ts",
              ),
            ),
          ],
        },
        violations: [],
      });

      const pathWritten = writeAuditBaseline(report, projectPath);
      expect(fs.existsSync(pathWritten)).toBe(true);

      const loaded = readAuditBaseline(projectPath);
      expect(loaded.score).toBe(report.score);
      expect(Array.isArray(loaded.ruleIds)).toBe(true);
      expect(typeof loaded.timestamp).toBe("string");
    });
  });

  it("compares baseline with current report and returns score delta", () => {
    withTempProject((projectPath) => {
      const previous = createAuditBaseline({
        score: 68,
        maxScore: 100,
        estimatedTechnicalDebtDays: 1,
        categoryScores: {
          dependencyDirection: 20,
          layerIsolation: 18,
          namingConventions: 10,
          folderStructure: 10,
          dddPatterns: 10,
        },
        dddCompliance: "WARNING",
        hexagonalBoundaries: "WARNING",
        dependencyViolations: "WARNING",
        findings: [
          {
            ruleId: "NXH001",
            category: "DEPENDENCY",
            code: "dependency-direction",
            severity: "ERROR",
            message: "Domain depends on infrastructure",
            filePath: "src/contexts/iam/domain/entities/user.entity.ts",
          },
        ],
        recommendations: ["Use ports"],
        config: loadAuditEngineConfig(projectPath),
      });

      const current = buildArchitectureAuditReport(projectPath, {
        model: {
          nodes: [],
        },
        violations: [],
      });

      const comparison = compareAuditBaseline(previous, current);
      expect(comparison.previousScore).toBe(68);
      expect(comparison.currentScore).toBe(current.score);
      expect(comparison.delta).toBe(current.score - 68);
    });
  });

  it("generates SARIF 2.1.0 payload with required fields", () => {
    withTempProject((projectPath) => {
      const report = buildArchitectureAuditReport(projectPath, {
        model: {
          nodes: [
            makeNode(
              "OrderController",
              "infrastructure",
              "controller",
              path.join(
                projectPath,
                "src/contexts/iam/infrastructure/http/order.controller.ts",
              ),
            ),
          ],
        },
        violations: [],
      });

      const sarifString = generateAuditSarif(report, "0.1.0");
      const sarif = JSON.parse(sarifString) as Record<string, unknown>;

      expect(sarif.version).toBe("2.1.0");
      const runs = sarif.runs as Array<Record<string, unknown>>;
      expect(Array.isArray(runs)).toBe(true);
      const firstRun = runs[0];
      const results = firstRun.results as Array<Record<string, unknown>>;
      expect(Array.isArray(results)).toBe(true);
      if (results.length > 0) {
        const firstResult = results[0];
        expect(typeof firstResult.ruleId).toBe("string");
        expect(typeof firstResult.level).toBe("string");
        expect(
          typeof (firstResult.message as Record<string, unknown>).text,
        ).toBe("string");
      }
    });
  });
});

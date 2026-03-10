import { describe, it, expect } from "vitest";
import { runRules, computeScore, runCleanCodeRules, runGreenCodeRules } from "../src/index";
import type { ArchitectureModel, ArchitectureNode, NodeMetrics } from "@node-hexa/model";

function makeNode(name: string, layer: string, imports: string[] = [], filePath = ""): ArchitectureNode {
  return { name, layer: layer as ArchitectureNode["layer"], kind: "unknown", filePath: filePath || `src/${layer}/${name}.ts`, imports };
}

function makeTypedNode(
  name: string,
  layer: ArchitectureNode["layer"],
  kind: ArchitectureNode["kind"],
  filePath: string,
  imports: string[] = [],
): ArchitectureNode {
  return { name, layer, kind, filePath, imports };
}

describe("runRules", () => {
  it("allows infrastructure → domain", () => {
    const model: ArchitectureModel = {
      nodes: [
        makeNode("User", "domain", []),
        makeNode("UserRepository", "infrastructure", ["../domain/User"]),
      ],
    };
    const violations = runRules(model);
    expect(violations).toHaveLength(0);
  });

  it("allows application → domain", () => {
    const model: ArchitectureModel = {
      nodes: [
        makeNode("User", "domain", []),
        makeNode("CreateUserUseCase", "application", ["../domain/User"]),
      ],
    };
    const violations = runRules(model);
    expect(violations).toHaveLength(0);
  });

  it("flags domain → infrastructure", () => {
    const model: ArchitectureModel = {
      nodes: [
        makeNode("UserRepository", "infrastructure", [], "src/infrastructure/user.repository.ts"),
        makeNode("User", "domain", ["../infrastructure/user.repository"]),
      ],
    };
    const violations = runRules(model);
    expect(violations.some((v) => v.message.includes("Domain must not depend on infrastructure"))).toBe(true);
  });

  it("flags domain → application", () => {
    const model: ArchitectureModel = {
      nodes: [
        makeNode("CreateUserUseCase", "application", [], "src/application/create-user.usecase.ts"),
        makeNode("User", "domain", ["../application/create-user.usecase"]),
      ],
    };
    const violations = runRules(model);
    expect(violations.some((v) => v.message.includes("Domain must not depend on application"))).toBe(true);
  });

  it("flags domain importing @nestjs", () => {
    const model: ArchitectureModel = {
      nodes: [
        makeNode("User", "domain", ["@nestjs/common"]),
      ],
    };
    const violations = runRules(model);
    expect(violations.some((v) => v.message.includes("Domain must not depend on frameworks"))).toBe(true);
  });

  it("flags application → infrastructure", () => {
    const model: ArchitectureModel = {
      nodes: [
        makeNode("UserRepository", "infrastructure", [], "src/infrastructure/user.repository.ts"),
        makeNode("CreateUserUseCase", "application", ["../infrastructure/user.repository"]),
      ],
    };
    const violations = runRules(model);
    expect(violations.some((v) => v.message.includes("Application must not depend on infrastructure"))).toBe(true);
  });
});

describe("computeScore", () => {
  it("returns 100 for no violations", () => {
    expect(computeScore([])).toEqual({ score: 100, max: 100 });
  });

  it("deducts 25 per critical violation", () => {
    const fakeViolations = new Array(3).fill({ message: "x", node: "y", filePath: "z", severity: "critical" as const });
    expect(computeScore(fakeViolations)).toEqual({ score: 25, max: 100 });
  });

  it("deducts 15 per high violation", () => {
    const fakeViolations = new Array(2).fill({ message: "x", node: "y", filePath: "z", severity: "high" as const });
    expect(computeScore(fakeViolations)).toEqual({ score: 70, max: 100 });
  });

  it("never goes below 0", () => {
    const fakeViolations = new Array(20).fill({ message: "x", node: "y", filePath: "z", severity: "critical" as const });
    expect(computeScore(fakeViolations)).toEqual({ score: 0, max: 100 });
  });
});

// ─── checkMisplacement ────────────────────────────────────────────────────────

describe("checkMisplacement", () => {
  it("flags entity in infrastructure layer", () => {
    const model: ArchitectureModel = {
      nodes: [
        makeTypedNode("UserEntity", "infrastructure", "entity", "src/infrastructure/persistence/user.entity.ts"),
      ],
    };
    const violations = runRules(model);
    expect(violations.some((v) => v.message.includes("Entity must live in domain layer"))).toBe(true);
  });

  it("flags value-object in application layer", () => {
    const model: ArchitectureModel = {
      nodes: [
        makeTypedNode("EmailVo", "application", "value-object", "src/application/email.vo.ts"),
      ],
    };
    const violations = runRules(model);
    expect(violations.some((v) => v.message.includes("Value object must live in domain layer"))).toBe(true);
  });

  it("flags port in infrastructure layer", () => {
    const model: ArchitectureModel = {
      nodes: [
        makeTypedNode("UserRepositoryPort", "infrastructure", "port", "src/infrastructure/user.repository.port.ts"),
      ],
    };
    const violations = runRules(model);
    expect(violations.some((v) => v.message.includes("Port (interface) must live in domain layer"))).toBe(true);
  });

  it("flags use-case in domain layer", () => {
    const model: ArchitectureModel = {
      nodes: [
        makeTypedNode("CreateUserUseCase", "domain", "use-case", "src/domain/create-user.usecase.ts"),
      ],
    };
    const violations = runRules(model);
    expect(violations.some((v) => v.message.includes("UseCase must live in application layer"))).toBe(true);
  });

  it("flags use-case in infrastructure layer", () => {
    const model: ArchitectureModel = {
      nodes: [
        makeTypedNode("CreateUserUseCase", "infrastructure", "use-case", "src/infrastructure/http/create-user.usecase.ts"),
      ],
    };
    const violations = runRules(model);
    expect(violations.some((v) => v.message.includes("UseCase must live in application layer"))).toBe(true);
  });

  it("flags controller in domain layer", () => {
    const model: ArchitectureModel = {
      nodes: [
        makeTypedNode("UserController", "domain", "controller", "src/domain/user.controller.ts"),
      ],
    };
    const violations = runRules(model);
    expect(violations.some((v) => v.message.includes("Controller must not live in domain layer"))).toBe(true);
  });

  it("flags repository implementation in domain layer", () => {
    const model: ArchitectureModel = {
      nodes: [
        makeTypedNode("InMemoryUserRepository", "domain", "repository", "src/domain/in-memory-user.repository.ts"),
      ],
    };
    const violations = runRules(model);
    expect(violations.some((v) => v.message.includes("Repository implementation must not live in domain layer"))).toBe(true);
  });

  it("flags NestJS module in domain layer", () => {
    const model: ArchitectureModel = {
      nodes: [
        makeTypedNode("IamModule", "domain", "module", "src/contexts/iam/domain/iam.module.ts"),
      ],
    };
    const violations = runRules(model);
    expect(violations.some((v) => v.message.includes("NestJS Module"))).toBe(true);
  });

  it("flags NestJS module in application layer", () => {
    const model: ArchitectureModel = {
      nodes: [
        makeTypedNode("IamModule", "application", "module", "src/contexts/iam/application/iam.module.ts"),
      ],
    };
    const violations = runRules(model);
    expect(violations.some((v) => v.message.includes("NestJS Module"))).toBe(true);
  });

  it("does not flag entity correctly placed in domain", () => {
    const model: ArchitectureModel = {
      nodes: [
        makeTypedNode("UserEntity", "domain", "entity", "src/contexts/iam/domain/entities/user.entity.ts"),
      ],
    };
    const violations = runRules(model);
    expect(violations.filter((v) => v.message.includes("Entity"))).toHaveLength(0);
  });

  it("does not flag module correctly placed at context root (unknown layer)", () => {
    const model: ArchitectureModel = {
      nodes: [
        makeTypedNode("IamModule", "unknown", "module", "src/contexts/iam/iam.module.ts"),
      ],
    };
    const violations = runRules(model);
    expect(violations.filter((v) => v.message.includes("NestJS Module"))).toHaveLength(0);
  });

  it("violation includes a suggestion", () => {
    const model: ArchitectureModel = {
      nodes: [
        makeTypedNode("CreateUserUseCase", "domain", "use-case", "src/domain/create-user.usecase.ts"),
      ],
    };
    const violations = runRules(model);
    const v = violations.find((v) => v.message.includes("UseCase"));
    expect(v?.suggestion).toBeDefined();
    expect(v?.suggestion?.length).toBeGreaterThan(0);
  });

  it("flags repository with kind=unknown when placed in domain/persistence/ directory", () => {
    // A class not named *Repository but placed in a persistence/ folder under domain
    const model: ArchitectureModel = {
      nodes: [
        makeTypedNode("UserDataAccess", "domain", "unknown", "src/contexts/iam/domain/persistence/user.data-access.ts"),
      ],
    };
    const violations = runRules(model);
    expect(violations.some((v) => v.message.includes("Repository implementation must not live in domain layer"))).toBe(true);
  });

  it("does not flag kind=unknown node whose path gives no location hint", () => {
    const model: ArchitectureModel = {
      nodes: [
        makeTypedNode("SomeHelper", "domain", "unknown", "src/contexts/iam/domain/helpers/some.helper.ts"),
      ],
    };
    const violations = runRules(model);
    expect(violations.filter((v) => v.message.includes("must live in") || v.message.includes("must not live in"))).toHaveLength(0);
  });
});

// ─── checkCrossContextImport ──────────────────────────────────────────────────

describe("checkCrossContextImport", () => {
  it("flags direct cross-context import of a non-port", () => {
    const model: ArchitectureModel = {
      nodes: [
        makeTypedNode(
          "User",
          "domain",
          "entity",
          "src/contexts/iam/domain/entities/user.entity.ts",
        ),
        makeTypedNode(
          "CreateOrderUseCase",
          "application",
          "use-case",
          // Relative path that actually resolves to the iam/domain/entities/user.entity node:
          // from src/contexts/orders/application/use-cases/ → ../../../iam/domain/entities/user.entity
          "src/contexts/orders/application/use-cases/create-order.usecase.ts",
          ["../../../iam/domain/entities/user.entity"],
        ),
      ],
    };
    const violations = runRules(model);
    expect(violations.some((v) => v.message.includes("Cross-context dependency"))).toBe(true);
  });

  it("allows cross-context import of a domain port", () => {
    const model: ArchitectureModel = {
      nodes: [
        makeTypedNode(
          "UserRepositoryPort",
          "domain",
          "port",
          "src/contexts/iam/domain/ports/user.repository.port.ts",
        ),
        makeTypedNode(
          "CreateOrderUseCase",
          "application",
          "use-case",
          "src/contexts/orders/application/use-cases/create-order.usecase.ts",
          ["../domain/user.repository.port"],
        ),
      ],
    };
    // Only the path resolution finds the target when the import resolves correctly.
    // Here we check no cross-context violation fires for an allowed port import.
    const violations = runRules(model);
    expect(violations.filter((v) => v.message.includes("Cross-context dependency"))).toHaveLength(0);
  });

  it("does not flag imports within the same context", () => {
    const model: ArchitectureModel = {
      nodes: [
        makeTypedNode("User", "domain", "entity", "src/contexts/iam/domain/entities/user.entity.ts"),
        makeTypedNode(
          "CreateUserUseCase",
          "application",
          "use-case",
          "src/contexts/iam/application/use-cases/create-user.usecase.ts",
          ["../domain/user.entity"],
        ),
      ],
    };
    const violations = runRules(model);
    expect(violations.filter((v) => v.message.includes("Cross-context dependency"))).toHaveLength(0);
  });
});

// ─── application ORM framework check ─────────────────────────────────────────

describe("application ORM check", () => {
  it("flags application layer importing prisma", () => {
    const model: ArchitectureModel = {
      nodes: [
        makeTypedNode("CreateUserUseCase", "application", "use-case", "src/contexts/iam/application/use-cases/create-user.usecase.ts", ["@prisma/client"]),
      ],
    };
    const violations = runRules(model);
    expect(violations.some((v) => v.message.includes("Application must not depend on ORM"))).toBe(true);
  });

  it("does not flag application layer importing @nestjs/common", () => {
    const model: ArchitectureModel = {
      nodes: [
        makeTypedNode("CreateUserUseCase", "application", "use-case", "src/contexts/iam/application/use-cases/create-user.usecase.ts", ["@nestjs/common"]),
      ],
    };
    const violations = runRules(model);
    expect(violations.filter((v) => v.message.includes("Application must not depend on"))).toHaveLength(0);
  });
});

// ─── Helper for metrics-rich nodes ───────────────────────────────────────────

function makeMetricNode(
  name: string,
  layer: ArchitectureNode["layer"],
  kind: ArchitectureNode["kind"],
  filePath: string,
  metrics: NodeMetrics,
  imports: string[] = [],
): ArchitectureNode {
  return { name, layer, kind, filePath, imports, metrics };
}

// ─── runCleanCodeRules ────────────────────────────────────────────────────────

describe("runCleanCodeRules", () => {
  it("flags constructor with too many parameters", () => {
    const model: ArchitectureModel = {
      nodes: [
        makeMetricNode("CreateUserUseCase", "application", "use-case",
          "src/contexts/iam/application/use-cases/create-user.usecase.ts",
          { constructorParamCount: 6, methodCount: 2, lineCount: 30 }),
      ],
    };
    const violations = runCleanCodeRules(model);
    expect(violations.some((v) => v.message.includes("constructor has 6 parameters") || v.message.includes("Constructor has 6 parameters"))).toBe(true);
  });

  it("does not flag constructor with 4 or fewer parameters", () => {
    const model: ArchitectureModel = {
      nodes: [
        makeMetricNode("MyUseCase", "application", "use-case",
          "src/contexts/iam/application/use-cases/my.usecase.ts",
          { constructorParamCount: 4, methodCount: 2, lineCount: 20 }),
      ],
    };
    const violations = runCleanCodeRules(model);
    expect(violations.filter((v) => v.message.includes("constructor") || v.message.includes("Constructor"))).toHaveLength(0);
  });

  it("flags class with too many methods", () => {
    const model: ArchitectureModel = {
      nodes: [
        makeMetricNode("FatService", "application", "service",
          "src/contexts/iam/application/fat.service.ts",
          { constructorParamCount: 1, methodCount: 15, lineCount: 80 }),
      ],
    };
    const violations = runCleanCodeRules(model);
    expect(violations.some((v) => v.message.includes("15 methods"))).toBe(true);
  });

  it("does not flag class with 10 or fewer methods", () => {
    const model: ArchitectureModel = {
      nodes: [
        makeMetricNode("OkService", "application", "service",
          "src/contexts/iam/application/ok.service.ts",
          { constructorParamCount: 1, methodCount: 10, lineCount: 60 }),
      ],
    };
    const violations = runCleanCodeRules(model);
    expect(violations.filter((v) => v.message.includes("methods"))).toHaveLength(0);
  });

  it("flags too many imports (> 10)", () => {
    const imports = Array.from({ length: 11 }, (_, i) => `./dep${i}`);
    const model: ArchitectureModel = {
      nodes: [
        makeMetricNode("BigClass", "application", "service",
          "src/contexts/iam/application/big.service.ts",
          { lineCount: 50 },
          imports),
      ],
    };
    const violations = runCleanCodeRules(model);
    expect(violations.some((v) => v.message.includes("11 imports"))).toBe(true);
  });

  it("flags domain file exceeding 200 lines", () => {
    const model: ArchitectureModel = {
      nodes: [
        makeMetricNode("HugeEntity", "domain", "entity",
          "src/contexts/iam/domain/entities/huge.entity.ts",
          { lineCount: 250, methodCount: 3, constructorParamCount: 1 }),
      ],
    };
    const violations = runCleanCodeRules(model);
    expect(violations.some((v) => v.message.includes("250 lines"))).toBe(true);
  });

  it("does not flag infrastructure file under 300 lines", () => {
    const model: ArchitectureModel = {
      nodes: [
        makeMetricNode("UserRepo", "infrastructure", "repository",
          "src/contexts/iam/infrastructure/persistence/user.repository.ts",
          { lineCount: 280, methodCount: 4, constructorParamCount: 1 }),
      ],
    };
    const violations = runCleanCodeRules(model);
    expect(violations.filter((v) => v.message.includes("lines"))).toHaveLength(0);
  });

  it("violation includes a suggestion", () => {
    const model: ArchitectureModel = {
      nodes: [
        makeMetricNode("BigClass", "application", "service",
          "src/contexts/iam/application/big.service.ts",
          { constructorParamCount: 7, methodCount: 2, lineCount: 30 }),
      ],
    };
    const violations = runCleanCodeRules(model);
    expect(violations[0]?.suggestion).toBeDefined();
    expect(violations[0]?.suggestion?.length).toBeGreaterThan(0);
  });

  it("does not report file-level violations twice when file has multiple classes", () => {
    const imports = Array.from({ length: 11 }, (_, i) => `./dep${i}`);
    const model: ArchitectureModel = {
      nodes: [
        makeMetricNode("ClassA", "application", "service",
          "src/contexts/iam/application/shared.ts",
          { lineCount: 50 }, imports),
        makeMetricNode("ClassB", "application", "service",
          "src/contexts/iam/application/shared.ts",
          { lineCount: 50 }, imports),
      ],
    };
    const violations = runCleanCodeRules(model).filter((v) => v.message.includes("imports"));
    expect(violations).toHaveLength(1);
  });
});

// ─── runGreenCodeRules ────────────────────────────────────────────────────────

describe("runGreenCodeRules", () => {
  it("flags file with more than 300 lines", () => {
    const model: ArchitectureModel = {
      nodes: [
        makeMetricNode("HugeAdapter", "infrastructure", "repository",
          "src/contexts/iam/infrastructure/persistence/huge.repository.ts",
          { lineCount: 350, methodCount: 5 }),
      ],
    };
    const violations = runGreenCodeRules(model);
    expect(violations.some((v) => v.message.includes("350 lines"))).toBe(true);
  });

  it("does not flag file at or under 300 lines", () => {
    const model: ArchitectureModel = {
      nodes: [
        makeMetricNode("OkAdapter", "infrastructure", "repository",
          "src/contexts/iam/infrastructure/persistence/ok.repository.ts",
          { lineCount: 300, methodCount: 5 }),
      ],
    };
    const violations = runGreenCodeRules(model);
    expect(violations.filter((v) => v.message.includes("lines"))).toHaveLength(0);
  });

  it("flags file with more than 15 imports", () => {
    const imports = Array.from({ length: 16 }, (_, i) => `./dep${i}`);
    const model: ArchitectureModel = {
      nodes: [
        makeMetricNode("HeavyService", "infrastructure", "service",
          "src/contexts/iam/infrastructure/heavy.service.ts",
          { lineCount: 50 }, imports),
      ],
    };
    const violations = runGreenCodeRules(model);
    expect(violations.some((v) => v.message.includes("16 imports"))).toBe(true);
  });

  it("flags file with more than 2 classes", () => {
    const path = "src/contexts/iam/infrastructure/multi.ts";
    const model: ArchitectureModel = {
      nodes: [
        makeMetricNode("ClassA", "infrastructure", "service", path, { lineCount: 50, methodCount: 1 }),
        makeMetricNode("ClassB", "infrastructure", "service", path, { lineCount: 50, methodCount: 1 }),
        makeMetricNode("ClassC", "infrastructure", "service", path, { lineCount: 50, methodCount: 1 }),
      ],
    };
    const violations = runGreenCodeRules(model);
    expect(violations.some((v) => v.message.includes("3 classes"))).toBe(true);
  });

  it("does not report violations twice when file has multiple nodes", () => {
    const path = "src/contexts/iam/infrastructure/huge.ts";
    const model: ArchitectureModel = {
      nodes: [
        makeMetricNode("ClassA", "infrastructure", "service", path, { lineCount: 400, methodCount: 2 }),
        makeMetricNode("ClassB", "infrastructure", "service", path, { lineCount: 400, methodCount: 2 }),
      ],
    };
    const violations = runGreenCodeRules(model).filter((v) => v.message.includes("lines"));
    expect(violations).toHaveLength(1);
  });
});

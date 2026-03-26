import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { generateContext, generateUseCase, generateAggregate } from "./index";
import fs from "node:fs";
import path from "node:path";
import os from "node:os";

let tmpDir: string;
let originalCwd: string;

beforeEach(() => {
  tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "node-hexa-test-"));
  // Simulate a node-hexa project root (required by assertInsideProject)
  fs.writeFileSync(
    path.join(tmpDir, "package.json"),
    JSON.stringify({ name: "test-app" }),
  );
  fs.writeFileSync(
    path.join(tmpDir, "node-hexa.config.json"),
    JSON.stringify({ architecture: "hexagonal-ddd", strict: true, contextsDir: "src/contexts" }),
  );
  originalCwd = process.cwd();
  process.chdir(tmpDir);
});

afterEach(() => {
  process.chdir(originalCwd);
  fs.rmSync(tmpDir, { recursive: true, force: true });
});

// ─── generateContext ─────────────────────────────────────────────────────────

describe("generateContext", () => {
  it("creates all expected files", () => {
    generateContext("orders");
    const base = path.join(tmpDir, "src", "contexts", "orders");

    expect(fs.existsSync(path.join(base, "domain/entities/orders.entity.ts"))).toBe(true);
    expect(fs.existsSync(path.join(base, "domain/ports/orders.repository.port.ts"))).toBe(true);
    expect(fs.existsSync(path.join(base, "application/use-cases/create-orders.dto.ts"))).toBe(true);
    expect(fs.existsSync(path.join(base, "application/use-cases/create-orders.usecase.ts"))).toBe(true);
    expect(fs.existsSync(path.join(base, "application/use-cases/create-orders.usecase.spec.ts"))).toBe(true);
    expect(fs.existsSync(path.join(base, "infrastructure/http/orders.controller.ts"))).toBe(true);
    expect(fs.existsSync(path.join(base, "infrastructure/persistence/in-memory-orders.repository.ts"))).toBe(true);
    expect(fs.existsSync(path.join(base, "orders.module.ts"))).toBe(true);
  });

  it("DTO is in a separate file, not inlined in the use case", () => {
    generateContext("orders");
    const base = path.join(tmpDir, "src/contexts/orders");

    const usecaseContent = fs.readFileSync(
      path.join(base, "application/use-cases/create-orders.usecase.ts"),
      "utf8",
    );
    const dtoContent = fs.readFileSync(
      path.join(base, "application/use-cases/create-orders.dto.ts"),
      "utf8",
    );
    expect(usecaseContent).not.toContain("export interface Create");
    expect(usecaseContent).toContain("from './create-orders.dto'");
    expect(dtoContent).toContain("CreateOrdersDto");
  });

  it("spec file imports vitest and has a describe block", () => {
    generateContext("orders");
    const content = fs.readFileSync(
      path.join(tmpDir, "src/contexts/orders/application/use-cases/create-orders.usecase.spec.ts"),
      "utf8",
    );
    expect(content).toContain("from 'vitest'");
    expect(content).toContain("describe");
    expect(content).toContain("expect");
  });

  it("generates valid entity class name (PascalCase)", () => {
    generateContext("orders");
    const content = fs.readFileSync(
      path.join(tmpDir, "src/contexts/orders/domain/entities/orders.entity.ts"),
      "utf8",
    );
    expect(content).toContain("class Orders");
  });

  it("generates a Symbol DI token", () => {
    generateContext("orders");
    const content = fs.readFileSync(
      path.join(tmpDir, "src/contexts/orders/domain/ports/orders.repository.port.ts"),
      "utf8",
    );
    expect(content).toContain("ORDERS_REPOSITORY_PORT");
    expect(content).toContain("Symbol");
  });

  it("generates kebab-case context names (multi-word)", () => {
    generateContext("order-line");
    const base = path.join(tmpDir, "src/contexts/order-line");
    expect(fs.existsSync(path.join(base, "domain/entities/order-line.entity.ts"))).toBe(true);
    const content = fs.readFileSync(
      path.join(base, "domain/entities/order-line.entity.ts"),
      "utf8",
    );
    expect(content).toContain("class OrderLine");
  });

  it("throws if name is not kebab-case", () => {
    expect(() => generateContext("MyContext")).toThrowError(/Invalid context name/);
    expect(() => generateContext("my context")).toThrowError(/Invalid context name/);
    expect(() => generateContext("MY_CONTEXT")).toThrowError(/Invalid context name/);
  });

  it("throws if context already exists", () => {
    generateContext("orders");
    expect(() => generateContext("orders")).toThrowError(/already exists/);
  });

  it("throws if not inside a node-hexa project", () => {
    // Remove both node-hexa markers so the guard triggers
    fs.rmSync(path.join(tmpDir, "node-hexa.config.json"));
    expect(() => generateContext("orders")).toThrowError(/node-hexa\.config\.json/);
  });
});

// ─── generateAggregate ────────────────────────────────────────────────────────

describe("generateAggregate", () => {
  beforeEach(() => {
    // The context must exist before generating an aggregate inside it
    fs.mkdirSync(path.join(tmpDir, "src", "contexts", "catalog"), { recursive: true });
  });

  it("creates all expected files", () => {
    generateAggregate("product", "catalog");
    const base = path.join(tmpDir, "src/contexts/catalog");

    expect(fs.existsSync(path.join(base, "domain/entities/product.entity.ts"))).toBe(true);
    expect(fs.existsSync(path.join(base, "domain/value-objects/product-id.vo.ts"))).toBe(true);
    expect(fs.existsSync(path.join(base, "domain/ports/product.repository.port.ts"))).toBe(true);
    expect(fs.existsSync(path.join(base, "application/use-cases/create-product.usecase.ts"))).toBe(true);
    expect(fs.existsSync(path.join(base, "application/use-cases/create-product.dto.ts"))).toBe(true);
    expect(fs.existsSync(path.join(base, "application/use-cases/create-product.usecase.spec.ts"))).toBe(true);
    expect(fs.existsSync(path.join(base, "infrastructure/persistence/in-memory-product.repository.ts"))).toBe(true);
    expect(fs.existsSync(path.join(base, "infrastructure/http/product.controller.ts"))).toBe(true);
    expect(fs.existsSync(path.join(base, "product.module.ts"))).toBe(true);
  });

  it("injects the port with @Inject in use case", () => {
    generateAggregate("product", "catalog");
    const content = fs.readFileSync(
      path.join(tmpDir, "src/contexts/catalog/application/use-cases/create-product.usecase.ts"),
      "utf8",
    );
    expect(content).toContain("@Inject(PRODUCT_REPOSITORY_PORT)");
    expect(content).toContain("ProductRepositoryPort");
  });

  it("wires module providers with DI token", () => {
    generateAggregate("product", "catalog");
    const content = fs.readFileSync(
      path.join(tmpDir, "src/contexts/catalog/product.module.ts"),
      "utf8",
    );
    expect(content).toContain("provide: PRODUCT_REPOSITORY_PORT");
    expect(content).toContain("useClass: InMemoryProductRepository");
  });

  it("throws if context does not exist", () => {
    expect(() => generateAggregate("product", "unknown-ctx")).toThrowError(/does not exist/);
  });

  it("throws if aggregate name is not kebab-case", () => {
    expect(() => generateAggregate("MyProduct", "catalog")).toThrowError(/Invalid aggregate name/);
  });
});

// ─── generateUseCase ─────────────────────────────────────────────────────────

describe("generateUseCase", () => {
  beforeEach(() => {
    // The context must exist before generating a use case inside it
    fs.mkdirSync(path.join(tmpDir, "src", "contexts", "iam"), { recursive: true });
  });

  it("creates usecase, dto, and spec files", () => {
    generateUseCase("delete-user", "iam");
    const base = path.join(tmpDir, "src/contexts/iam/application/use-cases");

    expect(fs.existsSync(path.join(base, "delete-user.usecase.ts"))).toBe(true);
    expect(fs.existsSync(path.join(base, "delete-user.dto.ts"))).toBe(true);
    expect(fs.existsSync(path.join(base, "delete-user.usecase.spec.ts"))).toBe(true);
  });

  it("generates PascalCase class name from kebab-case input", () => {
    generateUseCase("delete-user", "iam");
    const content = fs.readFileSync(
      path.join(tmpDir, "src/contexts/iam/application/use-cases/delete-user.usecase.ts"),
      "utf8",
    );
    expect(content).toContain("class DeleteUserUseCase");
  });

  it("spec file imports vitest primitives", () => {
    generateUseCase("delete-user", "iam");
    const content = fs.readFileSync(
      path.join(tmpDir, "src/contexts/iam/application/use-cases/delete-user.usecase.spec.ts"),
      "utf8",
    );
    expect(content).toContain("from 'vitest'");
    expect(content).toContain("describe");
    expect(content).toContain("expect");
  });

  it("injects existing port if one is found in context", () => {
    const portsDir = path.join(tmpDir, "src/contexts/iam/domain/ports");
    fs.mkdirSync(portsDir, { recursive: true });
    fs.writeFileSync(
      path.join(portsDir, "user.repository.port.ts"),
      "export const USER_REPOSITORY_PORT = Symbol('UserRepositoryPort');\n",
    );

    generateUseCase("delete-user", "iam");
    const content = fs.readFileSync(
      path.join(tmpDir, "src/contexts/iam/application/use-cases/delete-user.usecase.ts"),
      "utf8",
    );
    expect(content).toContain("@Inject(USER_REPOSITORY_PORT)");
    expect(content).toContain("UserRepositoryPort");
  });

  it("throws if context does not exist", () => {
    expect(() => generateUseCase("delete-user", "unknown-ctx")).toThrowError(/does not exist/);
  });

  it("throws if use case name is not kebab-case", () => {
    expect(() => generateUseCase("DeleteUser", "iam")).toThrowError(/Invalid use case name/);
  });
});

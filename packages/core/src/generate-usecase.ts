import fs from "node:fs";
import path from "node:path";
import { assertKebabCase, assertInsideProject } from "./guards";

interface PortInfo {
  token: string;
  interfaceName: string;
  importPath: string;
  paramName: string;
}

function findContextPort(base: string, context: string): PortInfo | null {
  const portsDir = path.join(base, "domain/ports");
  if (!fs.existsSync(portsDir)) return null;

  const portFile = fs
    .readdirSync(portsDir)
    .find((f) => f.endsWith(".repository.port.ts"));

  if (!portFile) return null;

  const baseName = portFile.replace(".repository.port.ts", "");
  const pascal = capitalize(baseName);
  const token = `${baseName.toUpperCase().replaceAll("-", "_")}_REPOSITORY_PORT`;

  return {
    token,
    interfaceName: `${pascal}RepositoryPort`,
    importPath: `../../domain/ports/${baseName}.repository.port`,
    paramName: `${context.replaceAll("-", "")}Repository`,
  };
}

export function generateUseCase(name: string, context: string) {
  assertKebabCase(name, "use case name");
  assertKebabCase(context, "context name");
  assertInsideProject();

  const base = path.join(process.cwd(), "src", "contexts", context);

  if (!fs.existsSync(base)) {
    throw new Error(
      `Context '${context}' does not exist at src/contexts/${context}. Run 'node-hexa generate context ${context}' first.`,
    );
  }

  const className = capitalize(name) + "UseCase";

  const usecasePath = path.join(
    base,
    "application/use-cases",
    `${name}.usecase.ts`,
  );
  const dtoPath = path.join(base, "application/use-cases", `${name}.dto.ts`);
  const testPath = path.join(
    base,
    "application/use-cases",
    `${name}.usecase.spec.ts`,
  );

  fs.mkdirSync(path.dirname(usecasePath), { recursive: true });

  const port = findContextPort(base, context);

  const usecaseContent = port
    ? `import { Inject, Injectable } from '@nestjs/common';
import { ${port.token}, ${port.interfaceName} } from '${port.importPath}';
import { ${className}Dto } from './${name}.dto';

@Injectable()
export class ${className} {
  constructor(
    @Inject(${port.token})
    private readonly ${port.paramName}: ${port.interfaceName},
  ) {}

  async execute(dto: ${className}Dto): Promise<void> {
    // TODO: implement use case logic
  }
}
`
    : `import { Injectable } from '@nestjs/common';
import { ${className}Dto } from './${name}.dto';

@Injectable()
export class ${className} {
  async execute(dto: ${className}Dto): Promise<void> {
    // TODO: inject a repository port via constructor and implement logic
  }
}
`;

  fs.writeFileSync(usecasePath, usecaseContent);

  fs.writeFileSync(
    dtoPath,
    `export interface ${className}Dto {
  // TODO: define the fields required by this use case
}
`,
  );

  fs.writeFileSync(
    testPath,
    `import { describe, it, expect } from 'vitest';
import { ${className} } from './${name}.usecase';

describe('${className}', () => {
  it('should execute without errors', async () => {
    const usecase = new ${className}(${port ? `{} as any` : ""});
    await expect(usecase.execute({})).resolves.toBeUndefined();
  });
});
`,
  );
}

function capitalize(str: string) {
  return str
    .split("-")
    .map((s) => s.charAt(0).toUpperCase() + s.slice(1))
    .join("");
}

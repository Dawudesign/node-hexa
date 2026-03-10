import { Project } from "ts-morph";
import fs from "node:fs";
import path from "node:path";

export type ParsedClass = {
  name: string;
  decorators: string[];
  /** Number of methods defined in the class body (excluding constructor). */
  methodCount: number;
  /** Number of parameters in the primary constructor. */
  constructorParamCount: number;
};

export type ParsedFile = {
  path: string;
  imports: string[];
  classes: ParsedClass[];
  interfaces: string[];
  /** Total number of lines in the source file. */
  lineCount: number;
};

export type ParsedProject = {
  files: ParsedFile[];
};

export async function parseProject(rootPath: string): Promise<ParsedProject> {
  const resolvedPath = path.resolve(rootPath);

  // Walk up the directory tree to find the nearest tsconfig.json
  function findTsConfig(dir: string): string | null {
    const candidate = path.join(dir, "tsconfig.json");
    if (fs.existsSync(candidate)) return candidate;
    const parent = path.dirname(dir);
    if (parent === dir) return null; // reached filesystem root
    return findTsConfig(parent);
  }

  const tsConfigFilePath = findTsConfig(resolvedPath);

  if (!tsConfigFilePath) {
    throw new Error(
      `No tsconfig.json found at "${path.resolve(rootPath, "tsconfig.json")}".\n` +
        `Make sure you are pointing to a valid TypeScript project root.`,
    );
  }

  const project = new Project({ tsConfigFilePath });

  const files = project.getSourceFiles().map((file) => {
    const imports = file
      .getImportDeclarations()
      .map((i) => i.getModuleSpecifierValue());

    const classes = file.getClasses().map((cls) => ({
      name: cls.getName() || "AnonymousClass",
      decorators: cls.getDecorators().map((d) => d.getName()),
      methodCount: cls.getMethods().length,
      constructorParamCount:
        cls.getConstructors()[0]?.getParameters().length ?? 0,
    }));

    const interfaces = file.getInterfaces().map((i) => i.getName());

    return {
      path: file.getFilePath(),
      imports,
      classes,
      interfaces,
      lineCount: file.getEndLineNumber(),
    };
  });

  return { files };
}
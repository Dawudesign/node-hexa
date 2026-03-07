import { Project } from "ts-morph";
import fs from "node:fs";
import path from "node:path";

export type ParsedClass = {
  name: string;
  decorators: string[];
};

export type ParsedFile = {
  path: string;
  imports: string[];
  classes: ParsedClass[];
  interfaces: string[];
};

export type ParsedProject = {
  files: ParsedFile[];
};

export async function parseProject(rootPath: string): Promise<ParsedProject> {
  const tsConfigFilePath = path.resolve(rootPath, "tsconfig.json");

  if (!fs.existsSync(tsConfigFilePath)) {
    throw new Error(
      `No tsconfig.json found at "${tsConfigFilePath}".\n` +
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
    }));

    const interfaces = file.getInterfaces().map((i) => i.getName());

    return {
      path: file.getFilePath(),
      imports,
      classes,
      interfaces,
    };
  });

  return { files };
}
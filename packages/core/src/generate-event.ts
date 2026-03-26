import fs from "node:fs";
import path from "node:path";
import { assertKebabCase, assertInsideProject } from "./guards";

export function generateDomainEvent(name: string, context: string) {
  assertKebabCase(name, "event name");
  assertKebabCase(context, "context name");
  assertInsideProject();

  const base = path.join(process.cwd(), "src", "contexts", context);

  if (!fs.existsSync(base)) {
    throw new Error(
      `Context '${context}' does not exist at src/contexts/${context}. Run 'node-hexa generate context ${context}' first.`,
    );
  }

  const eventsDir = path.join(base, "domain", "events");
  fs.mkdirSync(eventsDir, { recursive: true });

  const pascal = capitalize(name);
  const eventFile = path.join(eventsDir, `${name}.event.ts`);

  if (fs.existsSync(eventFile)) {
    throw new Error(
      `Domain event '${name}' already exists at src/contexts/${context}/domain/events/${name}.event.ts.`,
    );
  }

  fs.writeFileSync(
    eventFile,
    `export class ${pascal}DomainEvent {
  constructor(
    public readonly aggregateId: string,
    public readonly occurredOn: Date = new Date(),
  ) {}
}
`,
  );

  console.log(`✓ Domain event '${name}' generated in context '${context}'`);
  console.log(
    `  → src/contexts/${context}/domain/events/${name}.event.ts`,
  );
}

function capitalize(str: string) {
  return str
    .split("-")
    .map((s) => s.charAt(0).toUpperCase() + s.slice(1))
    .join("");
}

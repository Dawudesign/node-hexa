export type Layer =
  | "domain"
  | "application"
  | "adapter-in"
  | "adapter-out"
  | "infrastructure"
  | "unknown";

export type ComponentKind =
  | "controller"
  | "use-case"
  | "repository"
  | "entity"
  | "value-object"
  | "service"
  | "module"
  | "port"
  | "adapter"
  | "unknown";

export type ArchitectureNode = {
  name: string;
  filePath: string;
  layer: Layer;
  kind: ComponentKind;
  imports: string[];
};

export type ArchitectureModel = {
  nodes: ArchitectureNode[];
};
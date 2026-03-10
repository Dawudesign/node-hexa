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

export type NodeMetrics = {
  /** Total lines in the source file. */
  lineCount?: number;
  /** Number of methods in the class body. */
  methodCount?: number;
  /** Number of parameters in the primary constructor. */
  constructorParamCount?: number;
};

export type ArchitectureNode = {
  name: string;
  filePath: string;
  layer: Layer;
  kind: ComponentKind;
  imports: string[];
  metrics?: NodeMetrics;
};

export type ArchitectureModel = {
  nodes: ArchitectureNode[];
};
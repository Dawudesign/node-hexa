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
  | "domain-event"
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
  /**
   * True when the class declares at least one public non-readonly property.
   * Used to enforce value object immutability: all observable state must be readonly.
   */
  hasMutablePublicProperties?: boolean;
  /**
   * True when the class declares a property or constructor parameter named 'id'.
   * Entities (aggregate roots) must have a unique identity.
   */
  hasIdProperty?: boolean;
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
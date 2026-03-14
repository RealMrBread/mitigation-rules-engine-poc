// @mre/shared - Shared types, schemas, and data for Mitigation Rules Engine
// This barrel file re-exports from types/, schemas/, and data/ as they are populated.

// --- Schemas ---
export {
  VegetationItemSchema,
  ObservationSchema,
  GLOBALLY_REQUIRED_FIELDS,
  KNOWN_OBSERVATION_FIELDS,
} from "./schemas/observation.schema.js";

export {
  OperatorSchema,
  SimpleConfigSchema,
  ThresholdCheckSchema,
  ConditionalBranchSchema,
  ConditionalConfigSchema,
  ModifierSchema,
  ComputedConfigSchema,
  BridgeEffectSchema,
  MitigationSchema,
  RuleTypeSchema,
  SimpleRuleSchema,
  ConditionalRuleSchema,
  ComputedRuleSchema,
  RuleSchema,
} from "./schemas/rule.schema.js";

export {
  EvaluateRequestSchema,
  MitigationSelectionSchema,
  SelectMitigationsRequestSchema,
} from "./schemas/evaluation.schema.js";

export {
  CreateReleaseRequestSchema,
} from "./schemas/release.schema.js";

export {
  RoleSchema,
  CreateUserRequestSchema,
  LoginRequestSchema,
} from "./schemas/user.schema.js";

export {
  UpdateSettingsRequestSchema,
} from "./schemas/settings.schema.js";

// --- Types ---
export type {
  VegetationItem,
  ObservationHash,
  FieldValidationResult,
} from "./types/observation.js";

export type {
  Operator,
  SimpleConfig,
  ThresholdCheck,
  ConditionalBranch,
  ConditionalConfig,
  Modifier,
  ComputedConfig,
  BridgeEffect,
  Mitigation,
  RuleType,
  Rule,
} from "./types/rule.js";

export type {
  EvalResult,
  RuleEvaluationStatus,
  VulnerabilityResult,
  BridgeStackBreakdownItem,
  BridgeStackBreakdown,
  EvaluationSummary,
  EvaluationResult,
} from "./types/evaluation.js";

export type {
  Release,
  ReleaseRule,
} from "./types/release.js";

export type {
  Role,
  User,
} from "./types/user.js";

export type { Settings } from "./types/settings.js";

export type {
  ApiError,
  ApiResponse,
  EvaluateRequest,
  SelectMitigationsRequest,
  CreateRuleRequest,
  UpdateRuleRequest,
  CreateReleaseRequest,
  CreateUserRequest,
  UpdateSettingsRequest,
  LoginRequest,
  LoginResponse,
} from "./types/api.js";

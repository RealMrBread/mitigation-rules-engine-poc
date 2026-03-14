import { z } from "zod";
import {
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
  RuleSchema,
} from "../schemas/rule.schema.js";

// ---------------------------------------------------------------------------
// Inferred types from Zod schemas (schemas are the source of truth)
// ---------------------------------------------------------------------------

export type Operator = z.infer<typeof OperatorSchema>;

export type SimpleConfig = z.infer<typeof SimpleConfigSchema>;

export type ThresholdCheck = z.infer<typeof ThresholdCheckSchema>;

export type ConditionalBranch = z.infer<typeof ConditionalBranchSchema>;

export type ConditionalConfig = z.infer<typeof ConditionalConfigSchema>;

export type Modifier = z.infer<typeof ModifierSchema>;

export type ComputedConfig = z.infer<typeof ComputedConfigSchema>;

export type BridgeEffect = z.infer<typeof BridgeEffectSchema>;

export type Mitigation = z.infer<typeof MitigationSchema>;

export type RuleType = z.infer<typeof RuleTypeSchema>;

export type Rule = z.infer<typeof RuleSchema>;

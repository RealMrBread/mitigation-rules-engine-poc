import { z } from "zod";

// ---------------------------------------------------------------------------
// Operators
// ---------------------------------------------------------------------------

export const OperatorSchema = z.enum([
  "eq",
  "neq",
  "in",
  "gte",
  "lte",
  "gt",
  "lt",
]);

// ---------------------------------------------------------------------------
// Simple Threshold
// ---------------------------------------------------------------------------

export const SimpleConfigSchema = z.object({
  field: z.string().min(1),
  operator: OperatorSchema,
  value: z.union([z.string(), z.number(), z.array(z.string())]),
});

// ---------------------------------------------------------------------------
// Conditional Threshold
// ---------------------------------------------------------------------------

export const ThresholdCheckSchema = z.object({
  field: z.string().min(1),
  operator: OperatorSchema,
  value: z.union([z.string(), z.number(), z.array(z.string())]),
});

export const ConditionalBranchSchema = z.object({
  when: ThresholdCheckSchema,
  then: ThresholdCheckSchema,
});

export const ConditionalConfigSchema = z.object({
  conditions: z.array(ConditionalBranchSchema).min(1),
  default: ThresholdCheckSchema,
});

// ---------------------------------------------------------------------------
// Computed with Modifiers
// ---------------------------------------------------------------------------

export const ModifierSchema = z.object({
  field: z.string().min(1),
  mapping: z.record(z.string(), z.number()),
  operation: z.enum(["multiply", "divide"]),
});

export const ComputedConfigSchema = z.object({
  baseValue: z.number().positive(),
  unit: z.string().min(1),
  modifiers: z.array(ModifierSchema).min(1),
  comparisonField: z.string().min(1),
  comparisonOperator: z.enum(["gte", "gt"]),
  arrayField: z.string().optional(),
});

// ---------------------------------------------------------------------------
// Bridge Effect (discriminated union on "type")
// ---------------------------------------------------------------------------

export const BridgeEffectSchema = z.discriminatedUnion("type", [
  z.object({
    type: z.literal("multiplier"),
    value: z.number().positive(),
  }),
  z.object({
    type: z.literal("override"),
    value: z.union([z.string(), z.number()]),
  }),
]);

// ---------------------------------------------------------------------------
// Mitigation
// ---------------------------------------------------------------------------

const BaseMitigationSchema = z.object({
  id: z.string().uuid(),
  name: z.string().min(1),
  description: z.string().min(1),
  category: z.enum(["full", "bridge"]),
  effect: BridgeEffectSchema.optional(),
});

export const MitigationSchema = BaseMitigationSchema.superRefine(
  (data, ctx) => {
    if (data.category === "full" && data.effect !== undefined) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message:
          'Full mitigations must not have an effect. Only bridge mitigations use "effect".',
        path: ["effect"],
      });
    }
    if (data.category === "bridge" && data.effect === undefined) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message:
          "Bridge mitigations must have an effect (multiplier or override).",
        path: ["effect"],
      });
    }
  },
);

// ---------------------------------------------------------------------------
// Rule Type
// ---------------------------------------------------------------------------

export const RuleTypeSchema = z.enum([
  "simple_threshold",
  "conditional_threshold",
  "computed_with_modifiers",
]);

// ---------------------------------------------------------------------------
// Rule (discriminated union on "type" to narrow config)
// ---------------------------------------------------------------------------

const RuleBaseSchema = z.object({
  id: z.string().uuid(),
  name: z.string().min(1),
  description: z.string().min(1),
  mitigations: z.array(MitigationSchema),
});

export const SimpleRuleSchema = RuleBaseSchema.extend({
  type: z.literal("simple_threshold"),
  config: SimpleConfigSchema,
});

export const ConditionalRuleSchema = RuleBaseSchema.extend({
  type: z.literal("conditional_threshold"),
  config: ConditionalConfigSchema,
});

export const ComputedRuleSchema = RuleBaseSchema.extend({
  type: z.literal("computed_with_modifiers"),
  config: ComputedConfigSchema,
});

export const RuleSchema = z.discriminatedUnion("type", [
  SimpleRuleSchema,
  ConditionalRuleSchema,
  ComputedRuleSchema,
]);

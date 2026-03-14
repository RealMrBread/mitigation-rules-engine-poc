import { z } from "zod";

// ---------------------------------------------------------------------------
// EvaluateRequest schema
// ---------------------------------------------------------------------------

export const EvaluateRequestSchema = z.object({
  observations: z.record(z.string(), z.any()),
  release_id: z.string().uuid().nullable(),
});

// ---------------------------------------------------------------------------
// SelectMitigationsRequest schema
// ---------------------------------------------------------------------------

export const MitigationSelectionSchema = z.object({
  rule_id: z.string().uuid(),
  mitigation_id: z.string().uuid(),
  category: z.enum(["full", "bridge"]),
});

export const SelectMitigationsRequestSchema = z.object({
  selections: z.array(MitigationSelectionSchema).min(1),
});

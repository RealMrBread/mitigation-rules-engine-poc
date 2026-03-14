import { z } from "zod";

// ---------------------------------------------------------------------------
// UpdateSettingsRequest schema
// ---------------------------------------------------------------------------

export const UpdateSettingsRequestSchema = z.object({
  bridge_mitigation_limit: z
    .number()
    .int("Bridge mitigation limit must be an integer")
    .min(0, "Bridge mitigation limit cannot be negative")
    .optional(),
});

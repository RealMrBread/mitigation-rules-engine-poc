import { z } from "zod";
import {
  VegetationItemSchema,
  ObservationSchema,
} from "../schemas/observation.schema.js";

// ---------------------------------------------------------------------------
// Inferred types from Zod schemas
// ---------------------------------------------------------------------------

/** A single vegetation observation (tree, shrub, or grass near a window). */
export type VegetationItem = z.infer<typeof VegetationItemSchema>;

/**
 * The observation hash submitted for property evaluation.
 *
 * - `property_id` and `state` are globally required.
 * - Known optional fields (attic_vent_screens, roof_type, etc.) are used by
 *   rules; when absent the referencing rule is skipped with a warning.
 * - Unknown fields are passed through for extensibility.
 */
export type ObservationHash = z.infer<typeof ObservationSchema>;

/** Result of validating a single field or the full observation. */
export interface FieldValidationResult {
  valid: boolean;
  errors: string[];
  warnings: string[];
}

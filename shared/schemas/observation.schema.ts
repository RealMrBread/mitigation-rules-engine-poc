import { z } from "zod";

// ---------------------------------------------------------------------------
// Vegetation item schema
// ---------------------------------------------------------------------------

export const VegetationItemSchema = z.object({
  type: z.enum(["Tree", "Shrub", "Grass"]),
  distance_to_window: z.number().positive(),
});

// ---------------------------------------------------------------------------
// Observation hash schema
// ---------------------------------------------------------------------------

export const ObservationSchema = z
  .object({
    // Globally required fields -- absence halts evaluation with a validation error.
    property_id: z.string(),
    state: z.string(),

    // Known optional (rule-referenced) fields -- absence causes referencing
    // rule to be skipped with a warning.
    attic_vent_screens: z
      .enum(["None", "Standard", "Ember Resistant"])
      .optional(),
    roof_type: z.enum(["Class A", "Class B", "Class C"]).optional(),
    window_type: z
      .enum(["Single Pane", "Double Pane", "Tempered Glass"])
      .optional(),
    wildfire_risk_category: z.enum(["A", "B", "C", "D"]).optional(),
    vegetation: z.array(VegetationItemSchema).optional(),
    home_to_home_distance: z.number().positive().optional(),
  })
  .passthrough();

// ---------------------------------------------------------------------------
// Field-name constants
// ---------------------------------------------------------------------------

/** Fields whose absence causes a validation error that halts evaluation. */
export const GLOBALLY_REQUIRED_FIELDS: string[] = ["property_id", "state"];

/** All fields the system currently understands (required + optional). */
export const KNOWN_OBSERVATION_FIELDS: string[] = [
  "property_id",
  "state",
  "attic_vent_screens",
  "roof_type",
  "window_type",
  "wildfire_risk_category",
  "vegetation",
  "home_to_home_distance",
];

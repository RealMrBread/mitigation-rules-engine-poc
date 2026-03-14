import type { ObservationHash } from "../types/observation.js";

// ---------------------------------------------------------------------------
// Observation Set 1 -- All rules pass
// ---------------------------------------------------------------------------

export const OBS_ALL_PASSING: ObservationHash = {
  property_id: "PROP-001",
  state: "CA",
  attic_vent_screens: "Ember Resistant",
  roof_type: "Class A",
  wildfire_risk_category: "B",
  window_type: "Tempered Glass",
  vegetation: [
    { type: "Tree", distance_to_window: 50 },
    { type: "Shrub", distance_to_window: 40 },
  ],
  home_to_home_distance: 20,
};

// ---------------------------------------------------------------------------
// Observation Set 2 -- Only Attic Vent fails
//   Standard vents != Ember Resistant --> triggers rule 1
//   Everything else passes
// ---------------------------------------------------------------------------

export const OBS_ATTIC_VENT_FAIL: ObservationHash = {
  property_id: "PROP-002",
  state: "CA",
  attic_vent_screens: "Standard",
  roof_type: "Class A",
  wildfire_risk_category: "B",
  window_type: "Tempered Glass",
  vegetation: [
    { type: "Tree", distance_to_window: 50 },
  ],
  home_to_home_distance: 20,
};

// ---------------------------------------------------------------------------
// Observation Set 3 -- Windows rule fails (good for bridge stacking tests)
//   Single Pane + Tree at 50ft
//   Computed threshold: 30 * 3 (Single Pane) / 1 (Tree) = 90ft
//   Actual: 50ft < 90ft --> FAIL
//   With bridges: 90 * 0.8 (Film) * 0.5 (Prune) = 36ft, 50 >= 36 --> PASS
// ---------------------------------------------------------------------------

export const OBS_WINDOWS_FAIL: ObservationHash = {
  property_id: "PROP-003",
  state: "CA",
  attic_vent_screens: "Ember Resistant",
  roof_type: "Class A",
  wildfire_risk_category: "B",
  window_type: "Single Pane",
  vegetation: [
    { type: "Tree", distance_to_window: 50 },
  ],
  home_to_home_distance: 20,
};

// ---------------------------------------------------------------------------
// Observation Set 4 -- Home-to-Home auto-decline
//   Distance 10ft < 15ft --> triggers rule 4 (empty mitigations = auto-decline)
//   Other rules may also trigger but auto-decline takes precedence
// ---------------------------------------------------------------------------

export const OBS_AUTO_DECLINE: ObservationHash = {
  property_id: "PROP-004",
  state: "CA",
  attic_vent_screens: "Ember Resistant",
  roof_type: "Class A",
  wildfire_risk_category: "B",
  window_type: "Tempered Glass",
  vegetation: [
    { type: "Tree", distance_to_window: 50 },
  ],
  home_to_home_distance: 10,
};

// ---------------------------------------------------------------------------
// Observation Set 5 -- Multiple failures (Attic Vent + Roof + Windows)
//   Standard vents --> triggers Attic Vent
//   Class C roof + risk category C --> default branch requires Class A, Class C != Class A --> triggers Roof
//   Single Pane + Tree at 20ft --> threshold 30*3/1 = 90ft, 20 < 90 --> triggers Windows
//   Home distance 25ft >= 15ft --> passes Home-to-Home
// ---------------------------------------------------------------------------

export const OBS_MULTIPLE_FAILS: ObservationHash = {
  property_id: "PROP-005",
  state: "CA",
  attic_vent_screens: "Standard",
  roof_type: "Class C",
  wildfire_risk_category: "C",
  window_type: "Single Pane",
  vegetation: [
    { type: "Tree", distance_to_window: 20 },
  ],
  home_to_home_distance: 25,
};

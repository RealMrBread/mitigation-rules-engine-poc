import type { Rule } from "../types/rule.js";

// ---------------------------------------------------------------------------
// Deterministic UUIDs for reproducible tests
// ---------------------------------------------------------------------------

// Rule IDs
const ATTIC_VENT_RULE_ID = "a0000000-0000-4000-a000-000000000001";
const ROOF_RULE_ID = "a0000000-0000-4000-a000-000000000002";
const WINDOWS_RULE_ID = "a0000000-0000-4000-a000-000000000003";
const HOME_TO_HOME_RULE_ID = "a0000000-0000-4000-a000-000000000004";

// Mitigation IDs
const MIT_INSTALL_EMBER_VENTS_ID = "b0000000-0000-4000-b000-000000000001";
const MIT_REPLACE_ROOF_ID = "b0000000-0000-4000-b000-000000000002";
const MIT_REMOVE_VEGETATION_ID = "b0000000-0000-4000-b000-000000000003";
const MIT_TEMPERED_GLASS_ID = "b0000000-0000-4000-b000-000000000004";
const MIT_APPLY_FILM_ID = "b0000000-0000-4000-b000-000000000005";
const MIT_FLAME_RETARDANT_ID = "b0000000-0000-4000-b000-000000000006";
const MIT_PRUNE_TREES_ID = "b0000000-0000-4000-b000-000000000007";

// ---------------------------------------------------------------------------
// Rule 1 -- Attic Vent (Simple Threshold, mitigatable)
// ---------------------------------------------------------------------------

export const ATTIC_VENT_RULE: Rule = {
  id: ATTIC_VENT_RULE_ID,
  name: "Attic Vent",
  description:
    "Ensure all vents, chimneys, and screens can withstand embers",
  type: "simple_threshold",
  config: {
    field: "attic_vent_screens",
    operator: "eq",
    value: "Ember Resistant",
  },
  mitigations: [
    {
      id: MIT_INSTALL_EMBER_VENTS_ID,
      name: "Install Ember-Rated Vents",
      description: "Replace all vents with ember-rated vents",
      category: "full",
    },
  ],
};

// ---------------------------------------------------------------------------
// Rule 2 -- Roof (Conditional Threshold, mitigatable)
// ---------------------------------------------------------------------------

export const ROOF_RULE: Rule = {
  id: ROOF_RULE_ID,
  name: "Roof",
  description:
    "Ensure the roof is Class A. In low wildfire areas (Category A), Class B is acceptable.",
  type: "conditional_threshold",
  config: {
    conditions: [
      {
        when: {
          field: "wildfire_risk_category",
          operator: "eq",
          value: "A",
        },
        then: {
          field: "roof_type",
          operator: "in",
          value: ["Class A", "Class B"],
        },
      },
    ],
    default: {
      field: "roof_type",
      operator: "eq",
      value: "Class A",
    },
  },
  mitigations: [
    {
      id: MIT_REPLACE_ROOF_ID,
      name: "Replace Roof",
      description: "Upgrade to Class A roof",
      category: "full",
    },
  ],
};

// ---------------------------------------------------------------------------
// Rule 3 -- Window Safety Distance (Computed with Modifiers)
// ---------------------------------------------------------------------------

export const WINDOWS_RULE: Rule = {
  id: WINDOWS_RULE_ID,
  name: "Window Safety Distance",
  description:
    "Ensure windows can withstand heat exposure from surrounding vegetation",
  type: "computed_with_modifiers",
  config: {
    baseValue: 30,
    unit: "feet",
    modifiers: [
      {
        field: "window_type",
        operation: "multiply",
        mapping: {
          "Single Pane": 3,
          "Double Pane": 2,
          "Tempered Glass": 1,
        },
      },
      {
        field: "vegetation[].type",
        operation: "divide",
        mapping: {
          Tree: 1,
          Shrub: 2,
          Grass: 3,
        },
      },
    ],
    comparisonField: "vegetation[].distance_to_window",
    comparisonOperator: "gte",
    arrayField: "vegetation",
  },
  mitigations: [
    {
      id: MIT_REMOVE_VEGETATION_ID,
      name: "Remove Vegetation",
      description:
        "Remove all vegetation within the required safe distance",
      category: "full",
    },
    {
      id: MIT_TEMPERED_GLASS_ID,
      name: "Replace with Tempered Glass",
      description: "Replace windows with tempered glass",
      category: "full",
    },
    {
      id: MIT_APPLY_FILM_ID,
      name: "Apply Film",
      description: "Apply protective film to windows",
      category: "bridge",
      effect: { type: "multiplier", value: 0.8 },
    },
    {
      id: MIT_FLAME_RETARDANT_ID,
      name: "Apply Flame Retardant to Shrubs",
      description: "Apply flame retardants to shrubs near windows",
      category: "bridge",
      effect: { type: "multiplier", value: 0.75 },
    },
    {
      id: MIT_PRUNE_TREES_ID,
      name: "Prune Trees",
      description: "Prune trees to a safe height",
      category: "bridge",
      effect: { type: "multiplier", value: 0.5 },
    },
  ],
};

// ---------------------------------------------------------------------------
// Rule 4 -- Home-to-Home Distance (Simple Threshold, unmitigatable)
// ---------------------------------------------------------------------------

export const HOME_TO_HOME_RULE: Rule = {
  id: HOME_TO_HOME_RULE_ID,
  name: "Home-to-Home Distance",
  description: "Neighboring homes must be at least 15ft away",
  type: "simple_threshold",
  config: {
    field: "home_to_home_distance",
    operator: "gte",
    value: 15,
  },
  mitigations: [],
};

// ---------------------------------------------------------------------------
// Combined seed array
// ---------------------------------------------------------------------------

export const SEED_RULES: Rule[] = [
  ATTIC_VENT_RULE,
  ROOF_RULE,
  WINDOWS_RULE,
  HOME_TO_HOME_RULE,
];

import { describe, it, expect } from "vitest";
import { evaluate } from "../engine.js";
import {
  SEED_RULES,
  ATTIC_VENT_RULE,
  ROOF_RULE,
  WINDOWS_RULE,
  HOME_TO_HOME_RULE,
} from "../../../../shared/data/seed-rules.js";
import {
  OBS_ALL_PASSING,
  OBS_ATTIC_VENT_FAIL,
  OBS_WINDOWS_FAIL,
  OBS_AUTO_DECLINE,
  OBS_MULTIPLE_FAILS,
} from "../../../../shared/data/seed-observations.js";

// ---------------------------------------------------------------------------
// Integration tests: evaluate() with seed rules and seed observations
// ---------------------------------------------------------------------------

describe("evaluate() -- integration tests", () => {
  // -------------------------------------------------------------------------
  // 1. OBS_ALL_PASSING: 0 vulnerabilities, auto_declined = false
  // -------------------------------------------------------------------------

  it("returns 0 vulnerabilities when all rules pass", () => {
    const result = evaluate(OBS_ALL_PASSING, SEED_RULES);

    expect(result.vulnerabilities).toHaveLength(0);
    expect(result.auto_declined).toBe(false);
    expect(result.summary.total_vulnerabilities).toBe(0);
  });

  // -------------------------------------------------------------------------
  // 2. OBS_ATTIC_VENT_FAIL: 1 vulnerability (Attic Vent), has mitigations
  // -------------------------------------------------------------------------

  it("identifies Attic Vent vulnerability with mitigations, not auto-declined", () => {
    const result = evaluate(OBS_ATTIC_VENT_FAIL, SEED_RULES);

    expect(result.vulnerabilities).toHaveLength(1);
    expect(result.vulnerabilities[0].rule_name).toBe("Attic Vent");
    expect(result.vulnerabilities[0].triggered).toBe(true);
    expect(result.vulnerabilities[0].mitigations.length).toBeGreaterThan(0);
    expect(result.auto_declined).toBe(false);
  });

  // -------------------------------------------------------------------------
  // 3. OBS_WINDOWS_FAIL: 1 vulnerability (Windows), has full + bridge
  // -------------------------------------------------------------------------

  it("identifies Window Safety Distance vulnerability with full and bridge mitigations", () => {
    const result = evaluate(OBS_WINDOWS_FAIL, SEED_RULES);

    const windowVuln = result.vulnerabilities.find(
      (v) => v.rule_name === "Window Safety Distance",
    );
    expect(windowVuln).toBeDefined();
    expect(windowVuln!.triggered).toBe(true);

    const fullMitigations = windowVuln!.mitigations.filter(
      (m) => m.category === "full",
    );
    const bridgeMitigations = windowVuln!.mitigations.filter(
      (m) => m.category === "bridge",
    );
    expect(fullMitigations.length).toBeGreaterThan(0);
    expect(bridgeMitigations.length).toBeGreaterThan(0);
    expect(result.auto_declined).toBe(false);
  });

  // -------------------------------------------------------------------------
  // 4. OBS_AUTO_DECLINE: auto_declined = true, Home-to-Home identified
  // -------------------------------------------------------------------------

  it("marks auto_declined when Home-to-Home triggers with empty mitigations", () => {
    const result = evaluate(OBS_AUTO_DECLINE, SEED_RULES);

    expect(result.auto_declined).toBe(true);

    const homeVuln = result.vulnerabilities.find(
      (v) => v.rule_name === "Home-to-Home Distance",
    );
    expect(homeVuln).toBeDefined();
    expect(homeVuln!.triggered).toBe(true);
    expect(homeVuln!.mitigations).toHaveLength(0);
  });

  // -------------------------------------------------------------------------
  // 5. OBS_MULTIPLE_FAILS: 3 vulnerabilities (Attic Vent + Roof + Windows)
  // -------------------------------------------------------------------------

  it("identifies multiple vulnerabilities (Attic Vent + Roof + Windows)", () => {
    const result = evaluate(OBS_MULTIPLE_FAILS, SEED_RULES);

    expect(result.vulnerabilities).toHaveLength(3);

    const vulnNames = result.vulnerabilities.map((v) => v.rule_name).sort();
    expect(vulnNames).toEqual(
      ["Attic Vent", "Roof", "Window Safety Distance"].sort(),
    );
    expect(result.auto_declined).toBe(false);
  });

  // -------------------------------------------------------------------------
  // 6. Missing globally required field: validation error, no evaluation
  // -------------------------------------------------------------------------

  it("returns validation error when property_id is missing", () => {
    const { property_id, ...missingPropId } = OBS_ALL_PASSING;
    const result = evaluate(missingPropId, SEED_RULES) as any;

    expect(result.validation_error).toBeDefined();
    expect(result.validation_error.missingFields).toContain("property_id");
    expect(result.vulnerabilities).toHaveLength(0);
    expect(result.skipped_rules).toHaveLength(0);
  });

  // -------------------------------------------------------------------------
  // 7. Missing rule-referenced field: Attic Vent skipped, others evaluated
  // -------------------------------------------------------------------------

  it("skips Attic Vent rule when attic_vent_screens is missing", () => {
    const { attic_vent_screens, ...obs } = OBS_ALL_PASSING;
    const result = evaluate(obs, SEED_RULES);

    const skippedAttic = result.skipped_rules.find(
      (s) => s.rule_name === "Attic Vent",
    );
    expect(skippedAttic).toBeDefined();
    expect(skippedAttic!.missingFields).toContain("attic_vent_screens");

    // Other rules should still be evaluated (not skipped)
    expect(
      result.skipped_rules.filter((s) => s.rule_name !== "Attic Vent"),
    ).toHaveLength(0);
  });

  // -------------------------------------------------------------------------
  // 8. Missing array field: Windows rule skipped, others evaluated
  // -------------------------------------------------------------------------

  it("skips Windows rule when vegetation array is missing", () => {
    const { vegetation, ...obs } = OBS_ALL_PASSING;
    const result = evaluate(obs, SEED_RULES);

    const skippedWindows = result.skipped_rules.find(
      (s) => s.rule_name === "Window Safety Distance",
    );
    expect(skippedWindows).toBeDefined();
    expect(skippedWindows!.missingFields).toContain("vegetation");

    // Other rules should still evaluate normally
    const evaluated = result.vulnerabilities.filter(
      (v) => v.status === "evaluated",
    );
    // All non-windows rules should evaluate (not show as skipped)
    expect(
      result.skipped_rules.every(
        (s) => s.rule_name === "Window Safety Distance",
      ),
    ).toBe(true);
  });

  // -------------------------------------------------------------------------
  // 9. Determinism: same input produces identical output
  // -------------------------------------------------------------------------

  it("produces deterministic results (except evaluation_id)", () => {
    const result1 = evaluate(OBS_MULTIPLE_FAILS, SEED_RULES);
    const result2 = evaluate(OBS_MULTIPLE_FAILS, SEED_RULES);

    // evaluation_id is random, so exclude it for comparison
    const { evaluation_id: _id1, ...rest1 } = result1;
    const { evaluation_id: _id2, ...rest2 } = result2;

    expect(rest1).toEqual(rest2);
  });

  // -------------------------------------------------------------------------
  // 10. Summary counts are correct for each scenario
  // -------------------------------------------------------------------------

  it("produces correct summary counts for all passing", () => {
    const result = evaluate(OBS_ALL_PASSING, SEED_RULES);

    expect(result.summary.total_vulnerabilities).toBe(0);
    expect(result.summary.auto_decline_vulnerabilities).toBe(0);
    expect(result.summary.mitigatable).toBe(0);
    expect(result.summary.bridge_mitigations_available).toBe(0);
  });

  it("produces correct summary counts for multiple failures", () => {
    const result = evaluate(OBS_MULTIPLE_FAILS, SEED_RULES);

    expect(result.summary.total_vulnerabilities).toBe(3);
    expect(result.summary.auto_decline_vulnerabilities).toBe(0);
    expect(result.summary.mitigatable).toBe(3);
    // Windows rule has 3 bridge mitigations
    expect(result.summary.bridge_mitigations_available).toBe(3);
  });

  it("produces correct summary counts for auto-decline", () => {
    const result = evaluate(OBS_AUTO_DECLINE, SEED_RULES);

    expect(result.summary.auto_decline_vulnerabilities).toBe(1);
    expect(result.summary.total_vulnerabilities).toBe(1);
  });

  // -------------------------------------------------------------------------
  // 11. Each vulnerability includes the rule's mitigations
  // -------------------------------------------------------------------------

  it("attaches the correct mitigations to each vulnerability", () => {
    const result = evaluate(OBS_MULTIPLE_FAILS, SEED_RULES);

    const atticVuln = result.vulnerabilities.find(
      (v) => v.rule_name === "Attic Vent",
    );
    expect(atticVuln!.mitigations).toEqual(ATTIC_VENT_RULE.mitigations);

    const roofVuln = result.vulnerabilities.find(
      (v) => v.rule_name === "Roof",
    );
    expect(roofVuln!.mitigations).toEqual(ROOF_RULE.mitigations);

    const windowsVuln = result.vulnerabilities.find(
      (v) => v.rule_name === "Window Safety Distance",
    );
    expect(windowsVuln!.mitigations).toEqual(WINDOWS_RULE.mitigations);
  });

  // -------------------------------------------------------------------------
  // 12. Auto-declined result still shows other vulnerabilities
  // -------------------------------------------------------------------------

  it("shows all vulnerabilities even when auto-declined", () => {
    // Use observations that trigger both Home-to-Home (auto-decline) and Attic Vent
    const obs = {
      ...OBS_AUTO_DECLINE,
      attic_vent_screens: "Standard", // triggers Attic Vent too
    };
    const result = evaluate(obs, SEED_RULES);

    expect(result.auto_declined).toBe(true);
    // Should have at least Home-to-Home + Attic Vent
    expect(result.vulnerabilities.length).toBeGreaterThanOrEqual(2);

    const homeVuln = result.vulnerabilities.find(
      (v) => v.rule_name === "Home-to-Home Distance",
    );
    const atticVuln = result.vulnerabilities.find(
      (v) => v.rule_name === "Attic Vent",
    );
    expect(homeVuln).toBeDefined();
    expect(atticVuln).toBeDefined();
  });

  // -------------------------------------------------------------------------
  // 13. Skipped rules include reason and missing field names
  // -------------------------------------------------------------------------

  it("includes reason and missing field names in skipped rules", () => {
    const { attic_vent_screens, vegetation, ...obs } = OBS_ALL_PASSING;
    const result = evaluate(obs, SEED_RULES);

    expect(result.skipped_rules.length).toBeGreaterThanOrEqual(2);

    for (const skipped of result.skipped_rules) {
      expect(skipped.reason).toBeTruthy();
      expect(skipped.reason).toContain("Missing");
      expect(skipped.missingFields.length).toBeGreaterThan(0);
      expect(skipped.rule_id).toBeTruthy();
      expect(skipped.rule_name).toBeTruthy();
    }
  });

  // -------------------------------------------------------------------------
  // 14. Empty rules array: 0 vulnerabilities, not auto-declined
  // -------------------------------------------------------------------------

  it("returns 0 vulnerabilities and not auto-declined for empty rules array", () => {
    const result = evaluate(OBS_ALL_PASSING, []);

    expect(result.vulnerabilities).toHaveLength(0);
    expect(result.skipped_rules).toHaveLength(0);
    expect(result.auto_declined).toBe(false);
    expect(result.summary.total_vulnerabilities).toBe(0);
  });

  // -------------------------------------------------------------------------
  // 15. Performance: evaluating 4 rules < 10ms
  // -------------------------------------------------------------------------

  it("evaluates 4 seed rules in under 10ms", () => {
    // Warm up
    evaluate(OBS_ALL_PASSING, SEED_RULES);

    const start = performance.now();
    evaluate(OBS_MULTIPLE_FAILS, SEED_RULES);
    const elapsed = performance.now() - start;

    expect(elapsed).toBeLessThan(10);
  });

  // -------------------------------------------------------------------------
  // Additional edge case: evaluation_id is always a valid UUID
  // -------------------------------------------------------------------------

  it("returns a valid UUID as evaluation_id", () => {
    const result = evaluate(OBS_ALL_PASSING, SEED_RULES);
    const uuidRegex =
      /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    expect(result.evaluation_id).toMatch(uuidRegex);
  });

  // -------------------------------------------------------------------------
  // Error handling: evaluator throws -> status: "error"
  // -------------------------------------------------------------------------

  it('includes rule with status "error" when evaluator throws', () => {
    // Create a rule with an unregistered type to trigger UnknownRuleTypeError
    const badRule = {
      id: "c0000000-0000-4000-c000-000000000001",
      name: "Bad Rule",
      description: "A rule with an unknown evaluator type",
      type: "nonexistent_type" as any,
      config: {},
      mitigations: [],
    };

    const result = evaluate(OBS_ALL_PASSING, [badRule as any]);

    const errorResult = result.vulnerabilities.find(
      (v) => v.rule_name === "Bad Rule",
    );
    expect(errorResult).toBeDefined();
    expect(errorResult!.status).toBe("error");
    expect(errorResult!.details.explanation).toContain("Evaluation error");
  });
});

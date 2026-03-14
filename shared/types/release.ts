// Release types for the Mitigation Rules Engine

import type { Rule } from "./rule.js";

export interface Release {
  id: string;
  name: string;
  published_at: string;
  published_by: string;
  is_active: boolean;
}

export interface ReleaseRule {
  id: string;
  release_id: string;
  rule_id: string;
  rule_snapshot: Rule;
}

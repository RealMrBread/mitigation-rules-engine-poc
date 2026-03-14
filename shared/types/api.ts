// API request/response types for the Mitigation Rules Engine

import type { Rule } from "./rule.js";
import type { Role, User } from "./user.js";
import type { Settings } from "./settings.js";

// --- Generic response wrappers ---

export interface ApiError {
  error: {
    code: string;
    message: string;
    details?: any;
  };
}

export interface ApiResponse<T> {
  data: T;
}

// --- Evaluation ---

export interface EvaluateRequest {
  observations: Record<string, any>;
  release_id: string | null;
}

export interface SelectMitigationsRequest {
  selections: Array<{
    rule_id: string;
    mitigation_id: string;
    category: "full" | "bridge";
  }>;
}

// --- Rules ---

export type CreateRuleRequest = Omit<Rule, "id">;

export type UpdateRuleRequest = Partial<CreateRuleRequest> & { version: number };

// --- Releases ---

export interface CreateReleaseRequest {
  name: string;
}

// --- Users ---

export interface CreateUserRequest {
  email: string;
  password: string;
  role: Role;
}

// --- Settings ---

export type UpdateSettingsRequest = Partial<Settings>;

// --- Auth ---

export interface LoginRequest {
  email: string;
  password: string;
}

export interface LoginResponse {
  token: string;
  user: User;
}

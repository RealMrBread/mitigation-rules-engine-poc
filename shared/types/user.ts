// User types for the Mitigation Rules Engine

export type Role = "underwriter" | "applied_science" | "admin";

export interface User {
  id: string;
  email: string;
  role: Role;
}

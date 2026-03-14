import { z } from "zod";

// ---------------------------------------------------------------------------
// Role enum (shared with type layer)
// ---------------------------------------------------------------------------

export const RoleSchema = z.enum(["underwriter", "applied_science", "admin"]);

// ---------------------------------------------------------------------------
// CreateUserRequest schema
// ---------------------------------------------------------------------------

export const CreateUserRequestSchema = z.object({
  email: z.string().email("Invalid email address"),
  password: z.string().min(8, "Password must be at least 8 characters"),
  role: RoleSchema,
});

// ---------------------------------------------------------------------------
// LoginRequest schema
// ---------------------------------------------------------------------------

export const LoginRequestSchema = z.object({
  email: z.string().email("Invalid email address"),
  password: z.string().min(1, "Password is required"),
});

import { z } from "zod";

// ---------------------------------------------------------------------------
// CreateReleaseRequest schema
// ---------------------------------------------------------------------------

export const CreateReleaseRequestSchema = z.object({
  name: z.string().min(1, "Release name is required"),
});

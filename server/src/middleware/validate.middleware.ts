import { Request, Response, NextFunction } from 'express';
import { ZodSchema, ZodError } from 'zod';
import type { ApiError } from '@shared/types/api.js';

/**
 * Factory that returns middleware validating req.body against a Zod schema.
 *
 * On success the parsed (and potentially transformed) data replaces req.body.
 * On failure a 400 response is returned with Zod error details.
 */
export function validateBody(schema: ZodSchema) {
  return (req: Request, res: Response, next: NextFunction): void => {
    const result = schema.safeParse(req.body);

    if (!result.success) {
      const zodError = result.error as ZodError;
      const body: ApiError = {
        error: {
          code: 'VALIDATION_ERROR',
          message: 'Request body validation failed',
          details: zodError.issues,
        },
      };
      res.status(400).json(body);
      return;
    }

    req.body = result.data;
    next();
  };
}

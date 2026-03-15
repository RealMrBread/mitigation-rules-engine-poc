import { Request, Response, NextFunction } from 'express';
import { ZodError } from 'zod';
import { JsonWebTokenError, TokenExpiredError } from 'jsonwebtoken';
import { ConflictError } from '../db/errors.js';
import { AppError } from '../lib/errors.js';
import type { ApiError } from '@shared/types/api.js';

/**
 * Global Express error handler.
 *
 * Maps known error types to appropriate HTTP status codes and returns
 * a consistent { error: { code, message, details? } } response body.
 */
export function errorHandler(
  err: Error,
  _req: Request,
  res: Response,
  _next: NextFunction,
): void {
  // AppError hierarchy (includes NotFoundError, UnauthorizedError, etc.)
  if (err instanceof AppError) {
    const body: ApiError = {
      error: {
        code: err.code,
        message: err.message,
        ...(err.details !== undefined && { details: err.details }),
      },
    };
    res.status(err.statusCode).json(body);
    return;
  }

  // Optimistic-locking conflict from Prisma layer
  if (err instanceof ConflictError) {
    const body: ApiError = {
      error: {
        code: 'CONFLICT',
        message: err.message,
      },
    };
    res.status(409).json(body);
    return;
  }

  // Zod validation errors
  if (err instanceof ZodError) {
    const body: ApiError = {
      error: {
        code: 'VALIDATION_ERROR',
        message: 'Validation failed',
        details: err.issues,
      },
    };
    res.status(400).json(body);
    return;
  }

  // JWT errors
  if (err instanceof TokenExpiredError) {
    const body: ApiError = {
      error: {
        code: 'TOKEN_EXPIRED',
        message: 'Token has expired',
      },
    };
    res.status(401).json(body);
    return;
  }

  if (err instanceof JsonWebTokenError) {
    const body: ApiError = {
      error: {
        code: 'INVALID_TOKEN',
        message: 'Invalid token',
      },
    };
    res.status(401).json(body);
    return;
  }

  // Unknown / unexpected errors
  console.error('Unhandled error:', err);
  const body: ApiError = {
    error: {
      code: 'INTERNAL_ERROR',
      message: 'An unexpected error occurred',
    },
  };
  res.status(500).json(body);
}

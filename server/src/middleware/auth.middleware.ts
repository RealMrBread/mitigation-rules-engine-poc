import { Request, Response, NextFunction } from 'express';
import { verifyToken } from '../lib/jwt.js';
import { userRepository } from '../db/repositories/user.repository.js';
import type { ApiError } from '@shared/types/api.js';

/**
 * Express middleware that authenticates requests via Bearer token.
 *
 * Reads the Authorization header, verifies the JWT, looks up the user
 * in the database, and attaches the user to req.user.
 */
export async function authMiddleware(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  const header = req.headers.authorization;

  if (!header || !header.startsWith('Bearer ')) {
    const body: ApiError = {
      error: {
        code: 'UNAUTHORIZED',
        message: 'Missing or malformed Authorization header',
      },
    };
    res.status(401).json(body);
    return;
  }

  const token = header.slice(7); // strip "Bearer "

  try {
    const payload = verifyToken(token);
    const user = await userRepository.findById(payload.userId);

    if (!user) {
      const body: ApiError = {
        error: {
          code: 'UNAUTHORIZED',
          message: 'User not found',
        },
      };
      res.status(401).json(body);
      return;
    }

    req.user = { id: user.id, email: user.email, role: user.role };
    next();
  } catch (err) {
    const body: ApiError = {
      error: {
        code: 'UNAUTHORIZED',
        message: 'Invalid or expired token',
      },
    };
    res.status(401).json(body);
    return;
  }
}

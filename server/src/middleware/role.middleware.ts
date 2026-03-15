import { Request, Response, NextFunction } from 'express';
import type { ApiError } from '@shared/types/api.js';

/**
 * Factory that returns middleware enforcing that the authenticated user
 * has one of the specified roles.
 *
 * Must be placed after authMiddleware so that req.user is populated.
 */
export function requireRole(...roles: string[]) {
  return (req: Request, res: Response, next: NextFunction): void => {
    const user = req.user;

    if (!user) {
      const body: ApiError = {
        error: {
          code: 'UNAUTHORIZED',
          message: 'Authentication required',
        },
      };
      res.status(401).json(body);
      return;
    }

    if (!roles.includes(user.role)) {
      const body: ApiError = {
        error: {
          code: 'FORBIDDEN',
          message: `Requires one of roles: ${roles.join(', ')}`,
        },
      };
      res.status(403).json(body);
      return;
    }

    next();
  };
}

import { Router, Request, Response, NextFunction } from 'express';
import { validateBody } from '../middleware/validate.middleware.js';
import { authMiddleware } from '../middleware/auth.middleware.js';
import { requireRole } from '../middleware/role.middleware.js';
import { LoginRequestSchema, CreateUserRequestSchema } from '@shared/schemas/user.schema.js';
import * as authService from '../services/auth.service.js';
import type { ApiResponse, LoginResponse } from '@shared/types/api.js';
import type { User } from '@shared/types/user.js';

const router = Router();

/**
 * POST /login
 * Public endpoint. Validates body against LoginRequestSchema,
 * authenticates with email + password, returns JWT + user.
 */
router.post(
  '/login',
  validateBody(LoginRequestSchema),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { email, password } = req.body;
      const result = await authService.login(email, password);
      const body: ApiResponse<LoginResponse> = { data: result };
      res.json(body);
    } catch (err) {
      next(err);
    }
  },
);

/**
 * POST /register
 * Admin-only endpoint. Creates a new user account.
 */
router.post(
  '/register',
  authMiddleware,
  requireRole('admin'),
  validateBody(CreateUserRequestSchema),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { email, password, role } = req.body;
      const user = await authService.register(email, password, role);
      const body: ApiResponse<User> = { data: user };
      res.status(201).json(body);
    } catch (err) {
      next(err);
    }
  },
);

export default router;

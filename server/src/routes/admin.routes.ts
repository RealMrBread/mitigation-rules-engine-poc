import { Router, Request, Response, NextFunction } from 'express';
import { authMiddleware, requireRole, validateBody } from '../middleware/index.js';
import { UpdateSettingsRequestSchema } from '@shared/schemas/settings.schema.js';
import { CreateUserRequestSchema } from '@shared/schemas/user.schema.js';
import * as adminService from '../services/admin.service.js';
import { auditLogRepository } from '../db/repositories/audit-log.repository.js';
import type { ApiResponse } from '@shared/types/api.js';
import type { User } from '@shared/types/user.js';

const router = Router();

// All admin routes require auth + admin role
router.use(authMiddleware, requireRole('admin'));

/**
 * GET / -- get all settings
 */
router.get(
  '/settings',
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const settings = await adminService.getSettings();
      const body: ApiResponse<typeof settings> = { data: settings };
      res.json(body);
    } catch (err) {
      next(err);
    }
  },
);

/**
 * PUT /settings -- update settings
 */
router.put(
  '/settings',
  validateBody(UpdateSettingsRequestSchema),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const settings = await adminService.updateSettings(req.body, req.user!.id);
      const body: ApiResponse<typeof settings> = { data: settings };
      res.json(body);
    } catch (err) {
      next(err);
    }
  },
);

/**
 * GET /users -- list all users (no password hashes)
 */
router.get(
  '/users',
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const users = await adminService.listUsers();
      const body: ApiResponse<User[]> = { data: users };
      res.json(body);
    } catch (err) {
      next(err);
    }
  },
);

/**
 * POST /users -- create a new user
 */
router.post(
  '/users',
  validateBody(CreateUserRequestSchema),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { email, password, role } = req.body;
      const user = await adminService.createUser(email, password, role, req.user!.id);
      const body: ApiResponse<User> = { data: user };
      res.status(201).json(body);
    } catch (err) {
      next(err);
    }
  },
);

router.get(
  '/audit-log',
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const entries = await auditLogRepository.list();
      const data = entries.map((e) => ({
        id: e.id,
        action: e.action,
        entity_type: e.entityType,
        entity_id: e.entityId,
        user_id: e.userId,
        details: e.details,
        created_at: e.createdAt.toISOString(),
      }));
      res.json({ data });
    } catch (err) {
      next(err);
    }
  },
);

export default router;

import { Router, Request, Response, NextFunction } from 'express';
import { authMiddleware, requireRole, validateBody } from '../middleware/index.js';
import { CreateReleaseRequestSchema } from '@shared/schemas/release.schema.js';
import * as releaseService from '../services/release.service.js';
import type { ApiResponse } from '@shared/types/api.js';

const router = Router();

/**
 * GET /active/rules — get rules from the currently active release.
 * Accessible by both applied_science AND underwriter roles.
 * Must be defined BEFORE the /:id routes to avoid matching "active" as an id.
 */
router.get(
  '/active/rules',
  authMiddleware,
  requireRole('applied_science', 'underwriter'),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const rules = await releaseService.getActiveRules();
      const body: ApiResponse<typeof rules> = { data: rules };
      res.json(body);
    } catch (err) {
      next(err);
    }
  },
);

// All other release routes require auth + applied_science role
router.use(authMiddleware, requireRole('applied_science'));

/**
 * GET / — list all releases
 */
router.get('/', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const releases = await releaseService.list();
    const body: ApiResponse<typeof releases> = { data: releases };
    res.json(body);
  } catch (err) {
    next(err);
  }
});

/**
 * POST / — publish a new release (snapshots all current draft rules)
 */
router.post(
  '/',
  validateBody(CreateReleaseRequestSchema),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const release = await releaseService.publish(req.body.name, req.user!.id);
      const body: ApiResponse<typeof release> = { data: release };
      res.status(201).json(body);
    } catch (err) {
      next(err);
    }
  },
);

/**
 * GET /:id — get release by id
 */
router.get('/:id', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const release = await releaseService.findById(req.params.id);
    const body: ApiResponse<typeof release> = { data: release };
    res.json(body);
  } catch (err) {
    next(err);
  }
});

/**
 * GET /:id/rules — get rules for a specific release
 */
router.get('/:id/rules', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const rules = await releaseService.getRulesForRelease(req.params.id);
    const body: ApiResponse<typeof rules> = { data: rules };
    res.json(body);
  } catch (err) {
    next(err);
  }
});

/**
 * PUT /:id/activate — activate a release
 */
router.put('/:id/activate', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const release = await releaseService.activate(req.params.id, req.user!.id);
    const body: ApiResponse<typeof release> = { data: release };
    res.json(body);
  } catch (err) {
    next(err);
  }
});

export default router;

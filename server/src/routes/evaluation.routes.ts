import { Router, Request, Response, NextFunction } from 'express';
import { authMiddleware, validateBody } from '../middleware/index.js';
import {
  EvaluateRequestSchema,
  SelectMitigationsRequestSchema,
} from '@shared/schemas/evaluation.schema.js';
import * as evaluationService from '../services/evaluation.service.js';
import type { ApiResponse } from '@shared/types/api.js';

const router = Router();

// All evaluation routes require authentication
router.use(authMiddleware);

/**
 * POST /evaluate — evaluate observations against the active (or specified) release
 */
router.post(
  '/evaluate',
  validateBody(EvaluateRequestSchema),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { observations, release_id } = req.body;
      const result = await evaluationService.evaluate(
        observations,
        release_id,
        req.user!.id,
      );
      const body: ApiResponse<typeof result> = { data: result };
      res.json(body);
    } catch (err) {
      next(err);
    }
  },
);

/**
 * POST /evaluate/:id/mitigations — save mitigation selections for an evaluation
 */
router.post(
  '/evaluate/:id/mitigations',
  validateBody(SelectMitigationsRequestSchema),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      await evaluationService.selectMitigations(
        req.params.id as string,
        req.body.selections,
        req.user!.id,
      );
      const body: ApiResponse<{ success: boolean }> = {
        data: { success: true },
      };
      res.json(body);
    } catch (err) {
      next(err);
    }
  },
);

/**
 * GET /evaluations — list evaluations, optionally filtered by property_id query param
 */
router.get(
  '/evaluations',
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const propertyId = req.query.property_id as string | undefined;
      const evaluations = await evaluationService.listEvaluations(propertyId);
      const body: ApiResponse<typeof evaluations> = { data: evaluations };
      res.json(body);
    } catch (err) {
      next(err);
    }
  },
);

/**
 * GET /evaluations/:id — get a single evaluation by id
 */
router.get(
  '/evaluations/:id',
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const evaluation = await evaluationService.getEvaluationById(
        req.params.id as string,
      );
      const body: ApiResponse<typeof evaluation> = { data: evaluation };
      res.json(body);
    } catch (err) {
      next(err);
    }
  },
);

export default router;

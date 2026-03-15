import { Router, Request, Response, NextFunction } from 'express';
import { authMiddleware, requireRole, validateBody } from '../middleware/index.js';
import * as ruleService from '../services/rule.service.js';
import { z } from 'zod';
import {
  RuleTypeSchema,
  SimpleConfigSchema,
  ConditionalConfigSchema,
  ComputedConfigSchema,
  MitigationSchema,
} from '@shared/schemas/rule.schema.js';
import type { ApiResponse } from '@shared/types/api.js';

// ---------------------------------------------------------------------------
// Request body schemas (server-side, no id — server generates it)
// ---------------------------------------------------------------------------

const CreateRuleBodySchema = z.discriminatedUnion('type', [
  z.object({
    type: z.literal('simple_threshold'),
    name: z.string().min(1),
    description: z.string().min(1),
    config: SimpleConfigSchema,
    mitigations: z.array(MitigationSchema),
  }),
  z.object({
    type: z.literal('conditional_threshold'),
    name: z.string().min(1),
    description: z.string().min(1),
    config: ConditionalConfigSchema,
    mitigations: z.array(MitigationSchema),
  }),
  z.object({
    type: z.literal('computed_with_modifiers'),
    name: z.string().min(1),
    description: z.string().min(1),
    config: ComputedConfigSchema,
    mitigations: z.array(MitigationSchema),
  }),
]);

const UpdateRuleBodySchema = z.object({
  name: z.string().min(1).optional(),
  description: z.string().min(1).optional(),
  type: RuleTypeSchema.optional(),
  config: z.any().optional(),
  mitigations: z.array(MitigationSchema).optional(),
  version: z.number().int().positive(),
});

const TestRuleBodySchema = z.object({
  observations: z.record(z.string(), z.any()),
});

// ---------------------------------------------------------------------------
// Router
// ---------------------------------------------------------------------------

const router = Router();

// All rule routes require auth + applied_science role
router.use(authMiddleware, requireRole('applied_science'));

/**
 * GET / — list all draft rules
 */
router.get('/', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const rules = await ruleService.list();
    const body: ApiResponse<typeof rules> = { data: rules };
    res.json(body);
  } catch (err) {
    next(err);
  }
});

/**
 * POST / — create a new rule
 */
router.post(
  '/',
  validateBody(CreateRuleBodySchema),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const rule = await ruleService.create(req.body, req.user!.id);
      const body: ApiResponse<typeof rule> = { data: rule };
      res.status(201).json(body);
    } catch (err) {
      next(err);
    }
  },
);

/**
 * GET /:id — get rule by id
 */
router.get('/:id', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const rule = await ruleService.findById(req.params.id);
    const body: ApiResponse<typeof rule> = { data: rule };
    res.json(body);
  } catch (err) {
    next(err);
  }
});

/**
 * PUT /:id — update a rule (version in body for optimistic locking)
 */
router.put(
  '/:id',
  validateBody(UpdateRuleBodySchema),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { version, ...data } = req.body;
      const rule = await ruleService.update(req.params.id, data, version);
      const body: ApiResponse<typeof rule> = { data: rule };
      res.json(body);
    } catch (err) {
      next(err);
    }
  },
);

/**
 * DELETE /:id — delete a rule
 */
router.delete('/:id', async (req: Request, res: Response, next: NextFunction) => {
  try {
    await ruleService.remove(req.params.id);
    res.status(204).send();
  } catch (err) {
    next(err);
  }
});

/**
 * POST /:id/test — test a rule against observations (no DB save)
 */
router.post(
  '/:id/test',
  validateBody(TestRuleBodySchema),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const result = await ruleService.test(req.params.id, req.body.observations);
      const body: ApiResponse<typeof result> = { data: result };
      res.json(body);
    } catch (err) {
      next(err);
    }
  },
);

export default router;

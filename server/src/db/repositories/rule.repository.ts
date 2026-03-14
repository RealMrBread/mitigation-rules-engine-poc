import { PrismaClient, Rule } from '@prisma/client';
import prisma from '../client.js';
import { ConflictError } from '../errors.js';

export interface CreateRuleData {
  name: string;
  description?: string;
  type: string;
  config: unknown;
  mitigations: unknown;
  createdById: string;
}

export interface UpdateRuleData {
  name?: string;
  description?: string;
  type?: string;
  config?: unknown;
  mitigations?: unknown;
}

export class RuleRepository {
  constructor(private readonly db: PrismaClient) {}

  async create(data: CreateRuleData): Promise<Rule> {
    return this.db.rule.create({
      data: {
        name: data.name,
        description: data.description,
        type: data.type,
        config: data.config as any,
        mitigations: data.mitigations as any,
        createdById: data.createdById,
        version: 1,
      },
    });
  }

  async findById(id: string): Promise<Rule | null> {
    return this.db.rule.findUnique({ where: { id } });
  }

  async list(): Promise<Rule[]> {
    return this.db.rule.findMany({ orderBy: { updatedAt: 'desc' } });
  }

  /**
   * Update a rule using optimistic locking.
   * The WHERE clause includes both `id` AND `version` so that a concurrent
   * modification (which would have incremented the version) causes zero rows
   * to match, and a ConflictError is thrown.
   */
  async update(id: string, data: UpdateRuleData, expectedVersion: number): Promise<Rule> {
    const [updated] = await this.db.$queryRawUnsafe<Rule[]>(
      `UPDATE rules
       SET name        = COALESCE($1, name),
           description = COALESCE($2, description),
           type        = COALESCE($3, type),
           config      = COALESCE($4::jsonb, config),
           mitigations = COALESCE($5::jsonb, mitigations),
           version     = version + 1,
           updated_at  = NOW()
       WHERE id = $6::uuid AND version = $7
       RETURNING *`,
      data.name ?? null,
      data.description ?? null,
      data.type ?? null,
      data.config !== undefined ? JSON.stringify(data.config) : null,
      data.mitigations !== undefined ? JSON.stringify(data.mitigations) : null,
      id,
      expectedVersion,
    );

    if (!updated) {
      throw new ConflictError(
        `Rule ${id} version conflict: expected version ${expectedVersion}`,
      );
    }

    return updated;
  }

  async delete(id: string): Promise<void> {
    await this.db.rule.delete({ where: { id } });
  }
}

export const ruleRepository = new RuleRepository(prisma);

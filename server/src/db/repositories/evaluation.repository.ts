import { PrismaClient, Evaluation, EvaluationMitigation } from '@prisma/client';
import prisma from '../client.js';

export interface CreateEvaluationData {
  propertyId: string;
  releaseId: string;
  observations: unknown;
  result: unknown;
  isAutoDeclined: boolean;
  createdById: string;
}

export interface MitigationSelection {
  ruleId: string;
  mitigationId: string;
  category: string;
}

export type EvaluationWithMitigations = Evaluation & {
  mitigations: EvaluationMitigation[];
};

export class EvaluationRepository {
  constructor(private readonly db: PrismaClient) {}

  async save(data: CreateEvaluationData): Promise<Evaluation> {
    return this.db.evaluation.create({
      data: {
        propertyId: data.propertyId,
        releaseId: data.releaseId,
        observations: data.observations as any,
        result: data.result as any,
        isAutoDeclined: data.isAutoDeclined,
        createdById: data.createdById,
      },
    });
  }

  async saveMitigations(
    evaluationId: string,
    selections: MitigationSelection[],
  ): Promise<void> {
    if (selections.length === 0) return;

    await this.db.evaluationMitigation.createMany({
      data: selections.map((s) => ({
        evaluationId,
        ruleId: s.ruleId,
        mitigationId: s.mitigationId,
        category: s.category,
      })),
    });
  }

  async findById(id: string): Promise<EvaluationWithMitigations | null> {
    return this.db.evaluation.findUnique({
      where: { id },
      include: { mitigations: true },
    });
  }

  async listByProperty(propertyId: string): Promise<Evaluation[]> {
    return this.db.evaluation.findMany({
      where: { propertyId },
      orderBy: { createdAt: 'desc' },
    });
  }
}

export const evaluationRepository = new EvaluationRepository(prisma);

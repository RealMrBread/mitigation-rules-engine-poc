import { PrismaClient, AuditLog } from '@prisma/client';
import prisma from '../client.js';

export class AuditLogRepository {
  constructor(private readonly db: PrismaClient) {}

  async append(
    action: string,
    entityType: string,
    entityId: string | null,
    userId: string,
    details?: unknown,
  ): Promise<AuditLog> {
    return this.db.auditLog.create({
      data: {
        action,
        entityType,
        entityId: entityId ?? undefined,
        userId,
        details: details !== undefined ? (details as any) : undefined,
      },
    });
  }

  async list(limit = 100): Promise<AuditLog[]> {
    return this.db.auditLog.findMany({
      orderBy: { createdAt: 'desc' },
      take: limit,
    });
  }
}

export const auditLogRepository = new AuditLogRepository(prisma);

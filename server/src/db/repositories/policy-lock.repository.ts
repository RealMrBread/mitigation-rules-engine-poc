import { PrismaClient, PolicyLock } from '@prisma/client';
import prisma from '../client.js';

export class PolicyLockRepository {
  constructor(private readonly db: PrismaClient) {}

  async create(
    propertyId: string,
    releaseId: string,
    lockedById: string,
  ): Promise<PolicyLock> {
    return this.db.policyLock.create({
      data: { propertyId, releaseId, lockedById },
    });
  }

  async findByPropertyId(propertyId: string): Promise<PolicyLock | null> {
    return this.db.policyLock.findUnique({ where: { propertyId } });
  }
}

export const policyLockRepository = new PolicyLockRepository(prisma);

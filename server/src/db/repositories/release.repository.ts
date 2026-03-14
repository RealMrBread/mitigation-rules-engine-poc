import { PrismaClient, Release, ReleaseRule } from '@prisma/client';
import prisma from '../client.js';

export type ReleaseWithRules = Release & { releaseRules: ReleaseRule[] };

export class ReleaseRepository {
  constructor(private readonly db: PrismaClient) {}

  /**
   * Publish a new release by atomically snapshotting every current draft rule
   * into release_rules rows and creating the release record.
   */
  async publish(name: string, publishedById: string): Promise<ReleaseWithRules> {
    return this.db.$transaction(async (tx) => {
      // Load all current draft rules
      const draftRules = await tx.rule.findMany();

      // Create the release
      const release = await tx.release.create({
        data: {
          name,
          publishedBy: publishedById,
          isActive: false,
        },
      });

      // Snapshot each draft rule into release_rules
      const releaseRules: ReleaseRule[] = [];
      for (const rule of draftRules) {
        const rr = await tx.releaseRule.create({
          data: {
            releaseId: release.id,
            ruleId: rule.id,
            ruleSnapshot: {
              id: rule.id,
              name: rule.name,
              description: rule.description,
              type: rule.type,
              config: rule.config,
              mitigations: rule.mitigations,
              version: rule.version,
            },
          },
        });
        releaseRules.push(rr);
      }

      return { ...release, releaseRules };
    });
  }

  /**
   * Activate a release. Exactly one release may be active at a time:
   * deactivate all existing releases, then activate the target.
   */
  async activate(id: string): Promise<Release> {
    return this.db.$transaction(async (tx) => {
      // Deactivate all releases
      await tx.release.updateMany({
        data: { isActive: false },
      });

      // Activate the target release
      return tx.release.update({
        where: { id },
        data: { isActive: true },
      });
    });
  }

  async findActive(): Promise<Release | null> {
    return this.db.release.findFirst({ where: { isActive: true } });
  }

  async findById(id: string): Promise<Release | null> {
    return this.db.release.findUnique({ where: { id } });
  }

  async findByIdWithRules(id: string): Promise<ReleaseWithRules | null> {
    return this.db.release.findUnique({
      where: { id },
      include: { releaseRules: true },
    });
  }

  async list(): Promise<Release[]> {
    return this.db.release.findMany({ orderBy: { publishedAt: 'desc' } });
  }
}

export const releaseRepository = new ReleaseRepository(prisma);

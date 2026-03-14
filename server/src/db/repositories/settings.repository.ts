import { PrismaClient } from '@prisma/client';
import prisma from '../client.js';

export class SettingsRepository {
  constructor(private readonly db: PrismaClient) {}

  async get(key: string): Promise<unknown> {
    const setting = await this.db.setting.findUnique({ where: { key } });
    return setting?.value ?? null;
  }

  async getAll(): Promise<Record<string, unknown>> {
    const settings = await this.db.setting.findMany();
    const result: Record<string, unknown> = {};
    for (const s of settings) {
      result[s.key] = s.value;
    }
    return result;
  }

  async set(key: string, value: unknown): Promise<void> {
    await this.db.setting.upsert({
      where: { key },
      update: { value: value as any },
      create: { key, value: value as any },
    });
  }
}

export const settingsRepository = new SettingsRepository(prisma);

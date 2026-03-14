import { PrismaClient, User } from '@prisma/client';
import prisma from '../client.js';

export class UserRepository {
  constructor(private readonly db: PrismaClient) {}

  async create(email: string, passwordHash: string, role: string): Promise<User> {
    return this.db.user.create({
      data: { email, passwordHash, role },
    });
  }

  async findByEmail(email: string): Promise<User | null> {
    return this.db.user.findUnique({ where: { email } });
  }

  async findById(id: string): Promise<User | null> {
    return this.db.user.findUnique({ where: { id } });
  }

  async list(): Promise<User[]> {
    return this.db.user.findMany({ orderBy: { createdAt: 'desc' } });
  }
}

export const userRepository = new UserRepository(prisma);

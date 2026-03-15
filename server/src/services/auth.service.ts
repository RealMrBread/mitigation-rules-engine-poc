import bcrypt from 'bcryptjs';
import { userRepository } from '../db/repositories/user.repository.js';
import { signToken } from '../lib/jwt.js';
import { UnauthorizedError } from '../lib/errors.js';
import type { User as PrismaUser } from '@prisma/client';
import type { User } from '@shared/types/user.js';

const BCRYPT_ROUNDS = 12;

/**
 * Strip the passwordHash field from a Prisma User and return a safe User DTO.
 */
function toUserDTO(user: PrismaUser): User {
  return { id: user.id, email: user.email, role: user.role as User['role'] };
}

/**
 * Authenticate a user by email and password.
 * Returns a signed JWT and user DTO, or throws UnauthorizedError.
 */
export async function login(
  email: string,
  password: string,
): Promise<{ token: string; user: User }> {
  const user = await userRepository.findByEmail(email);

  if (!user) {
    throw new UnauthorizedError('Invalid email or password');
  }

  const valid = await bcrypt.compare(password, user.passwordHash);

  if (!valid) {
    throw new UnauthorizedError('Invalid email or password');
  }

  const token = signToken({
    userId: user.id,
    email: user.email,
    role: user.role,
  });

  return { token, user: toUserDTO(user) };
}

/**
 * Register a new user. Hashes the password and persists via repository.
 * Throws AppError(409) if the email already exists.
 */
export async function register(
  email: string,
  password: string,
  role: string,
): Promise<User> {
  const passwordHash = await bcrypt.hash(password, BCRYPT_ROUNDS);

  try {
    const user = await userRepository.create(email, passwordHash, role);
    return toUserDTO(user);
  } catch (err: any) {
    // Prisma unique constraint violation code
    if (err?.code === 'P2002') {
      const { AppError } = await import('../lib/errors.js');
      throw new AppError(409, 'CONFLICT', 'A user with this email already exists');
    }
    throw err;
  }
}

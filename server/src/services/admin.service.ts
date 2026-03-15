import { settingsRepository } from '../db/repositories/settings.repository.js';
import { userRepository } from '../db/repositories/user.repository.js';
import * as authService from './auth.service.js';
import type { User } from '@shared/types/user.js';

/**
 * Get all settings as a key-value map.
 */
export async function getSettings(): Promise<Record<string, unknown>> {
  return settingsRepository.getAll();
}

/**
 * Update settings. Each key in the data object is upserted individually.
 * Returns the full settings map after updates.
 */
export async function updateSettings(
  data: Record<string, unknown>,
): Promise<Record<string, unknown>> {
  for (const [key, value] of Object.entries(data)) {
    await settingsRepository.set(key, value);
  }
  return settingsRepository.getAll();
}

/**
 * List all users without exposing password hashes.
 */
export async function listUsers(): Promise<User[]> {
  const users = await userRepository.list();
  return users.map((u) => ({ id: u.id, email: u.email, role: u.role as User['role'] }));
}

/**
 * Create a new user by delegating to the auth service register function.
 */
export async function createUser(
  email: string,
  password: string,
  role: string,
): Promise<User> {
  return authService.register(email, password, role);
}

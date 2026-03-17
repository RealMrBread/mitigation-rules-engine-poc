import { type Page, expect } from '@playwright/test';

/**
 * Log in via the /login form and wait for redirect.
 * Each test calls this independently so tests remain isolated.
 */
export async function login(page: Page, email: string, password: string) {
  await page.goto('/login');
  await page.getByLabel('Email').fill(email);
  await page.getByLabel('Password').fill(password);
  await page.getByRole('button', { name: 'Sign in' }).click();
  // After successful login the app redirects away from /login
  await expect(page).not.toHaveURL(/\/login/, { timeout: 10_000 });
}

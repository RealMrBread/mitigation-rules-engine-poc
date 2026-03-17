import { test, expect } from '@playwright/test';
import { login } from './helpers';

test.describe('Journey 4: Admin settings, user creation, and audit log', () => {
  test('views and updates bridge limit in settings', async ({ page }) => {
    // --- Login as admin ---
    await login(page, 'admin@test.com', 'password123');

    // --- Navigate to Settings ---
    await page.goto('/settings');
    await expect(
      page.getByRole('heading', { name: 'Settings' }),
    ).toBeVisible();

    // Verify bridge limit input is visible and has a value
    const bridgeLimitInput = page.getByLabel('Bridge Mitigation Limit');
    await expect(bridgeLimitInput).toBeVisible();
    const currentValue = await bridgeLimitInput.inputValue();
    expect(Number(currentValue)).toBeGreaterThanOrEqual(1);

    // --- Change to 5, save ---
    await bridgeLimitInput.fill('5');
    await page.getByRole('button', { name: /Save Settings/ }).click();

    // Verify success toast
    await expect(
      page.getByText('Settings saved successfully'),
    ).toBeVisible({ timeout: 5_000 });

    // --- Restore original value ---
    await bridgeLimitInput.fill(currentValue);
    await page.getByRole('button', { name: /Save Settings/ }).click();
    await expect(
      page.getByText('Settings saved successfully'),
    ).toBeVisible({ timeout: 5_000 });
  });

  test('creates a new user', async ({ page }) => {
    await login(page, 'admin@test.com', 'password123');

    // --- Navigate to Users ---
    await page.goto('/users');
    await expect(
      page.getByRole('heading', { name: 'Users' }),
    ).toBeVisible();

    // --- Open create user form ---
    await page.getByRole('button', { name: /Create User/ }).click();

    // Fill the form
    const uniqueEmail = `e2e-user-${Date.now()}@test.com`;
    await page.getByLabel('Email', { exact: false }).last().fill(uniqueEmail);
    await page
      .getByLabel('Password', { exact: false })
      .last()
      .fill('password123');
    await page
      .getByLabel('Role', { exact: false })
      .last()
      .selectOption('underwriter');

    // Submit
    await page.getByRole('button', { name: 'Create User' }).last().click();

    // Verify success toast
    await expect(
      page.getByText(/created successfully/i),
    ).toBeVisible({ timeout: 5_000 });

    // Verify the user appears in the table
    await expect(page.getByText(uniqueEmail)).toBeVisible({ timeout: 5_000 });
  });

  test('views audit log entries', async ({ page }) => {
    await login(page, 'admin@test.com', 'password123');

    // --- Navigate to Audit Log ---
    await page.goto('/audit-log');
    await expect(
      page.getByRole('heading', { name: 'Audit Log' }),
    ).toBeVisible();

    // Verify table headers are present
    await expect(page.getByText('Timestamp')).toBeVisible();
    await expect(page.getByText('Action')).toBeVisible();
    await expect(page.getByText('Entity Type')).toBeVisible();

    // Verify at least one audit entry row exists (from seed data / previous tests)
    const tableBody = page.locator('tbody');
    const rows = tableBody.locator('tr');
    await expect(rows.first()).toBeVisible({ timeout: 10_000 });
    const rowCount = await rows.count();
    expect(rowCount).toBeGreaterThan(0);
  });
});

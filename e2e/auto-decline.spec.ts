import { test, expect } from '@playwright/test';
import { login } from './helpers';

test.describe('Journey 2: Auto-decline on Home-to-Home distance', () => {
  test('triggers auto-decline when home_to_home_distance < 15', async ({
    page,
  }) => {
    // --- Login ---
    await login(page, 'underwriter@test.com', 'password123');

    // --- Navigate to evaluation form ---
    await page.goto('/evaluation/new');
    await expect(page.getByText('Property Information')).toBeVisible();

    // --- Fill form with distance=10 (below 15 threshold) ---
    await page.getByLabel('Property ID').fill('E2E-DECLINE-001');
    await page.getByLabel('State').selectOption('CA');
    await page.getByLabel('Wildfire Risk Category').selectOption('B');
    await page.getByLabel('Roof Type').selectOption('Class A');
    await page.getByLabel('Attic Vent Screens').selectOption('None');
    await page.getByLabel('Window Type').selectOption('Tempered Glass');
    await page.getByLabel(/Home-to-Home Distance/).fill('10');

    // --- Submit ---
    await page.getByRole('button', { name: /Evaluate Property/ }).click();

    // --- Verify results page ---
    await expect(page).toHaveURL(/\/evaluation\/.*\/results/, {
      timeout: 15_000,
    });

    // Auto-decline banner should be visible
    await expect(page.getByText('Auto-Decline Triggered')).toBeVisible();

    // The Home-to-Home rule name should appear in the banner
    await expect(page.getByText(/Home-to-Home/i)).toBeVisible();

    // Other mitigatable vulnerabilities should still appear (e.g., Attic Vent)
    await expect(page.getByText(/Attic Vent/i)).toBeVisible();

    // The informational note should be visible
    await expect(
      page.getByText(/remaining mitigatable vulnerabilities/i),
    ).toBeVisible();
  });
});

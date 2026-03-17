import { test, expect } from '@playwright/test';
import { login } from './helpers';

test.describe('Journey 1: Underwriter evaluation flow', () => {
  test('submits an evaluation and sees vulnerabilities on the results page', async ({
    page,
  }) => {
    // --- Login ---
    await login(page, 'underwriter@test.com', 'password123');

    // --- Navigate to evaluation form ---
    await page.goto('/evaluation/new');
    await expect(page.getByText('Property Information')).toBeVisible();

    // --- Fill required fields ---
    await page.getByLabel('Property ID').fill('E2E-001');
    await page.getByLabel('State').selectOption('CA');
    await page.getByLabel('Wildfire Risk Category').selectOption('B');
    await page.getByLabel('Roof Type').selectOption('Class A');
    // attic_vent_screens = "None" triggers Rule 1 (Attic Vent Screens)
    await page.getByLabel('Attic Vent Screens').selectOption('None');
    await page.getByLabel('Window Type').selectOption('Tempered Glass');
    await page.getByLabel(/Home-to-Home Distance/).fill('25');

    // --- Submit ---
    await page.getByRole('button', { name: /Evaluate Property/ }).click();

    // --- Verify results page ---
    await expect(page).toHaveURL(/\/evaluation\/.*\/results/, {
      timeout: 15_000,
    });
    await expect(page.getByText('Evaluation Results')).toBeVisible();

    // At least 1 vulnerability should be shown
    const totalVulnStat = page
      .locator('text=Total Vulnerabilities')
      .locator('..');
    await expect(totalVulnStat).toBeVisible();

    // Verify "Attic Vent Screens" vulnerability appears
    await expect(page.getByText(/Attic Vent/i)).toBeVisible();
  });
});

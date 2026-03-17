import { test, expect } from '@playwright/test';
import { login } from './helpers';

test.describe('Journey 3: Rule creation and release publishing', () => {
  const uniqueRuleName = `E2E Test Rule ${Date.now()}`;
  const uniqueReleaseName = `E2E-Release-${Date.now()}`;

  test('creates a rule, publishes a release, and activates it', async ({
    page,
  }) => {
    // --- Login as scientist ---
    await login(page, 'scientist@test.com', 'password123');

    // --- Navigate to Rules list ---
    await page.goto('/rules');
    await expect(page.getByRole('heading', { name: 'Rules' })).toBeVisible();

    // --- Click "New Rule" ---
    await page.getByRole('button', { name: /New Rule/ }).click();
    await expect(page).toHaveURL(/\/rules\/new/);
    await expect(
      page.getByRole('heading', { name: 'New Rule' }),
    ).toBeVisible();

    // --- Fill basic information ---
    // The "Rule Name" input uses a plain label, not htmlFor
    await page
      .getByLabel('Rule Name', { exact: false })
      .fill(uniqueRuleName);
    await page
      .getByLabel('Description', { exact: false })
      .fill('E2E test rule description');

    // --- Select Simple Threshold type (default, but click to be explicit) ---
    await page.getByText('Simple Threshold').first().click();

    // --- Fill simple threshold config ---
    await page.getByLabel('Field', { exact: false }).fill('test_field');
    await page.getByLabel('Operator', { exact: false }).selectOption('eq');
    await page.getByLabel('Value', { exact: false }).fill('test_value');

    // --- Save the rule ---
    await page.getByRole('button', { name: /Create Rule/ }).click();

    // Should redirect to the edit page for the created rule
    await expect(page).toHaveURL(/\/rules\/[a-f0-9-]+/, { timeout: 10_000 });

    // --- Navigate back to list and verify rule appears ---
    await page.goto('/rules');
    await expect(page.getByText(uniqueRuleName)).toBeVisible({
      timeout: 10_000,
    });

    // --- Navigate to Releases ---
    await page.goto('/releases');
    await expect(
      page.getByRole('heading', { name: 'Release Manager' }),
    ).toBeVisible();

    // --- Publish a new release ---
    await page
      .getByRole('button', { name: /Publish New Release/ })
      .click();

    // Fill release name in the modal
    await page.getByLabel('Release Name', { exact: false }).fill(uniqueReleaseName);
    await page
      .getByRole('button', { name: 'Publish Release' })
      .click();

    // Wait for modal to close and release to appear
    await expect(page.getByText(uniqueReleaseName)).toBeVisible({
      timeout: 10_000,
    });

    // --- Activate the new release ---
    // Click on the release card to expand it
    await page.getByText(uniqueReleaseName).click();
    await page
      .getByRole('button', { name: /Activate This Release/ })
      .click();

    // After activation the badge should change to "Active"
    await expect(
      page.getByText(uniqueReleaseName).locator('..').locator('..').getByText('Active'),
    ).toBeVisible({ timeout: 10_000 });
  });
});

import { test, expect } from '@playwright/test';
import { login } from './helpers';

test.describe('Journey 5: Rule Reference read-only view', () => {
  test('displays active rules, supports search, and shows mitigations', async ({
    page,
  }) => {
    // --- Login as underwriter ---
    await login(page, 'underwriter@test.com', 'password123');

    // --- Navigate to Rule Reference ---
    await page.goto('/rule-reference');
    await expect(
      page.getByRole('heading', { name: 'Rule Reference' }),
    ).toBeVisible();

    // --- Verify 4 rules from seed data ---
    // The count text should indicate "4 rules in this release"
    await expect(page.getByText(/4 rules in this release/)).toBeVisible({
      timeout: 10_000,
    });

    // Verify rule cards are present
    const ruleCards = page.locator('.space-y-3 > div');
    await expect(ruleCards).toHaveCount(4, { timeout: 10_000 });

    // --- Search to filter ---
    const searchInput = page.getByPlaceholder(
      /Search rules by name or description/,
    );
    await searchInput.fill('Attic');

    // After filtering, should show fewer results
    await expect(page.getByText(/1 of 4 rule/)).toBeVisible({
      timeout: 5_000,
    });

    // --- Clear search ---
    await searchInput.clear();
    await expect(page.getByText(/4 rules in this release/)).toBeVisible({
      timeout: 5_000,
    });

    // --- Expand a rule card to see mitigations ---
    // Click the first rule card to expand it
    const firstRuleButton = page
      .locator('.space-y-3 > div')
      .first()
      .getByRole('button');
    await firstRuleButton.click();

    // After expanding, look for either mitigations section or unmitigatable message
    const hasMitigations = page.getByText('Available Mitigations');
    const hasUnmitigatable = page.getByText('No mitigations available');
    await expect(
      hasMitigations.or(hasUnmitigatable).first(),
    ).toBeVisible({ timeout: 5_000 });
  });
});

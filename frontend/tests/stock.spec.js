import { test, expect } from '@playwright/test';

test.describe('Stock Management Flow', () => {
  test.beforeEach(async ({ page }) => {
    // Shared login for stock tests
    await page.goto('/login');
    await page.fill('input[placeholder="admin"]', 'admin');
    await page.fill('input[placeholder="••••••••"]', 'admin1234$');
    await page.click('button:has-text("Sign In")');
    // Use a specific h1 locator to avoid strict mode violation (Omniflow exists in header and footer)
    await expect(page.locator('h1:has-text("Omniflow")')).toBeVisible({ timeout: 15000 });
  });

  test('Admin can view stock levels', async ({ page }) => {
    await page.click('text=Admin Hub');
    await page.click('text=Stock Management');
    // The main heading in StockView is an h2, while Administrative Hub is an h1
    await expect(page.locator('h2:has-text("Stock Management")')).toBeVisible();
    await expect(page.locator('button:has-text("Stock Overview")')).toBeVisible();
  });

  test('Admin can perform manual stock adjustment', async ({ page }) => {
    await page.click('text=Admin Hub');
    await page.click('text=Stock Management');
    await page.click('text=Adjust Stock');
    
    // Target the medicine select specifically (it's the first select in the form)
    const medicineSelect = page.locator('form select').first();
    // Select the second option (index 1), assuming index 0 might be placeholder or first seeded
    await medicineSelect.selectOption({ index: 1 }).catch(() => medicineSelect.selectOption({ index: 0 }));
    
    await page.fill('input[type="number"]', '10');
    // Target the adjustment type select (the second one)
    await page.locator('form select').nth(1).selectOption('Manual Adjustment'); 
    await page.fill('textarea', 'E2E Test Adjustment'); 
    await page.click('button:has-text("Save")');

    // Verify success message
    await expect(page.locator('text=success').first()).toBeVisible();
  });
});

import { test, expect } from '@playwright/test';

test.describe('Error Handling E2E Scenario', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/login');
    await page.fill('input[placeholder="admin"]', 'admin');
    await page.fill('input[placeholder="••••••••"]', 'admin1234$');
    await page.click('button:has-text("Sign In")');
    // Use a specific h1 locator to avoid strict mode violation
    await expect(page.locator('h1:has-text("Omniflow")')).toBeVisible({ timeout: 15000 });
  });

  test('UI handles backend 500 gracefully (Rollback scenario)', async ({ page }) => {
    // Intercept POST /suppliers/ only and force a 500 error
    await page.route('**/suppliers/', (route, request) => {
      if (request.method() === 'POST') {
        route.fulfill({
          status: 500,
          contentType: 'application/json',
          body: JSON.stringify({ detail: 'Internal database error during supplier creation - Transaction rolled back' }),
        });
      } else {
        route.continue();
      }
    });

    // Ensure page is ready
    await page.waitForLoadState('networkidle');
    
    // Navigate to Suppliers via Sidebar using the most specific span selector
    await page.locator('aside span:has-text("Suppliers")').first().click(); 
    
    await expect(page.locator('h1:has-text("Supplier Directory")')).toBeVisible();
    await page.click('text=Add Supplier');
    
    // Wait for modal to settle and fill the form
    const nameInput = page.getByPlaceholder('Legal company name');
    await nameInput.waitFor({ state: 'visible' });
    await nameInput.fill('Error Test Supplier');
    
    // Wait for the dialog event while clicking
    const [dialog] = await Promise.all([
      page.waitForEvent('dialog'),
      page.click('button:has-text("Create Supplier")')
    ]);

    expect(dialog.message()).toMatch(/Transaction rolled back|Failed to save supplier/);
    await dialog.dismiss();
  });
});

import { test, expect } from '@playwright/test';

test.describe('Authentication Flow', () => {
  test('Login with valid credentials', async ({ page }) => {
    await page.goto('/login');
    
    await page.fill('input[placeholder="admin"]', 'admin');
    await page.fill('input[placeholder="••••••••"]', 'admin1234$'); 
    await page.click('button:has-text("Sign In")');

    // Use a specific h1 locator to avoid strict mode violation
    await expect(page.locator('h1:has-text("Omniflow")')).toBeVisible({ timeout: 15000 });
  });

  test('Login with incorrect password shows error', async ({ page }) => {
    await page.goto('/login');
    
    await page.fill('input[placeholder="admin"]', 'admin');
    await page.fill('input[placeholder="••••••••"]', 'wrongpassword');
    await page.click('button:has-text("Sign In")');

    // Error message should appear
    await expect(page.locator('text=incorrect')).toBeVisible();
  });

  test('Login with non-existent user shows error', async ({ page }) => {
    await page.goto('/login');
    
    await page.fill('input[placeholder="admin"]', 'nonexistent');
    await page.fill('input[placeholder="••••••••"]', 'anypassword');
    await page.click('button:has-text("Sign In")');

    // Error message should appear
    await expect(page.locator('text=find an account')).toBeVisible();
  });
});

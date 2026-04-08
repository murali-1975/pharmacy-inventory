import { test, expect } from '@playwright/test';

test.describe('Invoices E2E Scenarios', () => {
  test.beforeEach(async ({ page }) => {
    test.setTimeout(90000);
    await page.goto('/');

    // Login
    await page.fill('input[placeholder="admin"]', 'admin');
    await page.fill('input[type="password"]', 'admin1234$');
    await page.click('button:has-text("Sign In")');

    await expect(page.locator('h1:has-text("Omniflow")')).toBeVisible({ timeout: 20000 });
  });

  test('E2E: Create Supplier, Medicine and Purchase Invoice', async ({ page }) => {
    const timestamp = Date.now();
    const uniqueSupplier = `E2E Pharma Supplier ${timestamp}`;
    const uniqueManufacturer = `E2E Manufacturer ${timestamp}`;
    const uniqueMedicine = `E2E Aspirin ${timestamp}`;
    const uniqueInvoice = `INV-${timestamp}`;

    // 1. Create Supplier
    await page.locator('aside').getByText('Suppliers').click();
    await expect(page.locator('h1:has-text("Supplier Directory")')).toBeVisible();
    await page.click('button:has-text("Add Supplier")');

    await page.fill('input[placeholder="Legal company name"]', uniqueSupplier);

    // Select 'Pharmacy' type - wait for options to load
    const typeSelect = page.locator('[data-testid="modal-overlay"] select').first();
    await expect(typeSelect.locator('option')).not.toHaveCount(0); // Wait for options
    await typeSelect.selectOption({ label: 'Pharmacy' });

    await page.getByRole('button', { name: 'Create Supplier' }).click({ force: true });
    await expect(page.locator('[data-testid="modal-overlay"]')).not.toBeVisible();
    await expect(page.locator('td', { hasText: uniqueSupplier }).first()).toBeVisible();

    // 2. Create Manufacturer and Medicine
    await page.locator('aside').getByText('Admin Hub').click();
    await page.waitForTimeout(2000); // Wait for page to be ready
    
    // Add Manufacturer
    await page.locator('button:has-text("Manufacturers")').click({ force: true });
    await page.waitForTimeout(1000); // Wait for tab transition
    await page.click('button:has-text("Add Manufacturer")');
    await page.fill('input[placeholder="e.g. Cipla Ltd."]', uniqueManufacturer);
    await page.getByRole('button', { name: 'Add Manufacturer' }).last().click({ force: true });
    // Stable verification with timeout
    await expect(page.locator('td', { hasText: uniqueManufacturer }).first()).toBeVisible({ timeout: 10000 });

    // Add Medicine
    await page.click('text=Medicine Master');
    await page.click('button:has-text("Add to Master")');
    await page.fill('input[placeholder="Medicine Name"]', uniqueMedicine);
    await page.fill('input[placeholder="Generic Name (e.g. Paracetamol)"]', 'Aspirin');
    await page.fill('input[name="hsn_code"]', '1234');
    await page.fill('input[name="selling_price_percent"]', '10');
    
    // Select dropdowns by label
    const modal = page.locator('[data-testid="modal-overlay"]');
    await modal.locator('label:has-text("Category") + select').selectOption({ label: 'GENERAL' });
    await modal.locator('label:has-text("Storage") + select').selectOption({ label: 'Ambient' });
    await modal.locator('label:has-text("UOM") + select').selectOption({ label: 'Strip' });
    
    const mfgSelect = modal.locator('label:has-text("Manufacturer") + select');
    await expect(mfgSelect.locator('option')).not.toHaveCount(0); // Wait for manufacturers
    await mfgSelect.selectOption({ label: uniqueManufacturer });
    await page.getByRole('button', { name: 'Add to Master' }).last().click({ force: true });
    await expect(page.locator('[data-testid="modal-overlay"]')).not.toBeVisible();
    await expect(page.locator('td', { hasText: uniqueMedicine }).first()).toBeVisible();

    // 3. Create Purchase Invoice
    await page.locator('aside').getByText('Invoices').click();
    await expect(page.locator('h1:has-text("Purchase Invoices")')).toBeVisible();
    await page.click('text=New Invoice');

    // Select the Supplier - wait for it to be in the list
    const supplierSelect = page.locator('label:text-is("Supplier") + div select');
    await expect(supplierSelect).toBeVisible();
    await expect(supplierSelect.locator(`option:has-text("${uniqueSupplier}")`)).toBeAttached({ timeout: 10000 });
    await supplierSelect.selectOption({ label: `${uniqueSupplier} (Pharmacy)` });

    await page.locator('label:text-is("Invoice Number") + div input').fill(uniqueInvoice);
    await page.locator('label:text-is("GST Amount (₹)") + div input').fill('0');
    await page.locator('label:text-is("Total Invoice Value (₹)") + div input').fill('750'); // 50 * 15 = 750

    await page.click('text=Add Item');

    const medAutocomplete = page.locator('input[placeholder="Type to search medicines..."]');
    if (await medAutocomplete.count() > 0) {
      await medAutocomplete.click();
      await medAutocomplete.fill(uniqueMedicine);
      await expect(page.locator('ul > li').first()).toBeVisible({ timeout: 10000 });
      await page.locator('ul > li').first().click();

      // Batch No and Expiry
      await page.locator('label:text-is("Batch No") + input').fill('BATCH-XYZ');
      const expiryInput = page.locator('label:text-is("Expiry Date") + div input');
      await expiryInput.click();
      await expiryInput.fill('2026-12-31');

      // Qty, Price and MRP
      await page.locator('label:text-is("Qty") + input').fill('50');
      await page.locator('label:text-is("Price (₹)") + input').fill('15');
      await page.locator('label:text-is("MRP (₹)") + input').fill('20');
      await page.locator('label:text-is("GST %") + input').fill('0');
    } else {
      await page.locator('label:text-is("Item Description") + input').fill(uniqueMedicine);
      await page.locator('label:text-is("Qty") + input').fill('50');
      await page.locator('label:text-is("Price (₹)") + input').fill('15');
      await page.locator('label:text-is("MRP (₹)") + input').fill('20');
    }

    await page.getByRole('button', { name: 'Confirm & Save Invoice' }).click({ force: true });
    await expect(page.locator(`text=${uniqueInvoice}`).first()).toBeVisible({ timeout: 15000 });
  });

  test('UI: Discount should not affect Line Total', async ({ page }) => {
    await page.locator('aside').getByText('Invoices').click();
    await page.click('text=New Invoice');
    
    // Select any supplier to enable 'Add Item'
    const supplierSelect = page.locator('[data-testid="modal-overlay"] select').first();
    await expect(supplierSelect.locator('option')).not.toHaveCount(1); // Wait for suppliers to load
    await supplierSelect.selectOption({ index: 1 });

    // Add Item
    await page.click('text=Add Item');

    // Fill Qty and Price
    await page.locator('label:text-is("Qty") + input').fill('10');
    await page.locator('label:text-is("Price (₹)") + input').fill('100');

    // Verify Initial Total (10 * 100 = 1000)
    await expect(page.locator('text=₹1000.00')).toBeVisible();

    // Fill Discount
    const discInput = page.locator('label:text-is("Disc (₹)") + input');
    await discInput.fill('50');

    // Verify Total remains 1000.00 (discount should not deduct)
    await expect(page.locator('text=₹1000.00')).toBeVisible();

    // Verify no spinners (type should be text)
    const type = await discInput.getAttribute('type');
    expect(type).toBe('text');
  });
});

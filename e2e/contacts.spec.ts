import { test, expect } from '@playwright/test'

/**
 * E2E tests for the Contacts page.
 *
 * These tests require authentication. In a real CI setup, you would
 * configure a test user session via storageState or by mocking NextAuth.
 * For now, they verify basic page structure and navigation.
 */

test.describe('Contacts Page', () => {
  // Skip tests if no auth session is configured in CI
  // To run locally with auth, set up a storageState file
  test.skip(({ browserName }) => !process.env.E2E_AUTH_CONFIGURED, 'Skipping: E2E auth not configured')

  test('navigates to contacts page', async ({ page }) => {
    await page.goto('/contacts')
    await expect(page).toHaveURL(/\/contacts/)
    // Should show the contacts page heading or table
    await expect(
      page.getByRole('heading', { name: /contacts/i })
        .or(page.locator('table'))
        .or(page.locator('[data-testid="contacts-page"]'))
    ).toBeVisible({ timeout: 15000 })
  })

  test('displays search input', async ({ page }) => {
    await page.goto('/contacts')
    const searchInput = page.getByPlaceholder(/search/i)
      .or(page.locator('input[type="search"]'))
    await expect(searchInput.first()).toBeVisible({ timeout: 15000 })
  })

  test('clicking a contact opens detail view', async ({ page }) => {
    await page.goto('/contacts')
    // Wait for table to load
    await page.waitForSelector('table tbody tr', { timeout: 15000 })
    // Click the first contact row
    const firstRow = page.locator('table tbody tr').first()
    await firstRow.click()
    // Should open a detail sheet/panel
    await expect(
      page.locator('[role="dialog"]')
        .or(page.locator('[data-testid="contact-detail"]'))
        .or(page.locator('.sheet-content'))
    ).toBeVisible({ timeout: 5000 })
  })

  test('search filters contacts', async ({ page }) => {
    await page.goto('/contacts')
    const searchInput = page.getByPlaceholder(/search/i)
      .or(page.locator('input[type="search"]'))
    await searchInput.first().fill('test-nonexistent-query-xyz')
    // Wait a moment for filtering
    await page.waitForTimeout(500)
    // The table should be empty or show a no-results message
    const rows = page.locator('table tbody tr')
    const count = await rows.count()
    // Either 0 rows or a "no results" message
    expect(count).toBeLessThanOrEqual(1)
  })
})

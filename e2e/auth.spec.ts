import { test, expect } from '@playwright/test'

test.describe('Authentication', () => {
  test('redirects unauthenticated users to sign-in page', async ({ page }) => {
    await page.goto('/dashboard')
    // NextAuth should redirect unauthenticated requests to the sign-in page
    // or the app's custom login page
    await expect(page).toHaveURL(/\/(api\/auth\/signin|login|sign-in|auth)/)
  })

  test('sign-in page renders a Google login button', async ({ page }) => {
    await page.goto('/api/auth/signin')
    // NextAuth's default sign-in page shows provider buttons
    const googleButton = page.getByRole('button', { name: /google/i })
      .or(page.locator('text=Sign in with Google'))
      .or(page.locator('[data-provider="google"]'))
    await expect(googleButton.first()).toBeVisible({ timeout: 10000 })
  })

  test('unauthenticated access to pipeline redirects', async ({ page }) => {
    await page.goto('/pipeline')
    await expect(page).toHaveURL(/\/(api\/auth\/signin|login|sign-in|auth|dashboard)/)
  })

  test('unauthenticated access to contacts redirects', async ({ page }) => {
    await page.goto('/contacts')
    await expect(page).toHaveURL(/\/(api\/auth\/signin|login|sign-in|auth|dashboard)/)
  })
})

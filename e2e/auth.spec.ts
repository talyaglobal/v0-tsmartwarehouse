import { test, expect } from '@playwright/test'

test.describe('Authentication', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/')
  })

  test('should navigate to login page', async ({ page }) => {
    await page.click('text=Login')
    await expect(page).toHaveURL(/.*login/)
    await expect(page.locator('h1, h2')).toContainText(/login/i)
  })

  test('should show validation errors for empty form', async ({ page }) => {
    await page.goto('/login')
    await page.click('button[type="submit"]')
    
    // Wait for validation errors
    await expect(page.locator('text=/email/i')).toBeVisible()
  })

  test('should navigate to register page', async ({ page }) => {
    await page.click('text=Register')
    await expect(page).toHaveURL(/.*register/)
    await expect(page.locator('h1, h2')).toContainText(/register|sign up/i)
  })

  test('should show forgot password link', async ({ page }) => {
    await page.goto('/login')
    const forgotPasswordLink = page.locator('text=/forgot password/i')
    await expect(forgotPasswordLink).toBeVisible()
  })
})


import { test, expect } from '@playwright/test'

test.describe('Bookings', () => {
  test.beforeEach(async ({ page }) => {
    // Mock authentication - in real tests, you'd log in
    // For now, we'll test the UI structure
    await page.goto('/dashboard/bookings')
  })

  test('should display bookings page', async ({ page }) => {
    await expect(page.locator('h1, h2')).toContainText(/booking/i)
  })

  test('should have create booking button', async ({ page }) => {
    const createButton = page.locator('text=/new booking|create booking/i')
    await expect(createButton).toBeVisible()
  })

  test('should navigate to new booking page', async ({ page }) => {
    await page.click('text=/new booking|create booking/i')
    await expect(page).toHaveURL(/.*new|create/)
  })
})


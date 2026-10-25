import { test, expect } from '@playwright/test'
import { readFileSync } from 'node:fs'
import path from 'node:path'

const credentials = JSON.parse(readFileSync(path.resolve('.local/e2e-credentials.json'), 'utf8'))

test('web settings and Django admin share a session and keep private model permissions', async ({ page }) => {
  await page.goto('/login')
  await page.getByLabel('Email address', { exact: false }).fill(credentials.owner)
  await page.getByLabel('Password', { exact: false }).first().fill(credentials.password)
  await page.getByRole('button', { name: 'Sign in', exact: true }).click()
  await page.getByRole('link', { name: 'Settings', exact: true }).click()
  const connection = page.getByRole('region', { name: 'Connected system' })
  await expect(connection.getByRole('status')).toContainText('Shared database is connected.')
  const status = await (await page.request.get('/api/cesd/integration/')).json()
  expect(status.database.connected).toBe(true)
  expect(status.registered_models).toContain('predictions.userproject')
  const popupEvent = page.waitForEvent('popup')
  await connection.getByRole('link', { name: 'Open Django administration' }).click()
  const django = await popupEvent
  await expect(django).toHaveURL(/\/admin\/$/)
  await expect(django.getByRole('banner').getByRole('link', { name: 'SNAPTURE Administration' })).toBeVisible()
  await expect(django.locator('a[href="/admin/cesd/policy/"]').first()).toBeVisible()
  expect((await django.request.get('/static/admin/css/base.css')).status()).toBe(200)
  expect((await django.request.get('/admin/predictions/userproject/')).status()).toBe(403)
  expect((await django.request.get('/admin/core/guidance/')).status()).toBe(403)
  await django.screenshot({ path: '.local/screenshots/shared-django-admin.png', fullPage: true })
  await django.close()

  // A failed check must not continue displaying an old green connection state.
  await page.route('**/api/cesd/integration/', route => route.fulfill({ status: 503, contentType: 'application/json', body: JSON.stringify({ detail: 'Connection test unavailable.' }) }))
  await connection.getByRole('button', { name: 'Refresh connection' }).click()
  await expect(connection.getByRole('alert')).toContainText('Connection test unavailable.')
  await expect(connection.getByText('Shared database is connected.', { exact: false })).toHaveCount(0)
  await page.unroute('**/api/cesd/integration/')
  await connection.getByRole('button', { name: 'Refresh connection' }).click()
  await expect(connection.getByRole('status')).toContainText('Shared database is connected.')
  await page.setViewportSize({ width: 390, height: 844 })
  await expect.poll(() => page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBeTruthy()
  await page.screenshot({ path: '.local/screenshots/shared-settings-mobile.png', fullPage: true })
})

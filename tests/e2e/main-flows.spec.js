import { expect, test } from '@playwright/test';

async function registerMockUser(page) {
  await page.goto('/');
  await page.evaluate(() => localStorage.clear());
  await page.reload();

  await page.locator('#at-register').click();
  await page.locator('#r-name').fill('Test User');
  await page.locator('#r-email').fill('test.user@example.com');
  await page.locator('#r-pass').fill('secure-password');
  await page.locator('#r-btn').click();

  await expect(page.locator('#app')).toBeVisible();
}

test('a user can register through the auth screen', async ({ page }) => {
  await registerMockUser(page);

  await expect(page.locator('#u-name')).toHaveText('Test User');
  await expect(page.locator('#auth-screen')).not.toHaveClass(/show/);
});

test('a user can add a habit from the schedule', async ({ page }) => {
  await registerMockUser(page);
  await page.locator('#tab-sched').click();

  await page.locator('#nlp-input').fill('Read book 9-10 PM');
  await page.locator('#nlp-add-btn').click();
  await expect(page.locator('#slots-list')).toContainText('Read book');

  await page.locator('#tab-habit').click();
  await expect(page.locator('#tbody')).toContainText('Read book');
});

test('a user can start and reset a focus timer', async ({ page }) => {
  await registerMockUser(page);
  await page.locator('#tab-power').click();

  await expect(page.locator('#p-timer')).toHaveText('25:00');
  await page.locator('#p-start').click();
  await expect(page.locator('#p-start')).toHaveText('Pause');

  await page.locator('#p-reset').click();
  await expect(page.locator('#p-start')).toHaveText('Start Session');
  await expect(page.locator('#p-timer')).toHaveText('25:00');
});

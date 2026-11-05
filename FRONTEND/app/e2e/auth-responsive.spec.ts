import { expect, test } from '@playwright/test';

const screens = [
  {
    name: 'desktop-register',
    path: '/auth/otp?mode=register',
    heading: 'Müşteri kaydı',
    viewport: { width: 1536, height: 864 },
    showsBrandPanel: true,
  },
  {
    name: 'tablet-staff',
    path: '/auth/staff',
    heading: 'Personel girişi',
    viewport: { width: 900, height: 1024 },
    showsBrandPanel: false,
  },
  {
    name: 'mobile-login',
    path: '/auth/otp?mode=login',
    heading: 'Müşteri girişi',
    viewport: { width: 390, height: 844 },
    showsBrandPanel: false,
  },
  {
    name: 'small-mobile-customer',
    path: '/auth',
    heading: 'Müşteri girişi',
    viewport: { width: 320, height: 568 },
    showsBrandPanel: false,
  },
] as const;

test('auth flows fit desktop, tablet and mobile viewports', async ({ page }, testInfo) => {
  for (const screen of screens) {
    await page.setViewportSize(screen.viewport);
    await page.goto(screen.path);

    await expect(page.getByRole('heading', { name: screen.heading })).toBeVisible();

    const brandPanel = page.locator('aside');
    if (screen.showsBrandPanel) {
      await expect(brandPanel).toBeVisible();
    } else {
      await expect(brandPanel).toBeHidden();
    }

    const pageWidth = await page.evaluate(() => ({
      client: document.documentElement.clientWidth,
      scroll: document.documentElement.scrollWidth,
    }));
    expect(pageWidth.scroll).toBeLessThanOrEqual(pageWidth.client);

    await page.screenshot({
      path: testInfo.outputPath(`${screen.name}.png`),
      fullPage: true,
    });
  }
});

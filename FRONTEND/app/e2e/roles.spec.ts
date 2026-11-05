import { expect, test, type Browser, type Page } from '@playwright/test';

/**
 * The four roles' main flows, end to end in the browser against the real system
 * (`docker compose up`, app served by the gateway). One case travels through all of them:
 *
 *   admin creates an analyst → customer signs in with OTP and sends a risky transfer →
 *   supervisor checks the dashboard and queue, assigns the case to that analyst →
 *   analyst starts the review and asks the customer → customer answers "ben yapmadım" →
 *   analyst blocks with a note and gets the first-catch badge toast →
 *   the case closes → customer rates it → the analyst shows up on the leaderboard.
 *
 * The case closes 48 hours after the decision; CI sets CASE_CLOSURE_DELAY to a few seconds.
 */

const ADMIN = { email: 'admin@fraudcell.local', password: 'ChangeMe123!' };
const SUPERVISOR = { email: 'supervisor@fraudcell.local', password: 'Demo1234!' };

/** Letters only, so the name passes validation and is unique per run. */
function runTag(): string {
  return String(Date.now())
    .slice(-6)
    .replace(/\d/g, (digit) => 'abcdefghij'[Number(digit)]!);
}

function captureBrowserErrors(page: Page, errors: string[]): void {
  page.on('pageerror', (error) => errors.push(`${page.url()}: ${error.message}`));
  page.on('response', (response) => {
    if (response.status() >= 500) errors.push(`${response.status()} ${response.url()}`);
  });
}

async function openPage(browser: Browser, errors: string[]): Promise<Page> {
  const context = await browser.newContext();
  const page = await context.newPage();
  captureBrowserErrors(page, errors);
  return page;
}

async function clickNav(page: Page, name: string): Promise<void> {
  const menuButton = page.getByRole('button', { name: 'Menüyü aç' });
  if (await menuButton.isVisible()) await menuButton.click();
  await page.getByRole('link', { name, exact: true }).click();
}

async function signInStaff(page: Page, email: string, password: string, home: RegExp): Promise<void> {
  await page.goto('/auth/staff');
  await page.getByLabel('E-posta').fill(email);
  await page.getByLabel('Şifre', { exact: true }).fill(password);
  await page.getByRole('button', { name: 'Giriş yap' }).click();
  await expect(page).toHaveURL(home);
}

test('four roles take one case from transaction to rating', async ({ browser }, testInfo) => {
  test.setTimeout(240_000);
  const errors: string[] = [];
  const tag = runTag();
  const analyst = {
    firstName: 'Eteste',
    lastName: `Analist${tag}`,
    email: `e2e.analyst.${tag}@fraudcell.local`,
    password: 'Analyst123!',
  };
  const analystName = `${analyst.firstName} ${analyst.lastName}`;
  const shot = (page: Page, name: string) =>
    page.screenshot({ path: testInfo.outputPath(`${name}.png`), fullPage: true });

  const admin = await openPage(browser, errors);
  const customer = await openPage(browser, errors);
  const supervisor = await openPage(browser, errors);
  const analystPage = await openPage(browser, errors);
  let transactionId = '';
  let transactionNo = '';

  await test.step('admin creates an analyst', async () => {
    await signInStaff(admin, ADMIN.email, ADMIN.password, /\/admin\/?$/);
    await admin.getByRole('button', { name: 'Personel ekle' }).click();
    const form = admin.getByRole('dialog');
    await form.getByLabel('Ad', { exact: true }).fill(analyst.firstName);
    await form.getByLabel('Soyad').fill(analyst.lastName);
    await form.getByLabel('E-posta').fill(analyst.email);
    await form.getByLabel('Geçici şifre').fill(analyst.password);
    await form.getByLabel('Rol').selectOption('ANALYST');
    // Only money laundering: the stolen-card case below goes to its own specialist, so it is the
    // supervisor's manual assignment that brings it to this analyst. Assignment stays open, since
    // nobody can be assigned a case while closed to assignment.
    await form.getByRole('group', { name: 'Uzmanlıklar' }).getByRole('checkbox', { name: 'Para Aklama' }).check();
    for (const box of await form.getByRole('group', { name: 'Bölgeler' }).getByRole('checkbox').all()) {
      await box.check();
    }
    await expect(form.getByRole('checkbox', { name: 'Atamaya açık' })).toBeChecked();
    await form.getByRole('button', { name: 'Kaydet' }).click();
    await expect(admin.getByText(analyst.email)).toBeVisible();
    await shot(admin, 'admin-staff-created');
  });

  await test.step('customer signs in with OTP and sends a risky transfer', async () => {
    await customer.goto('/auth');
    await customer.getByRole('link', { name: 'Yeni müşteri kaydı' }).click();
    await customer.getByLabel('Cep telefonu').fill(`5${String(Date.now()).slice(-9)}`);
    await customer.getByLabel('Ad', { exact: true }).fill('Eteste');
    await customer.getByLabel('Soyad').fill('Musteri');
    await customer.getByRole('button', { name: 'Kod gönder' }).click();
    await expect(customer.getByText(/OTP: 1234/)).toBeVisible();
    for (const [index, digit] of ['1', '2', '3', '4'].entries()) {
      await customer.getByLabel(`${index + 1}. hane`).fill(digit);
    }
    await customer.getByRole('button', { name: 'Doğrula' }).click();
    await expect(customer).toHaveURL(/\/customer\/?$/);

    await customer.getByRole('link', { name: /^Yeni işlem/ }).first().click();
    await customer.getByLabel('Tutar (TRY)').fill('50000');
    await customer.getByLabel('Alıcı referansı').fill(`E2E-${tag}`);
    await customer.getByLabel('Şehir').fill('New York');
    await customer.getByLabel('Ülke').fill('US');
    await customer.getByRole('button', { name: 'İşlemi gönder' }).click();

    await expect(customer).toHaveURL(/\/customer\/transactions\/[0-9A-Z]+$/);
    transactionId = customer.url().split('/').at(-1)!;
    await expect(customer.getByRole('heading', { name: 'Yapay zekâ değerlendirmesi' })).toBeVisible({
      timeout: 20_000,
    });
    transactionNo = (await customer.getByRole('heading', { level: 1 }).textContent())!.trim();
    await shot(customer, 'customer-ai-assessment');
  });

  await test.step('supervisor sees the dashboard and queue, then assigns the case', async () => {
    await signInStaff(supervisor, SUPERVISOR.email, SUPERVISOR.password, /\/supervisor\/?$/);
    await expect(supervisor.getByRole('heading', { name: 'Operasyon paneli' })).toBeVisible();
    await expect(supervisor.getByText('Model doğruluğu', { exact: true })).toBeVisible();
    await expect(supervisor.getByText('SLA uyumu', { exact: true })).toBeVisible();
    await shot(supervisor, 'supervisor-dashboard');

    await clickNav(supervisor, 'Atama Kuyruğu');
    await expect(supervisor.getByRole('heading', { name: 'Atama kuyruğu' })).toBeVisible();
    // Case §7: BELIRSIZ and capacity-waiting cases are shown together by default.
    await expect(supervisor.getByRole('tab', { name: /Tümü/ })).toHaveAttribute('aria-selected', 'true');
    await shot(supervisor, 'supervisor-queue');

    await clickNav(supervisor, 'Tüm Vakalar');
    await expect(supervisor.getByRole('heading', { name: 'Tüm vakalar' })).toBeVisible();
    await expect(async () => {
      await supervisor.reload();
      await supervisor.getByRole('link', { name: new RegExp(transactionNo) }).click({ timeout: 2_000 });
    }).toPass({ timeout: 30_000 });
    await expect(supervisor.getByRole('heading', { name: transactionNo })).toBeVisible();

    await supervisor.getByRole('button', { name: /^(Yeniden ata|Analist ata)$/ }).click();
    const panel = supervisor.getByRole('dialog');
    await panel.getByLabel('Analist').selectOption({ label: `${analystName} · ${analyst.email}` });
    await panel.getByLabel('Gerekçe').fill('Uçtan uca test: manuel atama.');
    await panel.getByRole('button', { name: 'Kaydet' }).click();
    await expect(panel).toBeHidden();
  });

  await test.step('analyst starts the review and asks the customer', async () => {
    await signInStaff(analystPage, analyst.email, analyst.password, /\/analyst\/?$/);
    const caseLink = analystPage.getByRole('link', { name: new RegExp(transactionNo) });
    await expect(caseLink).toBeVisible({ timeout: 20_000 });
    // Case §4.4: every open case carries its SLA chip.
    await expect(caseLink.locator('[data-sla]')).toBeVisible();
    await caseLink.click();

    await analystPage.getByRole('button', { name: 'İncelemeyi başlat' }).click();
    await analystPage.getByRole('button', { name: 'Müşteriden doğrulama iste' }).click();
    await expect(analystPage.getByText('Müşteriden doğrulama bekleniyor.')).toBeVisible();
  });

  await test.step('customer answers "ben yapmadım"', async () => {
    await customer.getByRole('link', { name: 'Doğrulama' }).first().click();
    await expect(customer.getByRole('heading', { name: 'Doğrulamalar' })).toBeVisible();
    await customer.getByRole('button', { name: 'Ben yapmadım' }).click({ timeout: 20_000 });
    await customer.getByRole('button', { name: 'Yanıtı gönder' }).click();
    await expect(customer.getByText('Bekleyen doğrulama yok', { exact: true })).toBeVisible();
  });

  await test.step('analyst blocks with a note and earns the first-catch badge', async () => {
    await expect(analystPage.getByTestId('customer-answer')).toContainText('Ben yapmadım', {
      timeout: 20_000,
    });
    await analystPage.getByLabel('Karar notu').fill('Müşteri işlemi reddetti, kart çalıntı.');
    await analystPage.getByRole('button', { name: 'Blokla' }).click();
    await expect(analystPage.getByText('Bloklandı', { exact: true }).first()).toBeVisible();
    // Case §6.4: the badge arrives over SSE and shows as a toast.
    await expect(analystPage.getByText('Yeni rozet kazandınız').first()).toBeVisible({ timeout: 30_000 });
    await shot(analystPage, 'analyst-badge-toast');

    await clickNav(analystPage, 'Profilim');
    await expect(analystPage.getByRole('heading', { name: 'Profilim' })).toBeVisible();
    await expect(analystPage.getByText('İlk Yakalama').first()).toBeVisible({ timeout: 20_000 });
    await expect(analystPage.getByText('Çözülen vaka', { exact: true })).toBeVisible();
    await shot(analystPage, 'analyst-profile');
  });

  await test.step('customer rates the closed case', async () => {
    await expect(async () => {
      await customer.goto(`/customer/transactions/${transactionId}`);
      await expect(customer.getByRole('heading', { name: 'Süreci değerlendirin' })).toBeVisible({
        timeout: 2_000,
      });
    }).toPass({ timeout: 60_000 });
    await customer.getByRole('radio', { name: '5 yıldız' }).click();
    await customer.getByRole('button', { name: 'Değerlendirmeyi gönder' }).click();
    await expect(customer.getByRole('heading', { name: 'Değerlendirmeniz' })).toBeVisible();
    await expect(customer.getByRole('img', { name: '5 / 5 yıldız' })).toBeVisible();
    await shot(customer, 'customer-feedback');
  });

  await test.step('supervisor sees the analyst on the leaderboard', async () => {
    await clickNav(supervisor, 'Liderlik');
    await expect(supervisor.getByRole('heading', { name: 'Liderlik tablosu' })).toBeVisible();
    await expect(async () => {
      await supervisor.reload();
      await expect(supervisor.getByText(analystName).first()).toBeVisible({ timeout: 2_000 });
    }).toPass({ timeout: 30_000 });
    await shot(supervisor, 'supervisor-leaderboard');
  });

  await test.step('the analyst signs out', async () => {
    const menuButton = analystPage.getByRole('button', { name: 'Kullanıcı menüsü' });
    await menuButton.click();
    await analystPage.getByRole('menuitem', { name: 'Çıkış yap' }).click();
    await expect(analystPage).toHaveURL(/\/auth\/?$/);
    await expect(analystPage.getByRole('heading', { name: 'Müşteri girişi' })).toBeVisible();
  });

  expect(errors).toEqual([]);
});

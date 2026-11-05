import { expect, test, type APIRequestContext, type Page } from '@playwright/test';

const gateway = 'http://127.0.0.1:8080/api/v1';

function captureBrowserErrors(page: Page): string[] {
  const errors: string[] = [];
  page.on('console', (message) => {
    if (message.type() === 'error' && !message.text().startsWith('Failed to load resource')) {
      errors.push(message.text());
    }
  });
  page.on('pageerror', (error) => errors.push(error.message));
  page.on('response', (response) => {
    if (response.status() === 404 || response.status() >= 500) {
      errors.push(`${response.status()} ${response.url()}`);
    }
  });
  return errors;
}

async function clickConsoleLink(page: Page, name: string): Promise<void> {
  const menuButton = page.getByRole('button', { name: 'Menüyü aç' });
  if (await menuButton.isVisible()) await menuButton.click();
  await page.getByRole('link', { name, exact: true }).click();
}

async function signOut(page: Page): Promise<void> {
  const sidebarButton = page.getByRole('button', { name: 'Çıkış yap' });
  if (await sidebarButton.isVisible()) {
    await sidebarButton.click();
    return;
  }
  await page.getByRole('button', { name: 'Kullanıcı menüsü' }).click();
  await page.getByRole('menuitem', { name: 'Çıkış yap' }).click();
}

async function login(request: APIRequestContext, email: string, password: string): Promise<string> {
  const response = await request.post(`${gateway}/auth/staff/login`, {
    data: { email, password },
  });
  expect(response.ok()).toBeTruthy();
  return (await response.json()).data.accessToken as string;
}

async function createStaff(
  request: APIRequestContext,
  adminToken: string,
  email: string,
  password: string,
  role: 'ANALYST' | 'SUPERVISOR',
): Promise<string> {
  const response = await request.post(`${gateway}/staff`, {
    headers: { Authorization: `Bearer ${adminToken}` },
    data: {
      firstName: 'E2E',
      lastName: role === 'ANALYST' ? 'Analist' : 'Süpervizör',
      email,
      password,
      role,
      specialties: ['CALINTI_KART', 'HESAP_ELE_GECIRME', 'PARA_AKLAMA', 'SUPHELI_DAVRANIS'],
      regions: ['MARMARA', 'YURT_DISI'],
      assignmentEnabled: true,
    },
  });
  expect(response.ok()).toBeTruthy();
  return (await response.json()).data.id as string;
}

async function createHighRiskCase(request: APIRequestContext): Promise<{
  caseId: string;
  transactionNo: string;
}> {
  const suffix = String(Date.now()).slice(-9);
  const challenge = await request.post(`${gateway}/auth/customer/otp/challenges`, {
    data: { gsmNumber: `5${suffix}`, purpose: 'CustomerRegister' },
  });
  expect(challenge.ok()).toBeTruthy();
  const challengeId = (await challenge.json()).data.challengeId as string;

  const verification = await request.post(`${gateway}/auth/customer/otp/verifications`, {
    data: {
      challengeId,
      code: '1234',
      customer: { firstName: 'E2E', lastName: 'Vaka', email: null },
    },
  });
  expect(verification.ok()).toBeTruthy();
  const customerToken = (await verification.json()).data.accessToken as string;

  const created = await request.post(`${gateway}/transactions`, {
    headers: {
      Authorization: `Bearer ${customerToken}`,
      'Idempotency-Key': `e2e-${crypto.randomUUID()}`,
    },
    data: {
      amount: 50000,
      currency: 'TRY',
      transactionType: 'TRANSFER',
      recipient: { reference: `E2E-CASE-${suffix}` },
      device: { fingerprint: `e2e-case-device-${suffix}` },
      location: { city: 'New York', countryCode: 'US' },
      occurredAt: new Date().toISOString(),
    },
  });
  expect(created.ok()).toBeTruthy();
  const transaction = (await created.json()).data as { transactionId: string; transactionNo: string };

  const deadline = Date.now() + 20_000;
  while (Date.now() < deadline) {
    const detail = await request.get(`${gateway}/transactions/${transaction.transactionId}`, {
      headers: { Authorization: `Bearer ${customerToken}` },
    });
    expect(detail.ok()).toBeTruthy();
    const data = (await detail.json()).data as { caseId: string | null; assessment: { status: string } };
    if (data.caseId) return { caseId: data.caseId, transactionNo: transaction.transactionNo };
    if (data.assessment.status === 'FAILED' || data.assessment.status === 'TIMED_OUT') {
      throw new Error(`Assessment ended as ${data.assessment.status}.`);
    }
    await new Promise((resolve) => setTimeout(resolve, 250));
  }
  throw new Error('Risk case was not created within 20 seconds.');
}

async function assignCase(
  request: APIRequestContext,
  supervisorToken: string,
  caseId: string,
  analystId: string,
): Promise<void> {
  const deadline = Date.now() + 15_000;
  while (Date.now() < deadline) {
    const current = await request.get(`${gateway}/cases/${caseId}`, {
      headers: { Authorization: `Bearer ${supervisorToken}` },
    });
    expect(current.ok()).toBeTruthy();
    const body = (await current.json()).data as { assignedAnalystId: string | null };
    if (body.assignedAnalystId === analystId) return;

    const etag = current.headers().etag;
    const reassigned = await request.post(`${gateway}/cases/${caseId}/reassignments`, {
      headers: { Authorization: `Bearer ${supervisorToken}`, 'If-Match': etag },
      data: { newAnalystId: analystId, reason: 'E2E analyst flow' },
    });
    if (reassigned.ok()) return;
    await new Promise((resolve) => setTimeout(resolve, 500));
  }
  throw new Error('Case could not be assigned to the E2E analyst.');
}

test('operations flow reaches analyst points and supervisor leaderboard', async ({ page, request }, testInfo) => {
  test.setTimeout(60_000);

  const browserErrors = captureBrowserErrors(page);
  const suffix = Date.now();
  const password = 'ChangeMe123!';
  const analystEmail = `e2e.analyst.${suffix}@fraudcell.local`;
  const supervisorEmail = `e2e.supervisor.${suffix}@fraudcell.local`;

  const adminToken = await login(request, 'admin@fraudcell.local', password);
  const analystId = await createStaff(request, adminToken, analystEmail, password, 'ANALYST');
  await createStaff(request, adminToken, supervisorEmail, password, 'SUPERVISOR');
  const supervisorToken = await login(request, supervisorEmail, password);
  const riskCase = await createHighRiskCase(request);
  await assignCase(request, supervisorToken, riskCase.caseId, analystId);

  await page.goto('/auth/staff');
  await page.getByLabel('E-posta').fill(analystEmail);
  await page.getByLabel('Şifre', { exact: true }).fill(password);
  await page.getByRole('button', { name: 'Giriş yap' }).click();

  await expect(page).toHaveURL(/\/analyst\/?$/);
  const caseLink = page.getByRole('link', { name: new RegExp(riskCase.transactionNo) });
  await expect(caseLink).toBeVisible();
  await caseLink.click();
  await expect(page).toHaveURL(new RegExp(`/analyst/cases/${riskCase.caseId}$`));

  await page.getByRole('button', { name: 'İncelemeyi başlat' }).click();
  await expect(page.getByLabel('Karar notu')).toBeVisible();
  await page.getByLabel('Karar notu').fill('E2E testinde doğrulanan yüksek riskli işlem.');
  await page.getByRole('button', { name: 'Blokla' }).click();
  await expect(page.getByText('Bloklandı', { exact: true })).toBeVisible();
  await page.screenshot({ path: testInfo.outputPath('analyst-case-decided.png'), fullPage: true });

  await clickConsoleLink(page, 'Profilim');
  await expect(page.getByRole('heading', { name: 'Profilim' })).toBeVisible();
  await expect(page.getByTestId('points-ledger').getByText(/^\+\d+$/).first()).toBeVisible({
    timeout: 20_000,
  });
  await page.screenshot({ path: testInfo.outputPath('analyst-points.png'), fullPage: true });

  await signOut(page);
  await expect(page).toHaveURL(/\/auth\/?$/);
  await page.goto('/auth/staff');
  await page.getByLabel('E-posta').fill(supervisorEmail);
  await page.getByLabel('Şifre', { exact: true }).fill(password);
  await page.getByRole('button', { name: 'Giriş yap' }).click();
  await expect(page).toHaveURL(/\/supervisor\/?$/);

  await expect(page.getByRole('heading', { name: 'Operasyon panosu' })).toBeVisible();
  await page.screenshot({ path: testInfo.outputPath('supervisor-dashboard.png'), fullPage: true });
  await clickConsoleLink(page, 'Tüm Vakalar');
  await expect(page.getByRole('heading', { name: 'Tüm vakalar' })).toBeVisible();
  await page.getByRole('button', { name: new RegExp(riskCase.transactionNo) }).click();
  await expect(page.getByRole('heading', { name: riskCase.transactionNo })).toBeVisible();
  await expect(page.getByText('Süpervizör işlemleri', { exact: true })).toBeVisible();
  await page.screenshot({ path: testInfo.outputPath('supervisor-case-detail.png'), fullPage: true });
  await clickConsoleLink(page, 'Atama Kuyruğu');
  await expect(page.getByRole('heading', { name: 'Atama kuyruğu' })).toBeVisible();
  await page.screenshot({ path: testInfo.outputPath('supervisor-assignment-queue.png'), fullPage: true });
  await clickConsoleLink(page, 'Liderlik');
  await expect(page.getByRole('heading', { name: 'Liderlik tablosu' })).toBeVisible();
  await expect(page.getByText('E2E Analist', { exact: true }).first()).toBeVisible({ timeout: 20_000 });
  await page.screenshot({ path: testInfo.outputPath('supervisor-leaderboard.png'), fullPage: true });
  expect(browserErrors).toEqual([]);
});

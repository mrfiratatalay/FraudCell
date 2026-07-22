/**
 * Mock veritabanı — bellekte, sayfa yenilenince sıfırlanır.
 *
 * Faz 0 yalnızca KİMLİK tarafını dolduruyor: uygulamanın açılıp giriş
 * yapılabilmesi için gereken minimum. İşlem/vaka/gamification tohumları
 * ilgili tarafın branch'inde eklenecek — böylece iki kişi aynı seed dosyasında
 * çakışmaz.
 *
 * Demo hesapları jüri sunumunda tek tek anlatılabilsin diye açıkça yazılmıştır.
 */

import type { CurrentUserResponse } from '@/shared/api/contract';
import type { AnalystSpecialty, OperationRegion, OtpPurpose, Role } from '@/shared/api/enums';

export interface MockUser extends CurrentUserResponse {
  /** Yalnızca personel girişinde kullanılır. */
  password?: string;
  /** Müşteri girişinde OTP eşleştirmesi için ham numara. */
  rawGsm?: string;
}

function staff(
  id: string,
  firstName: string,
  lastName: string,
  email: string,
  role: Role,
  specialties: AnalystSpecialty[],
  regions: OperationRegion[],
): MockUser {
  return {
    id,
    role,
    firstName,
    lastName,
    email,
    gsmNumber: null,
    specialties,
    regions,
    password: 'Fraud.2026',
  };
}

export const mockUsers: MockUser[] = [
  {
    id: 'usr_customer_1',
    role: 'CUSTOMER',
    firstName: 'Ayşe',
    lastName: 'Mandıralı',
    email: null,
    gsmNumber: '555 *** ** 12',
    rawGsm: '5551234512',
    specialties: [],
    regions: [],
  },
  staff(
    'usr_analyst_1',
    'Deniz',
    'Kaya',
    'analist@fraudcell.com',
    'ANALYST',
    ['CALINTI_KART', 'HESAP_ELE_GECIRME'],
    ['MARMARA', 'EGE'],
  ),
  staff(
    'usr_analyst_2',
    'Emre',
    'Yıldız',
    'analist2@fraudcell.com',
    'ANALYST',
    ['PARA_AKLAMA', 'SUPHELI_DAVRANIS'],
    ['IC_ANADOLU'],
  ),
  staff(
    'usr_supervisor_1',
    'Selin',
    'Arslan',
    'supervizor@fraudcell.com',
    'SUPERVISOR',
    [],
    ['MARMARA', 'EGE', 'IC_ANADOLU'],
  ),
  staff('usr_admin_1', 'Mert', 'Doğan', 'admin@fraudcell.com', 'ADMIN', [], []),
];

/** Demo sunumunda gösterilen sabit OTP. Gerçek backend rastgele üretir. */
export const DEMO_OTP_CODE = '123456';

/* --------------------------------------------------------------- oturum -- */

interface OtpChallenge {
  challengeId: string;
  gsmNumber: string;
  /**
   * Doğrulama davranışını BU belirler (backend `challenge.Purpose`):
   *   CustomerLogin    → numara kayıtlı değilse genel "kod hatalı" döner
   *   CustomerRegister → ad/soyad zorunlu, numara kayıtlıysa 409
   */
  purpose: OtpPurpose;
  expiresAt: number;
  attempts: number;
}

/**
 * Açık OTP istekleri. Gerçek backend bunları veritabanında tutar ve süre/deneme
 * limiti uygular; mock da aynı davranışı taklit eder ki OTP_CHALLENGE_LOCKED
 * ve OTP_CHALLENGE_EXPIRED ekranları test edilebilsin.
 */
export const otpChallenges = new Map<string, OtpChallenge>();

export const OTP_TTL_MS = 3 * 60 * 1000;
export const OTP_MAX_ATTEMPTS = 3;

/**
 * Mock'ta "oturum" = geçerli token listesi.
 *
 * Gerçek backend JWT imzalar; mock rastgele bir opak string üretip kullanıcıya
 * eşler. Token'ın kendisi doğrulanmaz, yalnızca haritada var mı diye bakılır.
 */
export const activeTokens = new Map<string, string>();

/**
 * Refresh cookie'sini taklit eder.
 *
 * Gerçek backend refresh token'ı Secure/HttpOnly cookie'ye yazar; MSW service
 * worker seviyesinde çalıştığı için böyle bir cookie üretemiyoruz.
 *
 * Değer `sessionStorage`'da tutuluyor — modül değişkeninde tutulsaydı sayfa
 * yenilendiğinde uçar ve mock modda her F5'te tekrar giriş gerekirdi.
 * Burada saklanan şey ACCESS TOKEN DEĞİL, yalnızca "hangi kullanıcının refresh
 * hakkı var" bilgisi; access token gerçek uygulamada olduğu gibi yalnızca
 * bellekte kalır. Sekme kapanınca `sessionStorage` da silinir.
 */
const REFRESH_KEY = 'fraudcell.mock.refreshSubject';

export function getRefreshSubject(): string | null {
  try {
    return sessionStorage.getItem(REFRESH_KEY);
  } catch {
    // Gizli sekme / storage kapalı: oturum yenilenemez, kullanıcı tekrar girer.
    return null;
  }
}

export function setRefreshSubject(userId: string | null): void {
  try {
    if (userId) sessionStorage.setItem(REFRESH_KEY, userId);
    else sessionStorage.removeItem(REFRESH_KEY);
  } catch {
    // Yut: mock oturumunun kalıcılığı kritik değil.
  }
}

export function issueToken(userId: string): string {
  const token = `mock_${crypto.randomUUID()}`;
  activeTokens.set(token, userId);
  setRefreshSubject(userId);
  return token;
}

export function userFromRequest(request: Request): MockUser | null {
  const header = request.headers.get('Authorization');
  if (!header?.startsWith('Bearer ')) return null;

  const userId = activeTokens.get(header.slice('Bearer '.length));
  if (!userId) return null;

  return mockUsers.find((user) => user.id === userId) ?? null;
}

export function findByGsm(gsm: string): MockUser | undefined {
  const digits = gsm.replace(/\D/g, '').slice(-10);
  return mockUsers.find((user) => user.rawGsm === digits);
}

export function findByEmail(email: string): MockUser | undefined {
  return mockUsers.find((user) => user.email?.toLowerCase() === email.toLowerCase());
}

/** Sözleşmede olmayan iç alanları (şifre, ham numara) yanıttan çıkarır. */
export function toCurrentUser(user: MockUser): CurrentUserResponse {
  const { password: _password, rawGsm: _rawGsm, ...rest } = user;
  return rest;
}

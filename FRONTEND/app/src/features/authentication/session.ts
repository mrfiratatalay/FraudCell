/**
 * Oturum durumu.
 *
 * access token BELLEKTE tutulur, refresh token
 * Secure/HttpOnly cookie'dedir. `localStorage` KULLANILMAZ — XSS ile çalınabilir
 * ve "JWT localStorage" açıkça çıkarılacaklar listesinde.
 *
 * Sonucu: sayfa yenilendiğinde token kaybolur. Bu kasıtlıdır; uygulama açılışta
 * `/auth/refresh` çağırıp cookie'den yeni access token alır (`bootstrapSession`).
 *
 * Global client state kütüphanesi yok. Bu, React ağacının dışında
 * da okunabilmesi gereken tek gerçek global — HTTP client'ın token'a erişmesi
 * lazım. `useSyncExternalStore` ile React'e bağlanan minik bir store yeterli.
 */

import { api } from '@/shared/api/client';
import { configureAuth } from '@/shared/api/auth-bridge';
import { endpoints } from '@/shared/api/endpoints';
import type {
  CurrentUserResponse,
  RefreshTokenResponse,
  StaffLoginUserResponse,
  VerifiedUserResponse,
} from '@/shared/api/contract';
import type { AnalystSpecialty, OperationRegion, Role } from '@/shared/api/enums';

/** Ekranların ihtiyaç duyduğu birleşik kullanıcı görünümü. */
export interface SessionUser {
  id: string;
  role: Role;
  firstName: string | null;
  lastName: string | null;
  email: string | null;
  /** Müşteride maskeli, personelde null. */
  gsmNumber: string | null;
  specialties: AnalystSpecialty[];
  regions: OperationRegion[];
}

export interface SessionState {
  user: SessionUser | null;
  /** Açılışta refresh denemesi sürerken true — bu sırada yönlendirme yapılmaz. */
  status: 'loading' | 'authenticated' | 'anonymous';
}

/* ------------------------------------------------------------------ store -- */

let accessToken: string | null = null;
let state: SessionState = { user: null, status: 'loading' };

const listeners = new Set<() => void>();

function emit(): void {
  for (const listener of listeners) listener();
}

function setState(next: SessionState): void {
  state = next;
  emit();
}

export const sessionStore = {
  subscribe(listener: () => void): () => void {
    listeners.add(listener);
    return () => listeners.delete(listener);
  },
  /** `useSyncExternalStore` referans eşitliği bekler; state nesnesi yerinde değişmez. */
  getSnapshot(): SessionState {
    return state;
  },
};

export function getAccessToken(): string | null {
  return accessToken;
}

/* -------------------------------------------------------------- dönüşüm -- */

export function fromCurrentUser(user: CurrentUserResponse): SessionUser {
  return {
    id: user.id,
    role: user.role,
    firstName: user.firstName,
    lastName: user.lastName,
    email: user.email,
    gsmNumber: user.gsmNumber,
    specialties: user.specialties,
    regions: user.regions,
  };
}

export function fromStaffLogin(user: StaffLoginUserResponse, email: string): SessionUser {
  return {
    id: user.id,
    role: user.role,
    firstName: user.firstName,
    lastName: user.lastName,
    email,
    gsmNumber: null,
    specialties: user.specialties,
    regions: user.regions,
  };
}

export function fromOtpVerification(user: VerifiedUserResponse): SessionUser {
  return {
    id: user.id,
    role: user.role,
    firstName: user.firstName,
    lastName: user.lastName,
    email: null,
    gsmNumber: user.gsmNumberMasked,
    // Müşteride uzmanlık/bölge kavramı yok.
    specialties: [],
    regions: [],
  };
}

/* ------------------------------------------------------------- eylemler -- */

/** Login başarılı olduğunda çağrılır. */
export function startSession(token: string, user: SessionUser): void {
  accessToken = token;
  setState({ user, status: 'authenticated' });
}

/** Oturumu yerelde kapatır; sunucu tarafı `logout` içinde yapılır. */
export function clearSession(): void {
  accessToken = null;
  setState({ user: null, status: 'anonymous' });
}

/**
 * Sunucudan çıkış yapar. Cookie'yi backend siler; ağ hatası olsa bile yerel
 * oturumu kapatırız — kullanıcı "çıkış yaptım" sanıp açık kalmasın.
 */
export async function logout(): Promise<void> {
  try {
    await api.post<void>(endpoints.auth.logout, { skipAuthRefresh: true });
  } catch {
    // Yut: yerel temizlik her hâlükârda yapılmalı.
  } finally {
    clearSession();
  }
}

/**
 * Refresh cookie'siyle yeni access token alır.
 *
 * `skipAuthRefresh: true` şart — aksi hâlde 401 alındığında client tekrar
 * refresh çağırır ve sonsuz döngüye girer.
 */
async function refresh(): Promise<string | null> {
  try {
    const result = await api.post<RefreshTokenResponse>(endpoints.auth.refresh, {
      skipAuthRefresh: true,
    });
    accessToken = result.data.accessToken;
    return accessToken;
  } catch {
    return null;
  }
}

/**
 * Uygulama açılışında bir kez çalışır.
 *
 * Sayfa yenilendiğinde bellekteki token gittiği için önce cookie'den token
 * tazelenir, sonra `/auth/me` ile kullanıcı çekilir. İkisinden biri başarısızsa
 * kullanıcı anonimdir — hata gösterilmez, giriş ekranı açılır.
 */
export async function bootstrapSession(): Promise<void> {
  const token = await refresh();
  if (!token) {
    clearSession();
    return;
  }

  try {
    const result = await api.get<CurrentUserResponse>(endpoints.auth.me, {
      skipAuthRefresh: true,
    });
    startSession(token, fromCurrentUser(result.data));
  } catch {
    clearSession();
  }
}

/**
 * HTTP client'ı bu store'a bağlar. `main.tsx` içinde, ilk istekten ÖNCE
 * çağrılmalıdır.
 */
export function installAuthBridge(): void {
  configureAuth({
    getAccessToken,
    refreshAccessToken: refresh,
    onSessionLost: clearSession,
  });
}

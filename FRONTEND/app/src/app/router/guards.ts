import { redirect } from '@tanstack/react-router';
import type { Role } from '@/shared/api/enums';
import type { SessionState } from '@/features/authentication/session';

/**
 * Route koruması.
 *
 * ⚠️ BU GÜVENLİK DEĞİLDİR. Kullanıcının göremeyeceği
 * ekranları göstermemek içindir; gerçek yetkilendirme her zaman Gateway ve
 * servistedir. Buradaki bir hata veri sızdırmaz — API yine 403 döner.
 */

export interface RouterContext {
  /** Router context'i statik olduğu için store'u fonksiyonla okuyoruz. */
  getSession: () => SessionState;
}

/** Rolün giriş sonrası açılış ekranı. */
export const HOME_BY_ROLE: Record<Role, string> = {
  CUSTOMER: '/customer',
  ANALYST: '/analyst',
  SUPERVISOR: '/supervisor',
  ADMIN: '/admin',
};

export function requireAuth(context: RouterContext, href: string): SessionState {
  const session = context.getSession();

  if (session.status !== 'authenticated' || !session.user) {
    throw redirect({
      to: '/auth',
      // Giriş sonrası kullanıcıyı gitmek istediği yere geri götür.
      search: { redirect: href },
    });
  }

  return session;
}

/**
 * Rol kontrolü. Yetkisiz kullanıcı 403 ekranı yerine KENDİ ana sayfasına
 * yollanır — analiste "yetkin yok" demek yerine vakalarını göstermek daha
 * kullanışlı.
 */
export function requireRole(context: RouterContext, href: string, ...roles: Role[]): SessionState {
  const session = requireAuth(context, href);
  const role = session.user!.role;

  if (!roles.includes(role)) {
    throw redirect({ to: HOME_BY_ROLE[role] });
  }

  return session;
}

/** Giriş yapmış kullanıcı auth ekranlarında takılı kalmasın. */
export function redirectIfAuthenticated(context: RouterContext): void {
  const session = context.getSession();
  if (session.status === 'authenticated' && session.user) {
    throw redirect({ to: HOME_BY_ROLE[session.user.role] });
  }
}

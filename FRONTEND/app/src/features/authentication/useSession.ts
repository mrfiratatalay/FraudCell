import { useSyncExternalStore } from 'react';
import { fullName } from '@/shared/lib/format';
import { isStaffRole, type Role } from '@/shared/api/enums';
import { sessionStore, type SessionState, type SessionUser } from './session';

/**
 * Oturumu React'e bağlar.
 *
 * Context yerine `useSyncExternalStore` kullanılıyor çünkü token'a HTTP
 * client'ın da (React ağacının dışından) erişmesi gerekiyor. Tek kaynak
 * `sessionStore`; context olsaydı ikinci bir doğruluk kaynağı oluşurdu.
 */
export function useSession(): SessionState {
  return useSyncExternalStore(sessionStore.subscribe, sessionStore.getSnapshot);
}

/**
 * Oturumun açık olduğu KESİN olan yerlerde kullanıcıyı verir.
 *
 * Korumalı route'ların altındaki ekranlarda `user`ın null olmadığını her seferde
 * kontrol etmemek için. Guard'ı atlatan bir kullanım olursa sessizce yanlış
 * veri göstermek yerine erken patlar.
 */
export function useCurrentUser(): SessionUser {
  const { user } = useSession();
  if (!user) {
    throw new Error('useCurrentUser yalnızca kimlik doğrulanmış route altında kullanılabilir.');
  }
  return user;
}

/** Ekranlarda tekrar eden ad-soyad birleştirmesi. */
export function useDisplayName(): string {
  const user = useCurrentUser();
  return fullName(user.firstName, user.lastName) || 'Kullanıcı';
}

/**
 * Rol kontrolü.
 *
 * bu GÜVENLİK DEĞİLDİR. Menü ve route'ları role göre
 * gizlemek içindir; gerçek yetkilendirme her zaman Gateway ve servistedir.
 */
export function useHasRole(...roles: Role[]): boolean {
  const { user } = useSession();
  return user !== null && roles.includes(user.role);
}

export function useIsStaff(): boolean {
  const { user } = useSession();
  return user !== null && isStaffRole(user.role);
}

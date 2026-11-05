/**
 * HTTP client ile kimlik katmanı arasındaki tek yönlü köprü.
 *
 * Client'ın token'a ve refresh'e ihtiyacı var; kimlik katmanının da client'a.
 * Bu köprü olmasaydı `client.ts` ile `features/authentication` birbirini
 * import ederdi. Köprü sayesinde bağımlılık tek yönlü kalır:
 *
 *     features/authentication  ──register──▶  auth-bridge  ◀──okur──  client
 *
 * `features/authentication/session.ts` uygulama açılışında `configureAuth`
 * çağırır. Çağrılmazsa client token'sız çalışır (login öncesi durum).
 */

interface AuthBridge {
  /** Bellekteki access token. localStorage KULLANILMAZ. */
  getAccessToken: () => string | null;
  /**
   * Refresh cookie'siyle yeni access token alır. Başarısızsa null döner.
   * Tek uçuş (single-flight) garantisi burada değil, client tarafında.
   */
  refreshAccessToken: () => Promise<string | null>;
  /** Refresh de başarısız oldu; oturum kapatılmalı ve giriş ekranına dönülmeli. */
  onSessionLost: () => void;
}

const noop: AuthBridge = {
  getAccessToken: () => null,
  refreshAccessToken: async () => null,
  onSessionLost: () => {},
};

let bridge: AuthBridge = noop;

export function configureAuth(next: Partial<AuthBridge>): void {
  bridge = { ...bridge, ...next };
}

export function resetAuthBridge(): void {
  bridge = noop;
}

export function getAccessToken(): string | null {
  return bridge.getAccessToken();
}

export function refreshAccessToken(): Promise<string | null> {
  return bridge.refreshAccessToken();
}

export function notifySessionLost(): void {
  bridge.onSessionLost();
}

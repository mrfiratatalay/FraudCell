import '@testing-library/jest-dom/vitest';

/**
 * Vitest ortak kurulumu.
 *
 * MSW node sunucusu burada BAŞLATILMAZ: her test dosyası kendi handler
 * setiyle çalışsın diye. Ortak bir sunucu, bir testin `server.use` ile
 * eklediği geçici handler'ın diğerine sızmasına yol açar.
 *
 * Component testleri için önerilen kalıp:
 *
 *   const server = setupServer(...handlers)
 *   beforeAll( => server.listen({ onUnhandledRequest: 'error' }))
 *   afterEach( => server.resetHandlers)
 *   afterAll( => server.close)
 */

// jsdom `crypto.randomUUID` sağlamıyor; client ve mock katmanı buna dayanıyor.
if (!globalThis.crypto?.randomUUID) {
  Object.defineProperty(globalThis.crypto, 'randomUUID', {
    value: () => '00000000-0000-4000-8000-000000000000',
    configurable: true,
  });
}

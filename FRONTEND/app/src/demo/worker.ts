import { setupWorker } from 'msw/browser';
import { caseHandlers } from './case-handlers';
import { identityHandlers } from './identity-handlers';

/** Starts the in-browser demo backend (Mock Service Worker). Live builds never load this file. */
export async function startDemoBackend(): Promise<void> {
  await setupWorker(...identityHandlers, ...caseHandlers).start({
    onUnhandledRequest(request, print) {
      if (new URL(request.url).pathname.startsWith('/api')) print.warning();
    },
    serviceWorker: { url: '/mockServiceWorker.js' },
    quiet: true,
  });
}

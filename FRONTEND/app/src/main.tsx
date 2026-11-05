import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { RouterProvider } from '@tanstack/react-router';

import '@/app/styles/globals.css';
import { AppProviders } from '@/app/providers/AppProviders';
import { router } from '@/app/router';
import { bootstrapSession, installAuthBridge } from '@/features/authentication/session';

/**
 * Açılış sırası kritik:
 *
 *   1. Demo backend (MSW) — demo modda, İLK istekten önce worker ayakta olmalı
 *   2. Auth köprüsü — HTTP client'ın token'a erişmesi için
 *   3. Oturum tazeleme — refresh cookie'sinden access token alınır
 *   4. Render
 *
 * (3) render'dan ÖNCE bekleniyor: yoksa router guard'ları henüz "anonim" olan
 * oturumu görüp kullanıcıyı giriş ekranına atar, refresh dönünce geri fırlatır.
 * Burada beklemek ilk boyamanın doğru ekranla yapılmasını garantiler.
 */
async function start(): Promise<void> {
  // Compared directly against the build-time constant so live builds drop the demo chunk.
  if (import.meta.env.VITE_API_MODE !== 'live') {
    const { startDemoBackend } = await import('@/demo/worker');
    await startDemoBackend();
  }

  installAuthBridge();
  await bootstrapSession();

  const container = document.getElementById('root');
  if (!container) throw new Error('#root bulunamadı — index.html bozulmuş olabilir.');

  createRoot(container).render(
    <StrictMode>
      <AppProviders>
        <RouterProvider router={router} />
      </AppProviders>
    </StrictMode>,
  );
}

void start();

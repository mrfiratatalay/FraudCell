import { lazy, Suspense, useEffect } from 'react';
import { Outlet } from '@tanstack/react-router';
import { useQueryClient } from '@tanstack/react-query';
import { Loader2 } from 'lucide-react';
import { useSession } from '@/features/authentication/useSession';
import { useRealtime } from '@/features/realtime/useRealtime';

/**
 * Uygulama kökü.
 *
 * İki işi var:
 *   1. SSE bağlantısını BİR KEZ kurmak
 *   2. Açılıştaki oturum tazeleme bitene kadar route'ları çizmemek
 *
 * (2) olmazsa şu olurdu: token henüz gelmemişken guard "anonim" görür ve
 * kullanıcıyı giriş ekranına atar, hemen ardından refresh başarılı olur ve
 * kullanıcı geri fırlar. Ekranda bir titreme oluşur.
 */
// Live builds compare the constant to 'live' and drop the demo chunk entirely.
const DemoBar = import.meta.env.VITE_API_MODE !== 'live' ? lazy(() => import('@/demo/DemoBar')) : null;

export function RootLayout() {
  const { status } = useSession();
  const queryClient = useQueryClient();
  useRealtime();

  useEffect(() => {
    if (status === 'anonymous') queryClient.clear();
  }, [queryClient, status]);

  if (status === 'loading') {
    return (
      <div
        className="flex min-h-dvh items-center justify-center bg-canvas"
        role="status"
        aria-label="Oturum kontrol ediliyor"
      >
        <Loader2 className="size-8 animate-spin text-brand-600" aria-hidden />
      </div>
    );
  }

  return (
    <>
      {DemoBar ? (
        <Suspense fallback={null}>
          <DemoBar />
        </Suspense>
      ) : null}
      <Outlet />
    </>
  );
}

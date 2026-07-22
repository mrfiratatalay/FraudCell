import { Link } from '@tanstack/react-router';
import { LogoMark } from '@/shared/ui/Logo';

/**
 * Karşılama ekranı — tasarımdaki tam sayfa gradient splash.
 *
 * Buradaki iki yol backend'in iki farklı OTP amacına karşılık gelir:
 *   "Giriş Yap"        → purpose=CustomerLogin
 *   "Hemen kayıt ol"   → purpose=CustomerRegister
 *
 * Ayrım baştan yapılmak ZORUNDA: backend numaranın kayıtlı olup olmadığını
 * doğrulama anında sızdırmıyor, davranışı challenge'ın amacına göre belirliyor.
 */
export function Welcome() {
  return (
    <div className="gradient-splash flex min-h-dvh flex-col px-6 safe-top safe-bottom">
      <div className="flex flex-1 flex-col items-center justify-center">
        <LogoMark className="size-20 text-white" />
        <h1 className="mt-5 text-center text-[28px] font-bold text-white">
          FraudCell'e Hoş Geldin!
        </h1>
        <p className="mt-2 max-w-xs text-center text-[15px] leading-relaxed text-white/80">
          İşlemlerin yapay zekâ destekli dolandırıcılık koruması altında.
        </p>

        <div className="mt-10 w-full max-w-sm space-y-4">
          <Link
            to="/auth/login"
            className="flex h-14 w-full items-center justify-center rounded-pill bg-white text-[17px] font-semibold text-brand-800 shadow-raised transition-colors hover:bg-brand-50 active:bg-brand-100"
          >
            Giriş Yap
          </Link>

          <Link
            to="/auth/register"
            className="block text-center text-[15px] font-semibold text-white underline-offset-4 hover:underline"
          >
            Hesabın yok mu? Hemen kayıt ol!
          </Link>
        </div>
      </div>

      <div className="pb-8 text-center">
        <Link
          to="/auth/staff"
          className="text-sm font-medium text-white/70 underline-offset-4 hover:text-white hover:underline"
        >
          Personel girişi
        </Link>
      </div>
    </div>
  );
}

import { cn } from '@/shared/lib/cn';

/**
 * Boş/başarı/hata durumları için inline SVG illüstrasyonlar.
 *
 * Harici asset yok: hepsi marka mavisi + Turkcell sarısı tonlarında, gömülü.
 * Yuvarlak, dolgun bir ikon dili kullanır. `currentColor` yerine
 * sabit token'lar kullanır ki koyu/açık zeminde tutarlı görünsün.
 */

export type IllustrationName = 'empty' | 'secure' | 'transactions' | 'inbox' | 'search' | 'reward';

const BLUE = '#0a4a94';
const BLUE_SOFT = '#c2e0f9';
const AQUA = '#2fc4e0';
const YELLOW = '#ffc800';

function Frame({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <svg viewBox="0 0 120 120" className={cn('size-28', className)} role="img" aria-hidden>
      <circle cx="60" cy="60" r="56" fill="#eef5fd" />
      {children}
    </svg>
  );
}

export function Illustration({
  name,
  className,
}: {
  name: IllustrationName;
  className?: string;
}) {
  switch (name) {
    case 'secure':
      return (
        <Frame className={className}>
          <path
            d="M60 28l22 8v18c0 14-9 24-22 28-13-4-22-14-22-28V36l22-8z"
            fill={BLUE}
          />
          <path
            d="M60 34l16 6v14c0 10.5-6.7 18-16 21-9.3-3-16-10.5-16-21V40l16-6z"
            fill={BLUE_SOFT}
          />
          <path
            d="M52 60l6 6 12-13"
            fill="none"
            stroke={BLUE}
            strokeWidth="4"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
          <circle cx="88" cy="40" r="7" fill={YELLOW} />
        </Frame>
      );
    case 'transactions':
      return (
        <Frame className={className}>
          <rect x="34" y="44" width="52" height="34" rx="6" fill={BLUE} />
          <rect x="34" y="52" width="52" height="7" fill="#083b78" />
          <rect x="40" y="66" width="18" height="5" rx="2.5" fill={BLUE_SOFT} />
          <circle cx="80" cy="40" r="12" fill={YELLOW} />
          <path d="M80 34v12M74 40h12" stroke={BLUE} strokeWidth="3" strokeLinecap="round" />
        </Frame>
      );
    case 'inbox':
      return (
        <Frame className={className}>
          <path d="M36 50h48v26a4 4 0 01-4 4H40a4 4 0 01-4-4V50z" fill={BLUE_SOFT} />
          <path d="M36 50l10-14h28l10 14H70a10 10 0 01-20 0H36z" fill={BLUE} />
          <circle cx="84" cy="42" r="8" fill={YELLOW} />
        </Frame>
      );
    case 'search':
      return (
        <Frame className={className}>
          <circle cx="55" cy="54" r="18" fill="none" stroke={BLUE} strokeWidth="6" />
          <path d="M69 68l14 14" stroke={BLUE} strokeWidth="7" strokeLinecap="round" />
          <circle cx="55" cy="54" r="9" fill={AQUA} opacity="0.5" />
        </Frame>
      );
    case 'reward':
      return (
        <Frame className={className}>
          <circle cx="60" cy="56" r="20" fill={YELLOW} />
          <circle cx="60" cy="56" r="13" fill="none" stroke={BLUE} strokeWidth="3" />
          <path d="M60 49l2.5 5 5.5.6-4 3.8 1 5.5-5-2.8-5 2.8 1-5.5-4-3.8 5.5-.6z" fill={BLUE} />
          <path d="M50 74l-6 14 16-6 16 6-6-14" fill={BLUE} />
        </Frame>
      );
    case 'empty':
    default:
      return (
        <Frame className={className}>
          <rect x="36" y="40" width="48" height="40" rx="6" fill="#fff" stroke={BLUE_SOFT} strokeWidth="3" />
          <rect x="44" y="52" width="32" height="4" rx="2" fill={BLUE_SOFT} />
          <rect x="44" y="62" width="22" height="4" rx="2" fill={BLUE_SOFT} />
          <circle cx="82" cy="44" r="9" fill={AQUA} />
        </Frame>
      );
  }
}

/**
 * Tasarım sistemi barrel'ı.
 *
 * Ekranlar bileşenleri buradan alır (`import { Button, Card } from '@/shared/ui'`).
 * Tek giriş noktası olması, ileride bir bileşenin dosyası bölündüğünde çağrı
 * yerlerinin değişmemesini sağlar.
 */

export { Button, type ButtonProps } from './Button';
export { Badge, ToneBadge, PulseDot } from './Badge';
export { Card, CardHeader, SectionTitle, StatTile, type CardProps } from './Card';
export { Avatar } from './Avatar';
export { StatusDot } from './StatusDot';
export { PageHeader, type Breadcrumb } from './PageHeader';
export { CustomerPageHeader } from './CustomerPageHeader';
export {
  Field,
  PasswordField,
  TextAreaField,
  RuleList,
  type FieldProps,
  type TextAreaFieldProps,
} from './Field';
export {
  Skeleton,
  SkeletonList,
  SkeletonCards,
  SkeletonChart,
  EmptyState,
  ErrorState,
  Banner,
} from './Feedback';
export { Illustration, type IllustrationName } from './Illustration';
export { DataTable } from './DataTable';
export { FilterChips, type ChipOption } from './FilterChips';
export { Timeline, type TimelineEntry } from './Timeline';
/*
 * Grafikler BİLEREK bu barrel'dan dışa aktarılmaz. Recharts ~140kB gzip'tir;
 * barrel'dan çıksaydı, `@/shared/ui`'den herhangi bir şey alan HER sayfa (müşteri
 * mobil ekranları dahil) hiç grafik göstermese de recharts'ı indirirdi. Grafik
 * kullanan sayfalar (pano, puanlar) doğrudan `@/shared/ui/charts`'tan alır.
 */
export { RiskGauge, RiskBar, type RiskGaugeProps } from './RiskGauge';
export { ReasonCodeList } from './ReasonCodeList';
export { SlaCountdown, type SlaCountdownProps } from './SlaCountdown';
export { Sheet, ConfirmDialog, type SheetProps } from './Sheet';
export { Tabs, TabPanel, type TabItem } from './Tabs';
export { ToastProvider, useToast } from './Toast';
export { ThemeToggle } from './ThemeToggle';

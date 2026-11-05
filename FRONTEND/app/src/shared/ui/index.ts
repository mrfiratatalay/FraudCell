/**
 * Tasarım sistemi barrel'ı.
 *
 * Ekranlar bileşenleri buradan alır (`import { Button, Card } from '@/shared/ui'`).
 * Tek giriş noktası olması, ileride bir bileşenin dosyası bölündüğünde çağrı
 * yerlerinin değişmemesini sağlar.
 */

export { Button, type ButtonProps } from './Button';
export { Badge, ToneBadge } from './Badge';
export { Card, type CardProps } from './Card';
export { Avatar } from './Avatar';
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
  EmptyState,
  ErrorState,
  Banner,
} from './Feedback';
export { Illustration, type IllustrationName } from './Illustration';
export { DataTable } from './DataTable';
export { FilterChips, type ChipOption } from './FilterChips';
export { Timeline, type TimelineEntry } from './Timeline';
/* Charts are imported from '@/shared/ui/charts' directly, not through this barrel. */
export { ReasonCodeList } from './ReasonCodeList';
export { SlaCountdown, type SlaCountdownProps } from './SlaCountdown';
export { Sheet, ConfirmDialog, type SheetProps } from './Sheet';
export { Tabs, TabPanel, type TabItem } from './Tabs';
export { ToastProvider, useToast } from './Toast';
export { ThemeToggle } from './ThemeToggle';
export { RiskScore, RiskMeter } from './RiskScore';
export { KpiStrip, type Kpi } from './KpiStrip';

import { Banner, Button } from '@/shared/ui';

/**
 * 409/412 çakışma durumu — DESIGN.MD kural 1: sessizce yeniden denenmez,
 * kullanıcı vakayı yenileyip tekrar denemelidir. `isConcurrencyError` ile
 * yakalanan her mutasyon hatası bu banner'ı gösterir.
 */
export function ConflictBanner({ onRefresh }: { onRefresh: () => void }) {
  return (
    <Banner
      tone="danger"
      action={
        <Button size="sm" variant="secondary" onClick={onRefresh}>
          Yenile
        </Button>
      }
    >
      Bu vaka sen bakarken başkası tarafından değiştirildi. Yenileyip tekrar dene.
    </Banner>
  );
}

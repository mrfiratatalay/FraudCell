import { Button } from '@/shared/ui';

/**
 * Yalnızca "Tüm vakalar" ekranında kullanılır — gerçek cursor pagination'a
 * sahip tek liste budur. `PageInfo` toplam sayfa/kayıt taşımaz, bu yüzden
 * "3 / 12. sayfa" gibi bir gösterim yerine bu buton kullanılır.
 */
export function LoadMoreButton({
  hasNextPage,
  isFetchingNextPage,
  onClick,
}: {
  hasNextPage: boolean;
  isFetchingNextPage: boolean;
  onClick: () => void;
}) {
  if (!hasNextPage) return null;

  return (
    <div className="flex justify-center py-4">
      <Button variant="secondary" loading={isFetchingNextPage} onClick={onClick}>
        Daha fazla yükle
      </Button>
    </div>
  );
}

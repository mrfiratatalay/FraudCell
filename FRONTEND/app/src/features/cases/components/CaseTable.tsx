import { flexRender, getCoreRowModel, useReactTable, type ColumnDef } from '@tanstack/react-table';
import { cn } from '@/shared/lib/cn';
import { EmptyState, ErrorState, SkeletonList } from '@/shared/ui';

/**
 * Üç liste ekranının (Vakalarım, Tüm vakalar, Atama kuyruğu) paylaştığı
 * tablo kabuğu — loading/error/empty durumları tek yerde (DESIGN.MD kural 4).
 *
 * Yalnızca `getCoreRowModel()` kullanılır: client-side sort/filter YOKTUR.
 * Backend ad-hoc sort/filter parametrelerini reddeder (`UNSUPPORTED_SORT`/
 * `UNSUPPORTED_FILTER`); sıralama backend'in verdiği sabit sıradır, filtre
 * yalnızca tipli query param'lardır (`CaseFilterBar`).
 */
export function CaseTable<T>({
  columns,
  data,
  isLoading,
  isError,
  error,
  onRetry,
  emptyTitle,
  emptyDescription,
  onRowClick,
  getRowId,
}: {
  columns: ColumnDef<T>[];
  data: T[];
  isLoading: boolean;
  isError: boolean;
  error?: unknown;
  onRetry?: () => void;
  emptyTitle: string;
  emptyDescription?: string;
  onRowClick?: (row: T) => void;
  getRowId?: (row: T) => string;
}) {
  const table = useReactTable({
    data,
    columns,
    getCoreRowModel: getCoreRowModel(),
    ...(getRowId ? { getRowId } : {}),
  });

  if (isLoading) return <SkeletonList rows={5} />;
  if (isError) return <ErrorState error={error} onRetry={onRetry} />;
  if (data.length === 0) return <EmptyState title={emptyTitle} description={emptyDescription} />;

  return (
    <div className="surface-card overflow-x-auto p-0">
      <table className="w-full text-sm">
        <thead>
          {table.getHeaderGroups().map((headerGroup) => (
            <tr key={headerGroup.id} className="border-b border-ink-100">
              {headerGroup.headers.map((header) => (
                <th
                  key={header.id}
                  className="px-4 py-3 text-left text-xs font-semibold whitespace-nowrap text-ink-500"
                >
                  {header.isPlaceholder
                    ? null
                    : flexRender(header.column.columnDef.header, header.getContext())}
                </th>
              ))}
            </tr>
          ))}
        </thead>
        <tbody>
          {table.getRowModel().rows.map((row) => (
            <tr
              key={row.id}
              onClick={onRowClick ? () => onRowClick(row.original) : undefined}
              className={cn(
                'border-b border-ink-100 last:border-0',
                onRowClick && 'cursor-pointer transition-colors hover:bg-ink-100/60',
              )}
            >
              {row.getVisibleCells().map((cell) => (
                <td key={cell.id} className="px-4 py-3 whitespace-nowrap">
                  {flexRender(cell.column.columnDef.cell, cell.getContext())}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

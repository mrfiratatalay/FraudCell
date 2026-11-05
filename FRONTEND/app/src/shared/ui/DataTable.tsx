import { useState, type ReactNode } from 'react';
import {
  flexRender,
  getCoreRowModel,
  getSortedRowModel,
  useReactTable,
  type ColumnDef,
  type SortingState,
} from '@tanstack/react-table';
import { ArrowDown, ArrowUp, ChevronsUpDown } from 'lucide-react';
import { cn } from '@/shared/lib/cn';
import { Skeleton } from './Feedback';

/**
 * Konsol veri tablosu — TanStack Table v8 sarmalayıcı.
 *
 * Sıralama istemci tarafındadır ve GÖRÜNEN sayfa ÜZERİNDE çalışır: backend
 * keyset pagination kullandığı için tüm veri bir arada değildir;
 * kolon sıralaması yalnızca eldeki satırları düzenler, veri kaynağını değiştirmez.
 *
 * Satıra tıklama detay sayfasına götürür (`onRowClick`); bu yüzden satır
 * klavyeyle de erişilebilir olmalıdır — `role="button"` + tabindex verilir.
 */
export function DataTable<T>({
  data,
  columns,
  isLoading = false,
  skeletonRows = 8,
  onRowClick,
  rowKey,
  empty,
  dense = false,
  className,
}: {
  data: T[];
  columns: ColumnDef<T, unknown>[];
  isLoading?: boolean;
  skeletonRows?: number;
  onRowClick?: (row: T) => void;
  rowKey: (row: T) => string;
  empty?: ReactNode;
  dense?: boolean;
  className?: string;
}) {
  const [sorting, setSorting] = useState<SortingState>([]);

  const table = useReactTable({
    data,
    columns,
    state: { sorting },
    onSortingChange: setSorting,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getRowId: rowKey,
  });

  const cellPad = dense ? 'px-3 py-2' : 'px-4 py-3 text-[13px]';

  return (
    <div className={cn('surface-panel overflow-hidden', className)}>
      <div className="overflow-x-auto scroll-slim">
        <table className="w-full min-w-[640px] border-collapse text-sm">
          <thead>
            {table.getHeaderGroups().map((headerGroup) => (
              <tr key={headerGroup.id} className="border-b border-line bg-subtle">
                {headerGroup.headers.map((header) => {
                  const canSort = header.column.getCanSort();
                  const sorted = header.column.getIsSorted();
                  return (
                    <th
                      key={header.id}
                      className={cn(
                        'text-left text-xs font-medium text-ink-500 select-none',
                        cellPad,
                      )}
                      aria-sort={
                        sorted === 'asc'
                          ? 'ascending'
                          : sorted === 'desc'
                            ? 'descending'
                            : undefined
                      }
                    >
                      {header.isPlaceholder ? null : canSort ? (
                        <button
                          type="button"
                          onClick={header.column.getToggleSortingHandler()}
                          className="inline-flex items-center gap-1.5 hover:text-ink-700"
                        >
                          {flexRender(header.column.columnDef.header, header.getContext())}
                          {sorted === 'asc' ? (
                            <ArrowUp className="size-3.5" />
                          ) : sorted === 'desc' ? (
                            <ArrowDown className="size-3.5" />
                          ) : (
                            <ChevronsUpDown className="size-3.5 text-ink-300" />
                          )}
                        </button>
                      ) : (
                        flexRender(header.column.columnDef.header, header.getContext())
                      )}
                    </th>
                  );
                })}
              </tr>
            ))}
          </thead>
          <tbody>
            {isLoading
              ? Array.from({ length: skeletonRows }, (_, rowIndex) => (
                  <tr key={rowIndex} className="border-b border-line last:border-0">
                    {columns.map((_, colIndex) => (
                      <td key={colIndex} className={cellPad}>
                        <Skeleton className="h-4 w-full max-w-28" />
                      </td>
                    ))}
                  </tr>
                ))
              : table.getRowModel().rows.map((row) => (
                  <tr
                    key={row.id}
                    onClick={onRowClick ? () => onRowClick(row.original) : undefined}
                    onKeyDown={
                      onRowClick
                        ? (event) => {
                            if (event.key === 'Enter' || event.key === ' ') {
                              event.preventDefault();
                              onRowClick(row.original);
                            }
                          }
                        : undefined
                    }
                    role={onRowClick ? 'button' : undefined}
                    tabIndex={onRowClick ? 0 : undefined}
                    className={cn(
                      'border-b border-line last:border-0',
                      onRowClick &&
                        'cursor-pointer transition-colors hover:bg-subtle focus-visible:bg-subtle focus-visible:outline-none',
                    )}
                  >
                    {row.getVisibleCells().map((cell) => (
                      <td key={cell.id} className={cn('text-ink-800', cellPad)}>
                        {flexRender(cell.column.columnDef.cell, cell.getContext())}
                      </td>
                    ))}
                  </tr>
                ))}
          </tbody>
        </table>
      </div>

      {!isLoading && data.length === 0 && empty && <div>{empty}</div>}
    </div>
  );
}

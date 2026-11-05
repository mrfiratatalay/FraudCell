import { useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { ColumnDef } from '@tanstack/react-table';
import { Pencil, Plus } from 'lucide-react';
import {
  createStaff,
  getStaffReferences,
  listStaff,
  updateStaffFully,
  type StaffEditValues,
} from '@/features/staff/api';
import type { StaffResponse } from '@/shared/api/contract';
import type { AnalystSpecialty, OperationRegion, Role } from '@/shared/api/enums';
import { ROLE_LABEL } from '@/shared/api/enums';
import { queryKeys } from '@/shared/api/query-keys';
import { formatRelative, fullName } from '@/shared/lib/format';
import {
  Avatar,
  Button,
  DataTable,
  EmptyState,
  ErrorState,
  Field,
  PageHeader,
  PasswordField,
  Sheet,
  KpiStrip,
  ToneBadge,
  useToast,
} from '@/shared/ui';

interface StaffFormValues extends StaffEditValues {
  email: string;
  password: string;
}

const EMPTY_FORM: StaffFormValues = {
  firstName: '',
  lastName: '',
  email: '',
  password: '',
  role: 'ANALYST',
  specialties: [],
  regions: [],
  assignmentEnabled: true,
  isActive: true,
};

export function StaffManagementPage() {
  const queryClient = useQueryClient();
  const toast = useToast();
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<StaffResponse | null>(null);
  const [values, setValues] = useState<StaffFormValues>(EMPTY_FORM);
  const staff = useQuery({ queryKey: queryKeys.staff.list, queryFn: () => listStaff(100) });
  const references = useQuery({ queryKey: ['staff', 'references'], queryFn: getStaffReferences });
  const staffItems = staff.data?.items ?? [];
  const activeCount = staffItems.filter((person) => person.isActive).length;
  const analystCount = staffItems.filter((person) => person.role === 'ANALYST').length;
  const assignableCount = staffItems.filter(
    (person) => person.role === 'ANALYST' && person.isActive && person.assignmentEnabled,
  ).length;
  const save = useMutation({
    mutationFn: async () => {
      if (editing) return updateStaffFully(editing, values);
      return createStaff({
        firstName: values.firstName.trim(),
        lastName: values.lastName.trim(),
        email: values.email.trim(),
        password: values.password,
        role: values.role,
        specialties: values.specialties,
        regions: values.regions,
        assignmentEnabled: values.assignmentEnabled,
      });
    },
    onSuccess: async () => {
      setOpen(false);
      await queryClient.invalidateQueries({ queryKey: queryKeys.staff.all });
      toast.success(editing ? 'Personel güncellendi' : 'Personel oluşturuldu');
    },
    onError: (error) => toast.fromError(error),
  });

  const openCreate = () => {
    setEditing(null);
    setValues(EMPTY_FORM);
    setOpen(true);
  };
  const openEdit = (person: StaffResponse) => {
    setEditing(person);
    setValues({
      firstName: person.firstName,
      lastName: person.lastName,
      email: person.email,
      password: '',
      role: person.role,
      specialties: person.specialties,
      regions: person.regions,
      assignmentEnabled: person.assignmentEnabled,
      isActive: person.isActive,
    });
    setOpen(true);
  };
  const toggle = <T extends string>(items: T[], value: T): T[] =>
    items.includes(value) ? items.filter((item) => item !== value) : [...items, value];
  const valid = Boolean(
    values.firstName.trim() &&
      values.lastName.trim() &&
      (editing || (values.email.trim() && values.password.length >= 8)) &&
      values.specialties.length > 0 &&
      values.regions.length > 0,
  );

  const columns = useMemo<ColumnDef<StaffResponse, unknown>[]>(
    () => [
      {
        id: 'name',
        header: 'Personel',
        accessorFn: (row) => `${row.firstName} ${row.lastName}`,
        cell: (ctx) => {
          const person = ctx.row.original;
          const name = fullName(person.firstName, person.lastName);
          return (
            <div className="flex min-w-0 items-center gap-3">
              <Avatar name={name} size="sm" />
              <div className="min-w-0">
                <p className="truncate font-semibold text-ink-900">{name}</p>
                <p className="truncate text-caption text-ink-400">{person.email}</p>
              </div>
            </div>
          );
        },
      },
      {
        id: 'role',
        header: 'Rol',
        accessorFn: (row) => row.role,
        cell: (ctx) => (
          <ToneBadge toneClass="bg-brand-100 text-brand-700">
            {ROLE_LABEL[ctx.row.original.role]}
          </ToneBadge>
        ),
      },
      {
        id: 'status',
        header: 'Durum',
        accessorFn: (row) => (row.isActive ? 1 : 0),
        cell: (ctx) => (
          <ToneBadge
            toneClass={
              ctx.row.original.isActive
                ? 'bg-success-100 text-success-700'
                : 'bg-danger-100 text-danger-700'
            }
          >
            {ctx.row.original.isActive ? 'Aktif' : 'Pasif'}
          </ToneBadge>
        ),
      },
      {
        id: 'assignment',
        header: 'Atama',
        enableSorting: false,
        cell: (ctx) => {
          const person = ctx.row.original;
          if (person.role !== 'ANALYST') return <span className="text-ink-300">—</span>;
          return (
            <ToneBadge
              toneClass={
                person.assignmentEnabled
                  ? 'bg-ink-100 text-ink-700'
                  : 'bg-warning-100 text-warning-700'
              }
            >
              {person.assignmentEnabled ? 'Açık' : 'Kapalı'}
            </ToneBadge>
          );
        },
      },
      {
        id: 'createdAt',
        header: 'Oluşturma',
        accessorFn: (row) => row.createdAt,
        cell: (ctx) => (
          <span className="whitespace-nowrap text-caption text-ink-400">
            {formatRelative(ctx.row.original.createdAt)}
          </span>
        ),
      },
      {
        id: 'actions',
        header: '',
        enableSorting: false,
        cell: (ctx) => (
          <button
            type="button"
            aria-label={`${ctx.row.original.firstName} düzenle`}
            onClick={(event) => {
              event.stopPropagation();
              openEdit(ctx.row.original);
            }}
            className="rounded-full p-2 text-ink-400 hover:bg-ink-100 hover:text-brand-700"
          >
            <Pencil className="size-4" />
          </button>
        ),
      },
    ],
    [],
  );

  return (
    <div>
      <PageHeader
        title="Personel"
        description="Roller, uzmanlıklar, bölgeler ve atamaya açıklık. Düzenlemek için satıra tıkla."
        actions={
          <Button leadingIcon={<Plus className="size-4" />} onClick={openCreate}>
            Personel ekle
          </Button>
        }
      />

      {!staff.isError ? (
        <KpiStrip
          className="mb-5"
          items={[
            { label: 'Toplam personel', value: staff.isPending ? '—' : staffItems.length },
            { label: 'Aktif hesap', value: staff.isPending ? '—' : activeCount },
            { label: 'Analist', value: staff.isPending ? '—' : analystCount },
            { label: 'Atamaya açık', value: staff.isPending ? '—' : assignableCount, hint: 'Aktif ve atamaya açık analist' },
          ]}
        />
      ) : null}

      {staff.isError ? (
        <ErrorState error={staff.error} onRetry={() => void staff.refetch()} />
      ) : (
        <DataTable
          data={staffItems}
          columns={columns}
          isLoading={staff.isPending}
          rowKey={(row) => row.id}
          onRowClick={openEdit}
          empty={<EmptyState illustration="empty" title="Personel kaydı yok" />}
        />
      )}

      <Sheet
        open={open}
        onOpenChange={(next) => {
          if (!next && !save.isPending) setOpen(false);
        }}
        title={editing ? 'Personeli düzenle' : 'Yeni personel'}
        footer={
          <Button loading={save.isPending} disabled={!valid} onClick={() => save.mutate()}>
            Kaydet
          </Button>
        }
      >
        {references.isError ? (
          <ErrorState error={references.error} onRetry={() => void references.refetch()} />
        ) : null}
        <div className="grid gap-3 sm:grid-cols-2">
          <Field
            label="Ad"
            value={values.firstName}
            onChange={(event) => setValues((current) => ({ ...current, firstName: event.target.value }))}
          />
          <Field
            label="Soyad"
            value={values.lastName}
            onChange={(event) => setValues((current) => ({ ...current, lastName: event.target.value }))}
          />
        </div>
        {!editing ? (
          <div className="mt-3 grid gap-3">
            <Field
              type="email"
              label="E-posta"
              value={values.email}
              onChange={(event) => setValues((current) => ({ ...current, email: event.target.value }))}
            />
            <PasswordField
              label="Geçici şifre"
              hint="En az 8 karakter, büyük/küçük harf, rakam ve özel karakter."
              value={values.password}
              onChange={(event) => setValues((current) => ({ ...current, password: event.target.value }))}
            />
          </div>
        ) : null}

        <label className="mt-4 block text-sm font-semibold text-ink-700">
          Rol
          <select
            aria-label="Rol"
            value={values.role}
            onChange={(event) => setValues((current) => ({ ...current, role: event.target.value as Role }))}
            className="mt-2 h-11 w-full rounded-md border border-ink-200 bg-surface px-3 font-normal"
          >
            {references.data?.roles
              .filter((item) => item.code !== 'CUSTOMER')
              .map((item) => (
                <option key={item.code} value={item.code}>
                  {item.displayName}
                </option>
              ))}
          </select>
        </label>

        <fieldset className="mt-4">
          <legend className="text-sm font-semibold text-ink-700">Uzmanlıklar</legend>
          <div className="mt-2 grid gap-2 sm:grid-cols-2">
            {references.data?.specialties.map((item) => {
              const code = item.code as AnalystSpecialty;
              return (
                <label
                  key={code}
                  className="flex items-center gap-2 rounded-md border border-ink-200 px-3 py-2 text-sm text-ink-700"
                >
                  <input
                    type="checkbox"
                    checked={values.specialties.includes(code)}
                    onChange={() =>
                      setValues((current) => ({
                        ...current,
                        specialties: toggle(current.specialties, code),
                      }))
                    }
                  />
                  {item.displayName}
                </label>
              );
            })}
          </div>
        </fieldset>

        <fieldset className="mt-4">
          <legend className="text-sm font-semibold text-ink-700">Bölgeler</legend>
          <div className="mt-2 grid gap-2 sm:grid-cols-2">
            {references.data?.regions.map((item) => {
              const code = item.code as OperationRegion;
              return (
                <label
                  key={code}
                  className="flex items-center gap-2 rounded-md border border-ink-200 px-3 py-2 text-sm text-ink-700"
                >
                  <input
                    type="checkbox"
                    checked={values.regions.includes(code)}
                    onChange={() =>
                      setValues((current) => ({
                        ...current,
                        regions: toggle(current.regions, code),
                      }))
                    }
                  />
                  {item.displayName}
                </label>
              );
            })}
          </div>
        </fieldset>

        <div className="mt-4 grid gap-2 sm:grid-cols-2">
          <label className="flex items-center gap-2 rounded-md bg-ink-100 px-3 py-3 text-sm font-medium text-ink-700">
            <input
              type="checkbox"
              checked={values.assignmentEnabled}
              onChange={(event) =>
                setValues((current) => ({ ...current, assignmentEnabled: event.target.checked }))
              }
            />
            Atamaya açık
          </label>
          {editing ? (
            <label className="flex items-center gap-2 rounded-md bg-ink-100 px-3 py-3 text-sm font-medium text-ink-700">
              <input
                type="checkbox"
                checked={values.isActive}
                onChange={(event) =>
                  setValues((current) => ({ ...current, isActive: event.target.checked }))
                }
              />
              Aktif hesap
            </label>
          ) : null}
        </div>
      </Sheet>
    </div>
  );
}

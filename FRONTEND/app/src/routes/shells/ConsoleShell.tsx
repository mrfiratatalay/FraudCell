import { useEffect, useState, type ComponentType } from 'react';
import { Link, Outlet, useNavigate, useRouterState } from '@tanstack/react-router';
import * as Dropdown from '@radix-ui/react-dropdown-menu';
import * as Dialog from '@radix-ui/react-dialog';
import {
  BarChart3,
  ChevronRight,
  ClipboardList,
  FolderKanban,
  LayoutDashboard,
  ListChecks,
  LogOut,
  Menu,
  ScrollText,
  Trophy,
  Users,
  X,
} from 'lucide-react';
import { cn } from '@/shared/lib/cn';
import { fullName } from '@/shared/lib/format';
import { ROLE_LABEL, type Role } from '@/shared/api/enums';
import { LogoWordmark } from '@/shared/ui/Logo';
import { Avatar, ThemeToggle } from '@/shared/ui';
import { logout } from '@/features/authentication/session';
import { useSession } from '@/features/authentication/useSession';

/**
 * Operations console shell: a navy sidebar, a thin top bar with where-you-are,
 * and the page. No decorative page banners — each page starts with its work.
 *
 * The menu is filtered by role only to hide irrelevant links; real
 * authorisation lives in the route guards and the backend.
 */

interface NavItem {
  to: string;
  label: string;
  icon: ComponentType<{ className?: string }>;
  roles: readonly Role[];
  /** Kök öğe alt sayfalarda aktif SAYILMAZ (yalnızca tam eşleşme). */
  root?: boolean;
}

interface NavGroup {
  heading: string;
  items: NavItem[];
}

const NAV_GROUPS: NavGroup[] = [
  {
    heading: 'Analiz',
    items: [
      { to: '/analyst', label: 'Vakalarım', icon: FolderKanban, roles: ['ANALYST'], root: true },
      { to: '/analyst/points', label: 'Profilim', icon: Trophy, roles: ['ANALYST'] },
    ],
  },
  {
    heading: 'Operasyon',
    items: [
      { to: '/supervisor', label: 'Panel', icon: LayoutDashboard, roles: ['SUPERVISOR', 'ADMIN'], root: true },
      { to: '/supervisor/cases', label: 'Tüm Vakalar', icon: ClipboardList, roles: ['SUPERVISOR', 'ADMIN'] },
      { to: '/supervisor/queue', label: 'Atama Kuyruğu', icon: ListChecks, roles: ['SUPERVISOR', 'ADMIN'] },
      { to: '/supervisor/leaderboard', label: 'Liderlik', icon: BarChart3, roles: ['SUPERVISOR', 'ADMIN'] },
    ],
  },
  {
    heading: 'Yönetim',
    items: [
      { to: '/admin', label: 'Personel', icon: Users, roles: ['ADMIN'], root: true },
      { to: '/admin/audit', label: 'Denetim', icon: ScrollText, roles: ['ADMIN'] },
    ],
  },
];

/** Kök öğe yalnızca tam eşleşmede aktif; diğerleri alt yollarda da aktif. */
function isActive(pathname: string, item: NavItem): boolean {
  if (item.root) return pathname === item.to;
  return pathname === item.to || pathname.startsWith(`${item.to}/`);
}

function NavLinks({
  groups,
  pathname,
  onNavigate,
}: {
  groups: NavGroup[];
  pathname: string;
  onNavigate?: () => void;
}) {
  return (
    <nav aria-label="Konsol gezinme" className="scroll-slim flex-1 space-y-6 overflow-y-auto px-3 py-4">
      {groups.map((group) => (
        <div key={group.heading}>
          <p className="px-2.5 pb-1.5 text-[11px] font-medium text-console-muted/70">{group.heading}</p>
          <ul className="space-y-px">
            {group.items.map((item) => {
              const active = isActive(pathname, item);
              const Icon = item.icon;
              return (
                <li key={item.to}>
                  <Link
                    to={item.to}
                    onClick={onNavigate}
                    aria-current={active ? 'page' : undefined}
                    className={cn(
                      'group relative flex h-9 items-center gap-2.5 rounded-md px-2.5 text-[13px] font-medium transition-colors',
                      active
                        ? 'bg-white/[0.08] text-white'
                        : 'text-console-muted hover:bg-white/[0.04] hover:text-console-text',
                    )}
                  >
                    {active && (
                      <span className="absolute inset-y-2 -left-3 w-[3px] rounded-r-full bg-tc-500" aria-hidden />
                    )}
                    <Icon
                      className={cn(
                        'size-4 shrink-0 transition-colors',
                        active ? 'text-tc-500' : 'text-console-muted group-hover:text-console-text',
                      )}
                    />
                    {item.label}
                  </Link>
                </li>
              );
            })}
          </ul>
        </div>
      ))}
    </nav>
  );
}

function SidebarInner({
  groups,
  pathname,
  name,
  role,
  onNavigate,
  onLogout,
}: {
  groups: NavGroup[];
  pathname: string;
  name: string;
  role: Role;
  onNavigate?: () => void;
  onLogout: () => void;
}) {
  return (
    <div className="on-console flex h-full flex-col bg-console-bg text-console-text">
      <div className="flex h-14 shrink-0 items-center px-5">
        <LogoWordmark tone="white" />
      </div>

      <NavLinks groups={groups} pathname={pathname} onNavigate={onNavigate} />

      <div className="shrink-0 border-t border-console-border p-3">
        <div className="flex items-center gap-2.5 rounded-md px-1.5 py-1.5">
          <Avatar name={name} size="sm" onDark />
          <div className="min-w-0 flex-1">
            <p className="truncate text-[13px] font-medium text-console-text">{name}</p>
            <p className="text-[11px] text-console-muted">{ROLE_LABEL[role]}</p>
          </div>
          <button
            type="button"
            onClick={onLogout}
            aria-label="Çıkış yap"
            title="Çıkış yap"
            className="flex size-8 items-center justify-center rounded-md text-console-muted transition-colors hover:bg-white/[0.08] hover:text-white"
          >
            <LogOut className="size-4" />
          </button>
        </div>
      </div>
    </div>
  );
}

export function ConsoleShell() {
  const { user } = useSession();
  const navigate = useNavigate();
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const [drawerOpen, setDrawerOpen] = useState(false);

  useEffect(() => {
    if (!user) void navigate({ to: '/auth', replace: true });
  }, [navigate, user]);

  // Close the mobile drawer on navigation.
  useEffect(() => setDrawerOpen(false), [pathname]);

  if (!user) return null;

  const groups = NAV_GROUPS.map((group) => ({
    ...group,
    items: group.items.filter((item) => item.roles.includes(user.role)),
  })).filter((group) => group.items.length > 0);

  const handleLogout = () => {
    void logout().then(() => navigate({ to: '/auth', replace: true }));
  };

  const name = fullName(user.firstName, user.lastName) || 'Kullanıcı';

  const activeGroup = groups.find((g) => g.items.some((item) => isActive(pathname, item)));
  const activeItem = activeGroup?.items.find((item) => isActive(pathname, item));
  // A detail page under a list (e.g. /analyst/cases/123) shows the list it came from.
  const listItem =
    activeItem ??
    groups
      .flatMap((g) => g.items)
      .filter((item) => pathname.startsWith(`${item.to}/`))
      .sort((a, b) => b.to.length - a.to.length)[0];

  return (
    <div className="relative min-h-dvh bg-canvas">
      <aside className="fixed inset-y-0 left-0 z-30 hidden w-60 lg:block">
        <SidebarInner groups={groups} pathname={pathname} name={name} role={user.role} onLogout={handleLogout} />
      </aside>

      <Dialog.Root open={drawerOpen} onOpenChange={setDrawerOpen}>
        <Dialog.Portal>
          <Dialog.Overlay className="fixed inset-0 z-40 animate-fade-in bg-night-950/60 lg:hidden" />
          <Dialog.Content
            className="fixed inset-y-0 left-0 z-50 w-72 animate-fade-in outline-none lg:hidden"
            aria-describedby={undefined}
          >
            <Dialog.Title className="sr-only">Gezinme menüsü</Dialog.Title>
            <div className="relative h-full">
              <Dialog.Close
                className="absolute top-3 right-3 z-10 flex size-8 items-center justify-center rounded-md text-console-muted hover:bg-white/10 hover:text-white"
                aria-label="Menüyü kapat"
              >
                <X className="size-4" />
              </Dialog.Close>
              <SidebarInner
                groups={groups}
                pathname={pathname}
                name={name}
                role={user.role}
                onNavigate={() => setDrawerOpen(false)}
                onLogout={handleLogout}
              />
            </div>
          </Dialog.Content>
        </Dialog.Portal>
      </Dialog.Root>

      <div className="flex min-h-dvh min-w-0 flex-col lg:pl-60">
        <header className="sticky top-0 z-20 flex h-14 items-center gap-2 border-b border-line bg-surface/85 px-3 backdrop-blur-xl sm:px-6">
          <button
            type="button"
            onClick={() => setDrawerOpen(true)}
            aria-label="Menüyü aç"
            className="flex size-8 items-center justify-center rounded-md text-ink-500 transition-colors hover:bg-ink-100 lg:hidden"
          >
            <Menu className="size-4" />
          </button>

          <nav aria-label="Konum" className="flex min-w-0 flex-1 items-center gap-1.5 text-[13px]">
            {activeGroup && <span className="hidden text-ink-500 sm:inline">{activeGroup.heading}</span>}
            {activeGroup && <ChevronRight className="hidden size-3.5 text-ink-400 sm:block" aria-hidden />}
            {listItem && !activeItem ? (
              <>
                <Link to={listItem.to} className="truncate text-ink-500 hover:text-ink-900">
                  {listItem.label}
                </Link>
                <ChevronRight className="size-3.5 shrink-0 text-ink-400" aria-hidden />
                <span className="truncate font-medium text-ink-900">Detay</span>
              </>
            ) : (
              <span className="truncate font-medium text-ink-900">{activeItem?.label ?? 'Konsol'}</span>
            )}
          </nav>

          <ThemeToggle />

          <Dropdown.Root>
            <Dropdown.Trigger asChild>
              <button
                type="button"
                className="ml-1 rounded-full outline-none focus-visible:focus-ring"
                aria-label="Kullanıcı menüsü"
              >
                <Avatar name={name} size="sm" />
              </button>
            </Dropdown.Trigger>
            <Dropdown.Portal>
              <Dropdown.Content
                align="end"
                sideOffset={8}
                className="z-50 min-w-56 animate-scale-in rounded-lg border border-line bg-surface p-1 shadow-overlay"
              >
                <div className="px-2.5 py-2">
                  <p className="text-[13px] font-medium text-ink-900">{name}</p>
                  <p className="text-xs text-ink-500">{ROLE_LABEL[user.role]}</p>
                </div>
                <Dropdown.Separator className="my-1 h-px bg-line" />
                <Dropdown.Item
                  onSelect={handleLogout}
                  className="flex h-8 cursor-pointer items-center gap-2 rounded-md px-2.5 text-[13px] text-ink-700 outline-none data-highlighted:bg-ink-100 data-highlighted:text-ink-900"
                >
                  <LogOut className="size-4" />
                  Çıkış yap
                </Dropdown.Item>
              </Dropdown.Content>
            </Dropdown.Portal>
          </Dropdown.Root>
        </header>

        <main className="min-w-0 flex-1 px-4 py-6 sm:px-6 lg:px-8 lg:py-8">
          <div className="mx-auto w-full max-w-[88rem]">
            <Outlet />
          </div>
        </main>
      </div>
    </div>
  );
}

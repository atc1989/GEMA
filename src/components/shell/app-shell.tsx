"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useTheme } from "next-themes";
import { Fragment, useEffect, useState, type ReactNode } from "react";
import { useFormStatus } from "react-dom";
import { Loader2, LogOut, Monitor, MoreHorizontal, Moon, Sun } from "lucide-react";

import { signOutAction } from "@/lib/actions/auth";

import {
  adminNavigation,
  memberNavigation,
  prospectNavigation,
  type NavigationItem,
} from "@/components/shell/navigation";
import { GemaWordmark } from "@/components/event/posters/gema-wordmark";
import { LinkPendingIcon } from "@/components/ui/link-pending";
import { cn } from "@/lib/utils";

export type AppShellUser = {
  name: string;
  email: string;
  role: string;
};

type AppShellProps = {
  role: "public" | "member" | "admin";
  eyebrow: string;
  title: string;
  subtitle: string;
  user?: AppShellUser;
  signOutSlot?: ReactNode;
  children: ReactNode;
};

// ─── Avatar helpers ─────────────────────────────────────────────────────────

const AVATAR_COLORS = [
  "#1d4ed8", "#7c3aed", "#047857", "#b45309", "#be123c", "#0369a1",
];

function avatarBg(name: string | null | undefined): string {
  const n = name ?? "";
  let hash = 0;
  for (let i = 0; i < n.length; i++) {
    hash = (hash * 31 + n.charCodeAt(i)) & 0xffffffff;
  }
  return AVATAR_COLORS[Math.abs(hash) % AVATAR_COLORS.length]!;
}

function initials(name: string | null | undefined): string {
  const n = (name ?? "?").trim();
  const parts = n.split(/\s+/);
  if (parts.length >= 2) return (parts[0]![0]! + parts[1]![0]!).toUpperCase();
  return n.slice(0, 2).toUpperCase() || "?";
}

// ─── Theme switcher ──────────────────────────────────────────────────────────

function ThemeSwitcher() {
  const { theme, setTheme } = useTheme();
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  const options = [
    { value: "light", icon: Sun, label: "Light" },
    { value: "system", icon: Monitor, label: "System" },
    { value: "dark", icon: Moon, label: "Dark" },
  ] as const;

  if (!mounted) {
    return <div className="h-8 w-full rounded-lg bg-muted" />;
  }

  return (
    <div className="flex rounded-lg bg-muted p-0.5">
      {options.map(({ value, icon: Icon, label }) => (
        <button
          key={value}
          type="button"
          onClick={() => setTheme(value)}
          aria-label={`${label} theme`}
          className={cn(
            "flex flex-1 items-center justify-center gap-1.5 rounded-md py-1.5 text-[11px] font-bold transition-colors",
            theme === value
              ? "bg-background text-foreground shadow-sm"
              : "text-muted-foreground hover:text-foreground",
          )}
        >
          <Icon className="size-3.5" aria-hidden="true" />
          {label}
        </button>
      ))}
    </div>
  );
}

/** Compact header button for mobile/tablet: tap cycles light → dark → system. */
function MobileThemeToggle() {
  const { theme, setTheme } = useTheme();
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  if (!mounted) {
    return <div className="size-9 shrink-0 rounded-full bg-white/10" />;
  }

  const order = ["light", "dark", "system"] as const;
  const current = order.includes(theme as (typeof order)[number])
    ? (theme as (typeof order)[number])
    : "system";
  const next = order[(order.indexOf(current) + 1) % order.length]!;
  const Icon = current === "light" ? Sun : current === "dark" ? Moon : Monitor;

  return (
    <button
      type="button"
      onClick={() => setTheme(next)}
      aria-label={`Theme: ${current}. Switch to ${next}.`}
      className="flex size-9 shrink-0 items-center justify-center rounded-full border-2 border-white/30 text-white transition-colors hover:bg-white/10"
    >
      <Icon className="size-4" aria-hidden="true" />
    </button>
  );
}

function MobileSignOutIcon() {
  const { pending } = useFormStatus();
  const Icon = pending ? Loader2 : LogOut;
  return <Icon className={cn("size-4", pending && "animate-spin")} aria-hidden="true" />;
}

/** Header sign-out for mobile/tablet; the desktop sidebar uses signOutSlot. */
function MobileSignOutButton() {
  return (
    <form action={signOutAction} className="shrink-0">
      <button
        type="submit"
        aria-label="Sign out"
        className="flex size-9 items-center justify-center rounded-full border-2 border-white/30 text-white transition-colors hover:bg-white/10"
      >
        <MobileSignOutIcon />
      </button>
    </form>
  );
}

// ─── Sidebar user block ───────────────────────────────────────────────────────

function SidebarUserBlock({
  user,
  signOutSlot,
}: {
  user: AppShellUser;
  signOutSlot?: ReactNode;
}) {
  const bg = avatarBg(user.name);
  const inits = initials(user.name);
  const firstName = user.name.split(" ")[0] ?? user.name;

  return (
    <div className="shrink-0 border-t border-sidebar-border p-3 pb-4">
      {/* Avatar row */}
      <div className="mb-2.5 flex items-center gap-2.5">
        <div
          className="flex size-8 shrink-0 items-center justify-center rounded-full text-[11px] font-black text-white"
          style={{ backgroundColor: bg }}
          aria-hidden="true"
        >
          {inits}
        </div>
        <div className="min-w-0 flex-1">
          <div className="truncate text-[13px] font-bold leading-tight text-sidebar-foreground">
            {firstName}
          </div>
          <div className="mt-0.5 inline-flex items-center rounded-md bg-sidebar-accent px-1.5 py-0.5 text-[10px] font-bold text-brand">
            {user.role}
          </div>
        </div>
        {signOutSlot}
      </div>

      {/* Theme switcher */}
      <ThemeSwitcher />
    </div>
  );
}

// ─── Shell ───────────────────────────────────────────────────────────────────

export function AppShell({ role, eyebrow, title, subtitle, user, signOutSlot, children }: AppShellProps) {
  const pathname = usePathname();
  const navigation =
    role === "admin"
      ? adminNavigation
      : role === "member"
        ? memberNavigation
        : prospectNavigation;

  const isItemActive = (item: NavigationItem) =>
    pathname === item.href ||
    (!item.exact && item.href !== "/" && pathname.startsWith(item.href + "/"));

  // Bottom bars hold 5 slots max: 4 primary destinations + "More" for the rest.
  const primaryItems = navigation.filter((item) => item.mobilePrimary);
  const useOverflow = navigation.length > 5 && primaryItems.length > 0;
  const bottomItems = useOverflow ? primaryItems : navigation;
  const overflowItems = useOverflow
    ? navigation.filter((item) => !item.mobilePrimary)
    : [];

  const [moreOpen, setMoreOpen] = useState(false);
  useEffect(() => {
    setMoreOpen(false);
  }, [pathname]);

  return (
    <div className="min-h-dvh bg-background text-foreground lg:bg-[#dce3ee] dark:lg:bg-[#0a1220]">
      <div className="flex min-h-dvh w-full lg:items-stretch">
        {/* Desktop sidebar */}
        <aside className="hidden w-[240px] shrink-0 flex-col border-r border-sidebar-border bg-sidebar lg:sticky lg:top-0 lg:flex lg:h-dvh">
          <div className="p-4 pb-3">
            <BrandBlock />
          </div>
          <nav className="flex-1 overflow-y-auto px-3 py-2" aria-label={`${role} navigation`}>
            <div className="grid gap-0.5">
              {navigation.map((item, index) => (
                <Fragment key={`${item.href}-${item.label}`}>
                  {item.section && item.section !== navigation[index - 1]?.section ? (
                    <div className="mt-3 px-3 pb-1 text-[10px] font-bold uppercase tracking-widest text-muted-foreground">
                      {item.section}
                    </div>
                  ) : null}
                  <NavLink
                    href={item.href}
                    icon={item.icon}
                    isActive={isItemActive(item)}
                    label={item.label}
                  />
                </Fragment>
              ))}
            </div>
          </nav>
          {user ? <SidebarUserBlock user={user} signOutSlot={signOutSlot} /> : null}
        </aside>

        {/* Content */}
        <div className="flex min-h-dvh w-full min-w-0 flex-col overflow-x-hidden bg-background lg:flex-1">
          {/* Mobile header */}
          <header className="bg-linear-to-br from-brand to-brand-dark px-4 pb-4 pt-[calc(1rem+env(safe-area-inset-top))] text-white lg:hidden">
            <div className="flex items-center gap-3">
              <GemaWordmark height={20} color="#ffffff" />
              <div className="min-w-0 flex-1">
                <div className="font-heading text-[10px] font-bold uppercase tracking-widest text-blue-200">
                  {eyebrow}
                </div>
                <div className="font-heading truncate text-base font-extrabold leading-tight tracking-tight">
                  {title}
                </div>
              </div>
              <MobileThemeToggle />
              {user ? (
                <>
                  <div
                    className="flex size-9 shrink-0 items-center justify-center rounded-full border-2 border-white/30 text-[11px] font-black text-white"
                    style={{ backgroundColor: avatarBg(user.name) }}
                    aria-hidden="true"
                  >
                    {initials(user.name)}
                  </div>
                  <MobileSignOutButton />
                </>
              ) : null}
            </div>
          </header>

          <main className="flex-1 px-4 py-5 pb-28 lg:px-8 lg:py-8">
            <div className="w-full">
              {/* Desktop page header */}
              <div className="mb-6 hidden lg:block">
                <div className="font-heading text-[10px] font-bold uppercase tracking-widest text-muted-foreground">
                  {eyebrow}
                </div>
                <h1 className="font-heading mt-1 text-2xl font-extrabold tracking-tight">
                  {title}
                </h1>
                <p className="mt-1.5 max-w-2xl text-sm leading-6 text-muted-foreground">
                  {subtitle}
                </p>
              </div>
              {children}
            </div>
          </main>

          {/* Mobile bottom nav */}
          {moreOpen ? (
            <div
              className="fixed inset-0 z-10 bg-black/30 lg:hidden"
              onClick={() => setMoreOpen(false)}
              aria-hidden="true"
            />
          ) : null}
          <nav
            className="fixed inset-x-0 bottom-0 z-20 border-t border-border bg-white/96 px-1.5 pb-[calc(0.375rem+env(safe-area-inset-bottom))] pt-1.5 shadow-[0_-6px_20px_rgb(14_34_73/8%)] backdrop-blur-md dark:bg-sidebar/95 lg:hidden"
            aria-label={`${role} bottom navigation`}
          >
            {moreOpen ? (
              <div className="mb-1.5 grid grid-cols-4 gap-0.5 border-b border-border/70 pb-1.5">
                {overflowItems.map((item) => (
                  <BottomNavLink
                    href={item.href}
                    icon={item.icon}
                    isActive={isItemActive(item)}
                    key={`${item.href}-${item.label}`}
                    label={item.label}
                  />
                ))}
              </div>
            ) : null}
            <div
              className="grid gap-0.5"
              style={{
                gridTemplateColumns: `repeat(${bottomItems.length + (useOverflow ? 1 : 0)}, minmax(0, 1fr))`,
              }}
            >
              {bottomItems.map((item) => (
                <BottomNavLink
                  href={item.href}
                  icon={item.icon}
                  isActive={isItemActive(item)}
                  key={`${item.href}-${item.label}`}
                  label={item.label}
                />
              ))}
              {useOverflow ? (
                <button
                  type="button"
                  onClick={() => setMoreOpen((v) => !v)}
                  aria-expanded={moreOpen}
                  className={cn(
                    "font-heading flex h-[52px] flex-col items-center justify-center gap-0.5 rounded-xl text-[10px] font-bold text-muted-foreground transition-colors",
                    (moreOpen || overflowItems.some(isItemActive)) &&
                      "bg-secondary text-brand",
                  )}
                >
                  <MoreHorizontal className="size-[18px]" aria-hidden="true" />
                  <span>More</span>
                </button>
              ) : null}
            </div>
          </nav>
        </div>
      </div>
    </div>
  );
}

function BrandBlock() {
  return (
    <div className="border-b border-sidebar-border pb-3">
      <GemaWordmark height={22} color="var(--sidebar-foreground)" />
      <div className="mt-1.5 text-[11px] font-semibold text-muted-foreground">
        Event Management App
      </div>
    </div>
  );
}

function NavLink({
  href,
  label,
  icon: Icon,
  isActive,
}: NavigationItem & { isActive: boolean }) {
  return (
    <Link
      className={cn(
        "font-heading flex items-center gap-2.5 rounded-xl px-3 py-2.5 text-[13px] font-bold text-muted-foreground transition-colors hover:bg-sidebar-accent hover:text-sidebar-accent-foreground",
        isActive && "bg-sidebar-accent text-brand",
      )}
      href={href}
    >
      <LinkPendingIcon icon={Icon} className="size-[18px] shrink-0" />
      <span>{label}</span>
    </Link>
  );
}

function BottomNavLink({
  href,
  label,
  icon: Icon,
  isActive,
}: NavigationItem & { isActive: boolean }) {
  return (
    <Link
      className={cn(
        "font-heading flex h-[52px] flex-col items-center justify-center gap-0.5 rounded-xl text-[10px] font-bold text-muted-foreground transition-colors",
        isActive && "bg-secondary text-brand",
      )}
      href={href}
    >
      <LinkPendingIcon icon={Icon} className="size-[18px]" />
      <span className="max-w-full truncate">{label}</span>
    </Link>
  );
}

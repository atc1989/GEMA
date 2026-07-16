import type { LucideIcon } from "lucide-react";
import {
  Bell,
  CalendarCheck,
  CalendarDays,
  Coins,
  Gift,
  HeartPulse,
  Home,
  IdCard,
  LayoutDashboard,
  MessageCircle,
  Pill,
  PlayCircle,
  Settings,
  Ticket,
  ToggleLeft,
  User,
  Users,
} from "lucide-react";

export type NavigationItem = {
  href: string;
  label: string;
  icon: LucideIcon;
  exact?: boolean;
  /** Shown directly on the mobile bottom bar; unmarked items go under "More". */
  mobilePrimary?: boolean;
  /** Groups consecutive items under a labeled heading in the desktop sidebar. */
  section?: string;
};

export const prospectNavigation: NavigationItem[] = [
  { href: "/discover", label: "Discover", icon: PlayCircle, exact: true },
  { href: "/invite", label: "Events", icon: CalendarDays, exact: true },
  { href: "/rewards", label: "Rewards", icon: Gift, exact: true },
  { href: "/passes", label: "Passes", icon: Ticket, exact: true },
];

const GUTGUARD_SECTION = "GutGuard Daily";

export const memberNavigation: NavigationItem[] = [
  { href: "/dashboard", label: "Home", icon: Home, exact: true, mobilePrimary: true },
  { href: "/member/profile", label: "Profile", icon: User, exact: true },
  { href: "/member/events", label: "Events", icon: CalendarDays, mobilePrimary: true },
  { href: "/member/calendar", label: "Calendar", icon: CalendarCheck },
  { href: "/member/referrals", label: "Referrals", icon: Gift },
  { href: "/member/prospects", label: "Prospects", icon: Users, mobilePrimary: true },
  { href: "/member/earnings", label: "Earnings", icon: Coins, mobilePrimary: true },
  { href: "/gutguard-daily", label: "GutGuard", icon: HeartPulse, exact: true, section: GUTGUARD_SECTION },
  { href: "/gutguard-daily/tracker", label: "Tracker", icon: Pill, section: GUTGUARD_SECTION },
  { href: "/gutguard-daily/reminders", label: "Reminders", icon: Bell, section: GUTGUARD_SECTION },
  { href: "/gutguard-daily/journey", label: "Journey", icon: MessageCircle, section: GUTGUARD_SECTION },
  { href: "/gutguard-daily/community", label: "Community", icon: Users, section: GUTGUARD_SECTION },
];

export const adminNavigation: NavigationItem[] = [
  { href: "/admin", label: "Overview", icon: LayoutDashboard, exact: true, mobilePrimary: true },
  { href: "/admin/gutguard", label: "GutGuard", icon: HeartPulse },
  { href: "/admin/events", label: "Events", icon: CalendarDays, mobilePrimary: true },
  { href: "/admin/prospects", label: "Prospects", icon: Users, mobilePrimary: true },
  { href: "/admin/commissions", label: "Commissions", icon: Coins },
  { href: "/admin/members", label: "Members", icon: IdCard, exact: true, mobilePrimary: true },
  { href: "/admin/members/event-permissions", label: "Event Permissions", icon: ToggleLeft },
];

export const rootNavigation: NavigationItem[] = [
  { href: "/", label: "Start", icon: LayoutDashboard },
  { href: "/invite", label: "Public", icon: PlayCircle },
  { href: "/dashboard", label: "Member", icon: User },
  { href: "/admin", label: "Admin", icon: Settings },
];

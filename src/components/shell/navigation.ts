import type { LucideIcon } from "lucide-react";
import {
  CalendarCheck,
  CalendarDays,
  Coins,
  Gift,
  HeartPulse,
  Home,
  IdCard,
  LayoutDashboard,
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
};

export const prospectNavigation: NavigationItem[] = [
  { href: "/discover", label: "Discover", icon: PlayCircle, exact: true },
  { href: "/invite", label: "Events", icon: CalendarDays, exact: true },
  { href: "/rewards", label: "Rewards", icon: Gift, exact: true },
  { href: "/passes", label: "Passes", icon: Ticket, exact: true },
];

export const memberNavigation: NavigationItem[] = [
  { href: "/dashboard", label: "Home", icon: Home, exact: true },
  { href: "/gutguard-daily", label: "GutGuard", icon: HeartPulse },
  { href: "/member/profile", label: "Profile", icon: User, exact: true },
  { href: "/member/events", label: "Events", icon: CalendarDays },
  { href: "/member/calendar", label: "Calendar", icon: CalendarCheck },
  { href: "/member/referrals", label: "Referrals", icon: Gift },
  { href: "/member/prospects", label: "Prospects", icon: Users },
  { href: "/member/earnings", label: "Earnings", icon: Coins },
];

export const adminNavigation: NavigationItem[] = [
  { href: "/admin", label: "Overview", icon: LayoutDashboard, exact: true },
  { href: "/admin/gutguard", label: "GutGuard", icon: HeartPulse },
  { href: "/admin/events", label: "Events", icon: CalendarDays },
  { href: "/admin/prospects", label: "Prospects", icon: Users },
  { href: "/admin/commissions", label: "Commissions", icon: Coins },
  { href: "/admin/members", label: "Members", icon: IdCard, exact: true },
  { href: "/admin/members/event-permissions", label: "Event Permissions", icon: ToggleLeft },
];

export const rootNavigation: NavigationItem[] = [
  { href: "/", label: "Start", icon: LayoutDashboard },
  { href: "/invite", label: "Public", icon: PlayCircle },
  { href: "/dashboard", label: "Member", icon: User },
  { href: "/admin", label: "Admin", icon: Settings },
];

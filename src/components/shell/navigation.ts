import type { LucideIcon } from "lucide-react";
import {
  CalendarDays,
  Coins,
  Gift,
  Home,
  IdCard,
  LayoutDashboard,
  PlayCircle,
  Settings,
  Ticket,
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
  { href: "/member/events", label: "Events", icon: CalendarDays },
  { href: "/member/referrals", label: "Referrals", icon: Gift },
  { href: "/member/prospects", label: "Prospects", icon: Users },
  { href: "/member/earnings", label: "Earnings", icon: Coins },
  { href: "/member/settings", label: "Settings", icon: Settings },
];

export const adminNavigation: NavigationItem[] = [
  { href: "/admin", label: "Overview", icon: LayoutDashboard, exact: true },
  { href: "/admin/events", label: "Events", icon: CalendarDays },
  { href: "/admin/prospects", label: "Prospects", icon: Users },
  { href: "/admin/commissions", label: "Commissions", icon: Coins },
  { href: "/admin/members", label: "Members", icon: IdCard },
];

export const rootNavigation: NavigationItem[] = [
  { href: "/", label: "Start", icon: LayoutDashboard },
  { href: "/invite", label: "Public", icon: PlayCircle },
  { href: "/dashboard", label: "Member", icon: User },
  { href: "/admin", label: "Admin", icon: Settings },
];

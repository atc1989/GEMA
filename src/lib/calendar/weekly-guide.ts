import type { LucideIcon } from "lucide-react";
import { BookOpen, Mic, Sparkles } from "lucide-react";

/**
 * Static weekly activity schedule, ported from the prototype's WEEKGUIDE.
 * Indexed Sunday (0) → Saturday (6). `colorClass` uses theme tokens.
 */
export type WeekDayGuide = {
  label: string;
  time: string;
  short: string;
  icon: LucideIcon;
  colorClass: string;
};

export const WEEK_GUIDE: WeekDayGuide[] = [
  { label: "Rest & Plan", time: "Plan your week ahead", short: "Rest", icon: Sparkles, colorClass: "text-muted-foreground" },
  { label: "Product / Business Presentation", time: "9:00 AM – 4:00 PM", short: "Present", icon: Mic, colorClass: "text-info" },
  { label: "Product / Business Presentation", time: "9:00 AM – 4:00 PM", short: "Present", icon: Mic, colorClass: "text-info" },
  { label: "Training", time: "After 4:00 PM", short: "Train", icon: BookOpen, colorClass: "text-success" },
  { label: "Product / Business Presentation", time: "9:00 AM – 4:00 PM", short: "Present", icon: Mic, colorClass: "text-info" },
  { label: "Product / Business Presentation", time: "9:00 AM – 4:00 PM", short: "Present", icon: Mic, colorClass: "text-info" },
  { label: "Special Events", time: "After 4:00 PM", short: "Special", icon: Sparkles, colorClass: "text-gold-dark" },
];

export type ScheduleBlock = {
  when: string;
  what: string;
  /** Border accent color (inline style value via a theme token). */
  accent: string;
};

export const SCHEDULE_BLOCKS: ScheduleBlock[] = [
  {
    when: "Monday – Saturday · 9:00 AM – 4:00 PM",
    what: "Product & Business Presentations",
    accent: "var(--info)",
  },
  {
    when: "Wednesdays · 4:00 PM onwards",
    what: "Training — BASE Activation, NDO, Rank modules, and more",
    accent: "var(--success)",
  },
  {
    when: "Saturdays · 4:00 PM onwards",
    what: "Special Events — Recognition, Testimonial sharing, Core Leaders meeting, fellowship",
    accent: "var(--gold-dark)",
  },
];

export const WEEKDAY_LETTERS = ["S", "M", "T", "W", "T", "F", "S"];
export const WEEKDAY_NAMES = [
  "Sunday",
  "Monday",
  "Tuesday",
  "Wednesday",
  "Thursday",
  "Friday",
  "Saturday",
];

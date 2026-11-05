import { addDays } from "@/lib/domain/study";

const fmt = new Intl.DateTimeFormat("en-US", { weekday: "short", month: "short", day: "numeric", timeZone: "UTC" });
const short = new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric", timeZone: "UTC" });

/** "Today", "Yesterday", or "Wed, Nov 4" for a YYYY-MM-DD day. */
export function dayLabel(date: string, today: string): string {
  if (date === today) return "Today";
  if (date === addDays(today, -1)) return "Yesterday";
  return fmt.format(new Date(`${date}T00:00:00Z`));
}

export function shortDate(date: string): string {
  return short.format(new Date(`${date}T00:00:00Z`));
}

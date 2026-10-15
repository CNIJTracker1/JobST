import { Link } from "react-router-dom";
import { cn } from "@/lib/utils";

/** Simple CareerNiche mark — replace with the official logo asset. */
export function LogoMark({ className, dark }) {
  return (
    <svg viewBox="0 0 40 40" className={cn("h-9 w-9", className)} aria-hidden>
      <rect width="40" height="40" rx="11" fill="#76BC21" />
      <path d="M12.5 21.5a7.5 7.5 0 1 0 7.5-7.5" stroke={dark ? "#fff" : "#121212"} strokeWidth="3.6" fill="none" strokeLinecap="round" />
      <circle cx="27.5" cy="13.5" r="3.1" fill={dark ? "#fff" : "#121212"} />
    </svg>
  );
}

export default function Logo({ to = "/", className, light, sub }) {
  return (
    <Link to={to} className={cn("flex items-center gap-2.5 rounded-xl focus-visible:ring-2 focus-visible:ring-primary/50", className)} aria-label="CareerNiche home">
      <LogoMark />
      <span className="leading-tight">
        <span className={cn("block font-extrabold text-[1.05rem] tracking-tight", light ? "text-white" : "text-ink")}>
          Career<span className="text-brand">Niche</span>
        </span>
        {sub && <span className={cn("block text-[11px] font-semibold", light ? "text-white/60" : "text-ink-muted")}>{sub}</span>}
      </span>
    </Link>
  );
}

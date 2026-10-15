import { Star, Loader2 } from "lucide-react";
import { cn, initials } from "@/lib/utils";

export const Badge = ({ className, style, children }) => (
  <span className={cn("inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-semibold", className)} style={style}>{children}</span>
);

export const Spinner = ({ className }) => <Loader2 className={cn("h-6 w-6 animate-spin text-primary", className)} aria-label="Loading" />;

export const PageLoader = () => (
  <div className="flex min-h-[40vh] items-center justify-center"><Spinner className="h-8 w-8" /></div>
);

export const Skeleton = ({ className }) => <div className={cn("animate-pulse rounded-xl bg-surface-2", className)} />;

export function Progress({ value = 0, max = 100, className, barClass }) {
  const pct = Math.max(0, Math.min(100, max ? (value / max) * 100 : 0));
  return (
    <div className={cn("h-2 w-full overflow-hidden rounded-full bg-surface-2", className)} role="progressbar" aria-valuenow={Math.round(pct)} aria-valuemin={0} aria-valuemax={100}>
      <div className={cn("h-full rounded-full bg-primary transition-[width] duration-700", barClass)} style={{ width: `${pct}%` }} />
    </div>
  );
}

export function Ring({ value = 0, max = 1, size = 56, stroke = 6, children, color }) {
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  const pct = Math.max(0, Math.min(1, max ? value / max : 0));
  return (
    <div className="relative inline-flex items-center justify-center" style={{ width: size, height: size }}>
      <svg width={size} height={size} className="-rotate-90" aria-hidden>
        <circle cx={size / 2} cy={size / 2} r={r} strokeWidth={stroke} className="stroke-line" fill="none" />
        <circle cx={size / 2} cy={size / 2} r={r} strokeWidth={stroke} fill="none" strokeLinecap="round"
          stroke={color || "rgb(var(--primary))"} strokeDasharray={c} strokeDashoffset={c * (1 - pct)} style={{ transition: "stroke-dashoffset .8s ease" }} />
      </svg>
      <div className="absolute inset-0 flex items-center justify-center text-xs font-bold">{children}</div>
    </div>
  );
}

export function Stars({ value = 0, onChange, size = "h-4 w-4", label = "Priority" }) {
  return (
    <div className="flex items-center gap-0.5" role={onChange ? "radiogroup" : undefined} aria-label={label}>
      {[1, 2, 3, 4, 5].map((n) => {
        const on = n <= (value || 0);
        const icon = <Star className={cn(size, on ? "fill-amber-400 text-amber-400" : "text-ink-faint")} />;
        return onChange ? (
          <button key={n} type="button" role="radio" aria-checked={n === value} aria-label={`${n} star${n > 1 ? "s" : ""}`}
            onClick={(e) => { e.stopPropagation(); onChange(n === value ? 0 : n); }}
            className="rounded p-0.5 hover:scale-110 transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/50">
            {icon}
          </button>
        ) : (
          <span key={n} aria-hidden>{icon}</span>
        );
      })}
    </div>
  );
}

const AVATAR_COLORS = ["#76BC21", "#4A8C8E", "#C49C48", "#6750A4", "#E85D04", "#0077B6", "#C2185B", "#2D6A4F"];
export function Avatar({ name, src, size = 40, className }) {
  const color = AVATAR_COLORS[[...(name || "?")].reduce((a, ch) => a + ch.charCodeAt(0), 0) % AVATAR_COLORS.length];
  return src ? (
    <img src={src} alt={name} className={cn("rounded-full object-cover shrink-0", className)} style={{ width: size, height: size }} />
  ) : (
    <div className={cn("rounded-full flex items-center justify-center font-bold text-white shrink-0", className)}
      style={{ width: size, height: size, background: color, fontSize: size * 0.38 }} aria-hidden>
      {initials(name)}
    </div>
  );
}

export function Switch({ checked, onChange, label, id }) {
  return (
    <button id={id} type="button" role="switch" aria-checked={checked} aria-label={label} onClick={() => onChange(!checked)}
      className={cn("relative inline-flex h-6 w-11 shrink-0 items-center rounded-full transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/50",
        checked ? "bg-primary" : "bg-line")}>
      <span className={cn("inline-block h-5 w-5 rounded-full bg-white shadow transition", checked ? "translate-x-5" : "translate-x-0.5")} />
    </button>
  );
}

export function Segmented({ options, value, onChange, className }) {
  return (
    <div className={cn("inline-flex max-w-full overflow-x-auto rounded-xl bg-surface-2 p-1 border border-line scrollbar-thin", className)} role="tablist">
      {options.map((o) => (
        <button key={o.value} role="tab" aria-selected={value === o.value} onClick={() => onChange(o.value)}
          className={cn("px-3.5 py-1.5 text-sm font-semibold rounded-lg transition whitespace-nowrap",
            value === o.value ? "bg-surface text-ink shadow-sm" : "text-ink-muted hover:text-ink")}>
          {o.label}
          {o.count != null && <span className="ml-1.5 text-xs text-ink-faint">{o.count}</span>}
        </button>
      ))}
    </div>
  );
}

export function EmptyState({ icon: Icon, title, message, action, className }) {
  return (
    <div className={cn("flex flex-col items-center text-center px-6 py-12", className)}>
      {Icon && (
        <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-3xl bg-primary-soft text-primary">
          <Icon className="h-8 w-8" />
        </div>
      )}
      <h3 className="text-base font-bold text-ink">{title}</h3>
      {message && <p className="mt-1 max-w-sm text-sm text-ink-muted">{message}</p>}
      {action && <div className="mt-5">{action}</div>}
    </div>
  );
}

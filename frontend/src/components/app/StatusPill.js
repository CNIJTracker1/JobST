import { STATUS_META } from "@/lib/constants";

export default function StatusPill({ status, className = "" }) {
  const m = STATUS_META[status] || STATUS_META.Archived;
  return (
    <span className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-bold ${className}`}
      style={{ color: m.color, background: `${m.color}1A` }}>
      <span className="h-1.5 w-1.5 rounded-full" style={{ background: m.color }} aria-hidden />
      {status}
    </span>
  );
}

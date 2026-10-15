import { useEffect, useRef, useState } from "react";
import { MoreHorizontal } from "lucide-react";
import { cn } from "@/lib/utils";

/** Small accessible dropdown menu. items: [{label, icon, onClick, danger, hidden}] | "divider" */
export default function Menu({ items, label = "More actions", className, align = "right" }) {
  const [open, setOpen] = useState(false);
  const ref = useRef(null);
  useEffect(() => {
    if (!open) return;
    const close = (e) => ref.current && !ref.current.contains(e.target) && setOpen(false);
    const esc = (e) => e.key === "Escape" && setOpen(false);
    document.addEventListener("mousedown", close);
    document.addEventListener("touchstart", close);
    document.addEventListener("keydown", esc);
    return () => {
      document.removeEventListener("mousedown", close);
      document.removeEventListener("touchstart", close);
      document.removeEventListener("keydown", esc);
    };
  }, [open]);
  return (
    <div ref={ref} className={cn("relative", className)} onPointerDown={(e) => e.stopPropagation()} onClick={(e) => e.stopPropagation()}>
      <button type="button" aria-label={label} aria-haspopup="menu" aria-expanded={open} onClick={() => setOpen((o) => !o)}
        className="flex h-8 w-8 items-center justify-center rounded-lg text-ink-muted hover:bg-surface-2 hover:text-ink focus-visible:ring-2 focus-visible:ring-primary/50">
        <MoreHorizontal className="h-4 w-4" />
      </button>
      {open && (
        <div role="menu" className={cn("absolute z-40 mt-1 w-52 rounded-xl border border-line bg-surface p-1.5 shadow-lift animate-fade-up", align === "right" ? "right-0" : "left-0")}>
          {items.filter(Boolean).filter((i) => !i.hidden).map((it, idx) =>
            it === "divider" ? (
              <div key={idx} className="my-1 h-px bg-line" />
            ) : (
              <button key={it.label} role="menuitem" type="button"
                onClick={() => { setOpen(false); it.onClick(); }}
                className={cn("flex w-full items-center gap-2.5 rounded-lg px-2.5 py-2 text-left text-sm font-medium",
                  it.danger ? "text-red-600 hover:bg-red-50 dark:hover:bg-red-500/10" : "text-ink hover:bg-surface-2")}>
                {it.icon && <it.icon className="h-4 w-4 shrink-0" />} {it.label}
              </button>
            )
          )}
        </div>
      )}
    </div>
  );
}

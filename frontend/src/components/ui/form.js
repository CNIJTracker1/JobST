import { forwardRef, useId } from "react";
import { cn } from "@/lib/utils";

const base =
  "w-full rounded-xl border border-line bg-surface px-3.5 text-sm text-ink placeholder:text-ink-faint transition " +
  "focus:outline-none focus:ring-2 focus:ring-primary/40 focus:border-primary disabled:opacity-60";

export const Input = forwardRef(({ className, ...p }, ref) => <input ref={ref} className={cn(base, "h-11", className)} {...p} />);
export const Textarea = forwardRef(({ className, ...p }, ref) => <textarea ref={ref} className={cn(base, "py-2.5 min-h-[96px]", className)} {...p} />);
export const Select = forwardRef(({ className, children, ...p }, ref) => (
  <select ref={ref} className={cn(base, "h-11 pr-8 appearance-none bg-no-repeat bg-[right_.75rem_center] bg-[length:16px]", className)}
    style={{ backgroundImage: "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='none' stroke='%23888' stroke-width='2'%3E%3Cpath d='m6 9 6 6 6-6'/%3E%3C/svg%3E\")" }}
    {...p}>
    {children}
  </select>
));

export const Label = ({ className, ...p }) => <label className={cn("block text-sm font-semibold text-ink mb-1.5", className)} {...p} />;

/** Label + control + hint/error, with ids wired for accessibility. */
export function Field({ label, hint, error, children, className, required }) {
  const id = useId();
  const child = typeof children === "function" ? children(id) : children;
  return (
    <div className={className}>
      {label && (
        <Label htmlFor={id}>
          {label} {required && <span className="text-red-500" aria-hidden>*</span>}
        </Label>
      )}
      {typeof children === "function" ? child : <div id={id}>{child}</div>}
      {error ? <p className="mt-1 text-xs text-red-600" role="alert">{error}</p> : hint ? <p className="mt-1 text-xs text-ink-muted">{hint}</p> : null}
    </div>
  );
}

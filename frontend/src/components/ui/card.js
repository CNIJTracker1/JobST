import { cn } from "@/lib/utils";

export const Card = ({ className, ...p }) => <div className={cn("rounded-2xl border border-line bg-surface shadow-soft", className)} {...p} />;
export const CardHeader = ({ className, ...p }) => <div className={cn("flex items-start justify-between gap-3 px-5 pt-5", className)} {...p} />;
export const CardTitle = ({ className, children, ...p }) => <h3 className={cn("font-bold text-ink text-base", className)} {...p}>{children}</h3>;
export const CardBody = ({ className, ...p }) => <div className={cn("p-5", className)} {...p} />;

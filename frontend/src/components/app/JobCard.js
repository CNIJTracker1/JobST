import { Link } from "react-router-dom";
import { Archive, ArrowRightLeft, CheckCircle2, Clock, Edit3, ExternalLink, MapPin, RotateCcw, Trash2, XCircle, Zap } from "lucide-react";
import { PIPELINE, STATUS_META } from "@/lib/constants";
import { cn, money, timeAgo } from "@/lib/utils";
import { Badge, Stars } from "@/components/ui";
import Menu from "./Menu";

/** Kanban/list card (port of jobcard.dart + cardcontroller.dart actions). */
export default function JobCard({ job, actions, dragging, compact }) {
  const meta = STATUS_META[job.status] || STATUS_META.Archived;
  const cooldown = job.follow_up_available_at && new Date(job.follow_up_available_at) > new Date();
  const inPipeline = PIPELINE.includes(job.status);
  const items = [
    { label: "Edit details", icon: Edit3, onClick: () => actions.edit(job), hidden: job.status === "Deleted" },
    { label: cooldown ? "Followed up today" : "Record follow-up", icon: Zap, onClick: () => actions.followUp(job), hidden: !["Applied", "Interviewed", "Offered"].includes(job.status) || cooldown },
    { label: "Accept offer", icon: CheckCircle2, onClick: () => actions.offer(job, "accept"), hidden: job.status !== "Offered" },
    { label: "Decline offer", icon: XCircle, onClick: () => actions.offer(job, "decline"), hidden: job.status !== "Offered" },
    { label: "Move to…", icon: ArrowRightLeft, onClick: () => actions.move(job), hidden: job.status === "Deleted" },
    { label: "Archive", icon: Archive, onClick: () => actions.setStatus(job, "Archived"), hidden: !inPipeline },
    { label: "Restore", icon: RotateCcw, onClick: () => actions.restore(job), hidden: job.status !== "Deleted" },
    "divider",
    { label: job.status === "Deleted" ? "Delete forever" : "Move to bin", icon: Trash2, danger: true, onClick: () => actions.remove(job) },
  ];
  return (
    <article
      className={cn(
        "group relative rounded-2xl border border-line bg-surface p-3.5 shadow-soft transition",
        dragging ? "rotate-[1.5deg] scale-[1.02] shadow-lift ring-2 ring-primary/40" : "hover:shadow-lift hover:-translate-y-0.5"
      )}
      style={{ borderLeft: `4px solid ${meta.color}` }}
    >
      <div className="flex items-start justify-between gap-2">
        <Link to={`/app/jobs/${job.id}`} className="min-w-0 flex-1 rounded focus-visible:ring-2 focus-visible:ring-primary/50" onPointerDown={(e) => e.stopPropagation()}>
          <h3 className="line-clamp-2 font-bold leading-snug text-ink">{job.job_name}</h3>
          <p className="truncate text-sm text-ink-muted">{job.company_name}</p>
        </Link>
        <Menu items={items} label={`Actions for ${job.job_name}`} />
      </div>
      {!compact && (
        <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-ink-muted">
          {job.job_pay ? <span className="font-semibold text-ink">{money(job.job_pay)}</span> : null}
          {job.location ? <span className="flex items-center gap-1"><MapPin className="h-3 w-3" />{job.location}</span> : null}
        </div>
      )}
      <div className="mt-3 flex flex-wrap items-center justify-between gap-x-2 gap-y-1">
        <div onPointerDown={(e) => e.stopPropagation()}>
          <Stars value={job.priority_score} onChange={actions.rate ? (v) => actions.rate(job, v) : undefined} size="h-3.5 w-3.5" />
        </div>
        <div className="flex items-center gap-2">
          {job.status === "Archived" && job.complete === true && <Badge className="bg-green-100 text-green-700 dark:bg-green-500/15 dark:text-green-300">Accepted</Badge>}
          {job.status === "Archived" && job.complete === false && <Badge className="bg-red-100 text-red-700 dark:bg-red-500/15 dark:text-red-300">Declined</Badge>}
          <span className="flex items-center gap-1 whitespace-nowrap text-[11px] text-ink-faint"><Clock className="hidden h-3 w-3 sm:block" />{timeAgo(job.updated_at)}</span>
          {job.job_link && (
            <a href={job.job_link} target="_blank" rel="noreferrer" onPointerDown={(e) => e.stopPropagation()} className="text-ink-faint hover:text-primary" aria-label="Open job posting">
              <ExternalLink className="h-3.5 w-3.5" />
            </a>
          )}
        </div>
      </div>
    </article>
  );
}

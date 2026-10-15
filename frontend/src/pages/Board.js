import { useEffect, useMemo, useRef, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { toast } from "sonner";
import { DndContext, DragOverlay, KeyboardSensor, PointerSensor, TouchSensor, useDraggable, useDroppable, useSensor, useSensors } from "@dnd-kit/core";
import { Archive, Inbox, Plus, Search, Trash2 } from "lucide-react";
import { api, errorMessage } from "@/lib/api";
import { PIPELINE, STATUS_META } from "@/lib/constants";
import { cn } from "@/lib/utils";
import { Button, EmptyState, Input, Segmented, Select, Skeleton } from "@/components/ui";
import { PageHeader } from "@/components/app/AppShell";
import { useShell } from "@/components/app/ShellContext";
import JobCard from "@/components/app/JobCard";
import JobActionDialogs from "@/components/app/JobActionDialogs";
import { useJobActions } from "@/components/app/useJobActions";

function DraggableCard({ job, actions }) {
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({ id: job.id, data: { job } });
  return (
    <div ref={setNodeRef} {...listeners} {...attributes} className={cn("touch-manipulation cursor-grab active:cursor-grabbing", isDragging && "opacity-30")}
      aria-roledescription="Draggable job card" aria-label={`${job.job_name} at ${job.company_name}. Press space to pick up.`}>
      <JobCard job={job} actions={actions} />
    </div>
  );
}

function Column({ status, jobs, actions, onAdd, highlight }) {
  const { setNodeRef, isOver } = useDroppable({ id: status });
  const meta = STATUS_META[status];
  return (
    <section id={`col-${status}`} aria-label={`${status} column`}
      className={cn("flex w-[85vw] max-w-[20rem] shrink-0 snap-start flex-col rounded-3xl p-2.5 transition sm:w-72 xl:w-0 xl:min-w-0 xl:max-w-none xl:flex-1 xl:shrink",
        highlight && "ring-2 ring-primary/50")}
      style={{ background: isOver ? `${meta.color}22` : `${meta.color}0D` }}>
      <header className="flex items-center justify-between px-2 pb-2.5 pt-1">
        <h2 className="flex items-center gap-2 text-sm font-extrabold" style={{ color: meta.color }}>
          <span className="h-2 w-2 rounded-full" style={{ background: meta.color }} /> {status}
          <span className="rounded-full bg-surface px-2 py-0.5 text-xs text-ink-muted">{jobs.length}</span>
        </h2>
        <button onClick={() => onAdd(status)} className="rounded-lg p-1.5 text-ink-muted hover:bg-surface hover:text-ink" aria-label={`Add job to ${status}`}>
          <Plus className="h-4 w-4" />
        </button>
      </header>
      <div ref={setNodeRef} className="flex min-h-[8rem] flex-1 flex-col gap-2.5">
        {jobs.map((j) => <DraggableCard key={j.id} job={j} actions={actions} />)}
        {!jobs.length && (
          <div className={cn("flex flex-1 items-center justify-center rounded-2xl border-2 border-dashed p-6 text-center text-xs font-semibold transition",
            isOver ? "border-current" : "border-line text-ink-faint")} style={isOver ? { color: meta.color } : undefined}>
            Drop a job here
          </div>
        )}
      </div>
    </section>
  );
}

export default function Board() {
  const { refreshKey, openJobForm, handleRewards } = useShell();
  const [params] = useSearchParams();
  const focus = params.get("focus");
  const [view, setView] = useState(focus === "Archived" || focus === "Deleted" ? focus : "Active");
  const [jobs, setJobs] = useState(null);
  const [query, setQuery] = useState("");
  const [sort, setSort] = useState("recent");
  const [activeJob, setActiveJob] = useState(null);
  const scroller = useRef(null);

  const load = async () => {
    const { data } = await api.get("/jobs?include_deleted=true");
    setJobs(data);
  };
  useEffect(() => { load(); }, [refreshKey]); // eslint-disable-line react-hooks/exhaustive-deps

  const { actions, ...dialogs } = useJobActions();

  useEffect(() => {
    if (focus && PIPELINE.includes(focus) && jobs) document.getElementById(`col-${focus}`)?.scrollIntoView({ behavior: "smooth", inline: "start", block: "nearest" });
  }, [focus, jobs]);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 220, tolerance: 8 } }),
    useSensor(KeyboardSensor)
  );

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    let list = (jobs || []).filter((j) => !q || `${j.job_name} ${j.company_name} ${j.location || ""}`.toLowerCase().includes(q));
    const sorters = {
      recent: (a, b) => new Date(b.updated_at) - new Date(a.updated_at),
      priority: (a, b) => (b.priority_score || 0) - (a.priority_score || 0),
      pay: (a, b) => (b.job_pay || 0) - (a.job_pay || 0),
      company: (a, b) => a.company_name.localeCompare(b.company_name),
    };
    return [...list].sort(sorters[sort]);
  }, [jobs, query, sort]);

  const byStatus = (s) => filtered.filter((j) => j.status === s);
  const counts = { Active: (jobs || []).filter((j) => PIPELINE.includes(j.status)).length, Archived: (jobs || []).filter((j) => j.status === "Archived").length, Deleted: (jobs || []).filter((j) => j.status === "Deleted").length };

  const onDragEnd = async ({ active, over }) => {
    setActiveJob(null);
    if (!over) return;
    const job = jobs.find((j) => j.id === active.id);
    const status = over.id;
    if (!job || job.status === status) return;
    const prev = jobs;
    setJobs((list) => list.map((j) => (j.id === job.id ? { ...j, status, updated_at: new Date().toISOString() } : j))); // optimistic
    try {
      const { data } = await api.post(`/jobs/${job.id}/status`, { status });
      setJobs((list) => list.map((j) => (j.id === job.id ? data.job : j)));
      handleRewards(data.rewards);
      if (!data.rewards?.actions?.length) toast.success(`Moved to ${status}`);
    } catch (err) {
      setJobs(prev);
      toast.error(errorMessage(err, "Couldn't move that job"));
    }
  };

  return (
    <div>
      <PageHeader
        title="Job board"
        subtitle="Drag cards as your applications move forward. Reaching a new stage earns progress."
        actions={<Button onClick={() => openJobForm()}><Plus className="h-4 w-4" /> Add job</Button>}
      />
      <div className="mb-5 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <Segmented value={view} onChange={setView} options={[{ value: "Active", label: "Pipeline", count: counts.Active }, { value: "Archived", label: "Archived", count: counts.Archived }, { value: "Deleted", label: "Bin", count: counts.Deleted }]} />
        <div className="flex gap-2">
          <div className="relative flex-1 sm:w-64">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-faint" />
            <Input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search jobs or companies" className="h-10 pl-9" aria-label="Search jobs" />
          </div>
          <Select value={sort} onChange={(e) => setSort(e.target.value)} className="h-10 w-36" aria-label="Sort jobs">
            <option value="recent">Recent</option>
            <option value="priority">Priority</option>
            <option value="pay">Pay</option>
            <option value="company">Company</option>
          </Select>
        </div>
      </div>

      {!jobs ? (
        <div className="flex gap-4 overflow-hidden">{PIPELINE.map((s) => <Skeleton key={s} className="h-80 w-72 shrink-0 xl:w-0 xl:flex-1" />)}</div>
      ) : view === "Active" ? (
        <DndContext sensors={sensors} onDragStart={({ active }) => setActiveJob(jobs.find((j) => j.id === active.id))} onDragCancel={() => setActiveJob(null)} onDragEnd={onDragEnd}>
          <div ref={scroller} className="-mx-4 flex snap-x snap-mandatory gap-3 overflow-x-auto px-4 pb-4 scrollbar-thin sm:-mx-6 sm:px-6 lg:snap-none xl:mx-0 xl:px-0">
            {PIPELINE.map((s) => <Column key={s} status={s} jobs={byStatus(s)} actions={actions} onAdd={(st) => openJobForm(null, st)} highlight={focus === s} />)}
          </div>
          <DragOverlay dropAnimation={{ duration: 180 }}>{activeJob ? <JobCard job={activeJob} actions={actions} dragging /> : null}</DragOverlay>
          <p className="mt-1 text-center text-xs text-ink-faint xl:hidden">Tip: press and hold a card to drag it, or use ••• → Move to…</p>
        </DndContext>
      ) : (
        <div>
          {view === "Deleted" && byStatus("Deleted").length > 0 && (
            <p className="mb-4 rounded-2xl bg-surface-2 p-3 text-sm text-ink-muted">Jobs in the bin can be restored to their previous stage or deleted forever.</p>
          )}
          {byStatus(view).length ? (
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">{byStatus(view).map((j) => <JobCard key={j.id} job={j} actions={actions} />)}</div>
          ) : (
            <EmptyState icon={view === "Archived" ? Archive : view === "Deleted" ? Trash2 : Inbox}
              title={view === "Archived" ? "Nothing archived yet" : "The bin is empty"}
              message={view === "Archived" ? "Concluded applications and accepted or declined offers land here." : "Deleted jobs wait here until you restore or remove them."} />
          )}
        </div>
      )}
      <JobActionDialogs {...dialogs} actions={actions} />
    </div>
  );
}

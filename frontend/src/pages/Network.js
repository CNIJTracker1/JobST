import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { toast } from "sonner";
import { Briefcase, CalendarClock, Coffee, Edit3, Linkedin, Mail, Phone, Plus, Search, Trash2, UserPlus, Users } from "lucide-react";
import { api, errorMessage } from "@/lib/api";
import { RELATIONSHIPS } from "@/lib/constants";
import { cn, fmtDate, relativeDay } from "@/lib/utils";
import { Avatar, Badge, Button, Card, ConfirmDialog, Dialog, EmptyState, Input, Progress, Segmented, Skeleton } from "@/components/ui";
import { PageHeader } from "@/components/app/AppShell";
import { useShell } from "@/components/app/ShellContext";
import Menu from "@/components/app/Menu";
import { ContactFormDialog, TouchpointDialog } from "@/components/app/ContactDialogs";

function ContactCard({ c, onTouch, onEdit, onDelete, onOpen }) {
  const next = c.next_touchpoint ? new Date(c.next_touchpoint) : null;
  const today = new Date(); today.setHours(0, 0, 0, 0);
  const overdue = next && next < today;
  const last = c.touchpoints?.length ? c.touchpoints[c.touchpoints.length - 1] : null;
  return (
    <Card className="group flex flex-col p-5 transition hover:-translate-y-0.5 hover:shadow-lift">
      <div className="flex items-start gap-3">
        <button onClick={onOpen} className="flex min-w-0 flex-1 items-start gap-3 text-left" aria-label={`Open ${c.contact_name}`}>
          <Avatar name={c.contact_name} size={48} />
          <div className="min-w-0">
            <p className="truncate font-bold">{c.contact_name}</p>
            <p className="truncate text-sm text-ink-muted">{[c.job_title, c.company].filter(Boolean).join(" · ") || "—"}</p>
            <Badge className="mt-1.5 bg-surface-2 text-ink-muted">{c.relationship}</Badge>
          </div>
        </button>
        <Menu items={[{ label: "Edit", icon: Edit3, onClick: onEdit }, "divider", { label: "Delete", icon: Trash2, danger: true, onClick: onDelete }]} label={`Actions for ${c.contact_name}`} />
      </div>
      {c.job && (
        <Link to={`/app/jobs/${c.job.id}`} className="mt-3 flex items-center gap-2 rounded-xl bg-surface-2 px-3 py-2 text-xs font-semibold hover:bg-line/60">
          <Briefcase className="h-3.5 w-3.5 text-primary" /><span className="truncate">{c.job.job_name} · {c.job.company_name}</span>
        </Link>
      )}
      <div className="mt-3 flex flex-1 items-end justify-between gap-2">
        <div className="text-xs">
          {next ? (
            <p className={cn("flex items-center gap-1 font-bold", overdue ? "text-red-600" : "text-primary")}><CalendarClock className="h-3.5 w-3.5" />{overdue ? `Overdue · ${fmtDate(c.next_touchpoint)}` : `Next: ${relativeDay(c.next_touchpoint)}`}</p>
          ) : (
            <p className="text-ink-faint">No touchpoint scheduled</p>
          )}
          <p className="mt-0.5 text-ink-muted">{last ? `Last: ${last.kind || "Touchpoint"} · ${fmtDate(last.date || last.created_at)}` : "No touchpoints yet"}</p>
        </div>
        <div className="flex gap-1">
          {c.email && <a href={`mailto:${c.email}`} className="rounded-lg p-2 text-ink-muted hover:bg-surface-2 hover:text-ink" aria-label={`Email ${c.contact_name}`}><Mail className="h-4 w-4" /></a>}
          {c.phone_number && <a href={`tel:${c.phone_number}`} className="rounded-lg p-2 text-ink-muted hover:bg-surface-2 hover:text-ink" aria-label={`Call ${c.contact_name}`}><Phone className="h-4 w-4" /></a>}
          {c.linkedin_url && <a href={c.linkedin_url} target="_blank" rel="noreferrer" className="rounded-lg p-2 text-ink-muted hover:bg-surface-2 hover:text-ink" aria-label="LinkedIn profile"><Linkedin className="h-4 w-4" /></a>}
          <Button size="sm" variant="secondary" onClick={onTouch}><Coffee className="h-4 w-4" /> Log</Button>
        </div>
      </div>
    </Card>
  );
}

export default function Network() {
  const { refreshKey, handleRewards } = useShell();
  const [contacts, setContacts] = useState(null);
  const [jobs, setJobs] = useState([]);
  const [goals, setGoals] = useState([]);
  const [q, setQ] = useState("");
  const [rel, setRel] = useState("All");
  const [form, setForm] = useState({ open: false, contact: null });
  const [touch, setTouch] = useState(null);
  const [del, setDel] = useState(null);
  const [detail, setDetail] = useState(null);

  const load = async () => {
    const [c, j, g] = await Promise.all([api.get("/contacts"), api.get("/jobs"), api.get("/goals")]);
    setContacts(c.data);
    setJobs(j.data);
    setGoals(g.data.filter((x) => x.action_type === "contacts"));
    setDetail((d) => (d ? c.data.find((x) => x.id === d.id) || null : null));
  };
  useEffect(() => { load(); }, [refreshKey]); // eslint-disable-line react-hooks/exhaustive-deps

  const filtered = useMemo(() => {
    const s = q.trim().toLowerCase();
    return (contacts || []).filter((c) => (rel === "All" || c.relationship === rel) && (!s || `${c.contact_name} ${c.company} ${c.job_title}`.toLowerCase().includes(s)));
  }, [contacts, q, rel]);

  const onSaved = (res) => {
    if (res?.rewards) handleRewards(res.rewards);
    load();
  };
  const remove = async () => {
    try {
      await api.delete(`/contacts/${del.id}`);
      toast.success("Contact removed");
      load();
    } catch (err) {
      toast.error(errorMessage(err));
    }
    setDel(null);
  };
  const removeTouch = async (tp) => {
    await api.delete(`/contacts/${detail.id}/touchpoints/${tp.id}`);
    load();
  };

  const weekly = goals.find((g) => g.goal_type === "weekly");
  const upcoming = (contacts || []).filter((c) => c.next_touchpoint && new Date(c.next_touchpoint) - Date.now() < 7 * 864e5).length;

  return (
    <div>
      <PageHeader eyebrow="The heart of CareerNiche" title="Your network" subtitle="Most jobs are found through people. Track every connection, coffee chat and informational interview."
        actions={<Button onClick={() => setForm({ open: true, contact: null })}><UserPlus className="h-4 w-4" /> Add contact</Button>} />

      <div className="mb-6 grid gap-4 sm:grid-cols-3">
        <Card className="p-5"><p className="text-sm font-semibold text-ink-muted">People in your network</p><p className="mt-1 text-3xl font-extrabold">{contacts?.length ?? "–"}</p></Card>
        <Card className="p-5"><p className="text-sm font-semibold text-ink-muted">Touchpoints due this week</p><p className="mt-1 text-3xl font-extrabold">{contacts ? upcoming : "–"}</p></Card>
        <Card className="p-5">
          <p className="text-sm font-semibold text-ink-muted">Weekly networking goal</p>
          {weekly ? (<><p className="mt-1 text-3xl font-extrabold">{weekly.current}<span className="text-lg text-ink-faint">/{weekly.target}</span></p><Progress className="mt-2" value={weekly.current} max={weekly.target} /></>) : <Link to="/app/growth" className="mt-2 inline-block text-sm link">Set a networking goal</Link>}
        </Card>
      </div>

      <div className="mb-5 flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <Segmented value={rel} onChange={setRel} className="overflow-x-auto max-w-full scrollbar-thin" options={["All", ...RELATIONSHIPS].map((r) => ({ value: r, label: r }))} />
        <div className="relative md:w-72">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-faint" />
          <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search people or companies" className="h-10 pl-9" aria-label="Search contacts" />
        </div>
      </div>

      {!contacts ? (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">{[1, 2, 3].map((i) => <Skeleton key={i} className="h-52" />)}</div>
      ) : filtered.length ? (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {filtered.map((c) => (
            <ContactCard key={c.id} c={c} onOpen={() => setDetail(c)} onTouch={() => setTouch(c)} onEdit={() => setForm({ open: true, contact: c })} onDelete={() => setDel(c)} />
          ))}
        </div>
      ) : (
        <EmptyState icon={Users} title={contacts.length ? "No matches" : "Start building your network"}
          message={contacts.length ? "Try a different search or filter." : "Add a recruiter, a former classmate or someone at a company you admire. Informational interviews open doors job boards can't."}
          action={!contacts.length && <Button onClick={() => setForm({ open: true, contact: null })}><Plus className="h-4 w-4" /> Add your first contact</Button>} />
      )}

      <ContactFormDialog open={form.open} contact={form.contact} jobs={jobs} onClose={() => setForm({ open: false, contact: null })} onSaved={onSaved} />
      <TouchpointDialog open={!!touch} contact={touch} onClose={() => setTouch(null)} onSaved={onSaved} />
      <ConfirmDialog open={!!del} onClose={() => setDel(null)} onConfirm={remove} danger confirmLabel="Delete" title="Remove contact?" message={`${del?.contact_name} and their touchpoint history will be deleted.`} />
      <Dialog open={!!detail} onClose={() => setDetail(null)} title={detail?.contact_name || ""} description={[detail?.job_title, detail?.company].filter(Boolean).join(" · ")} size="lg"
        footer={<><Button variant="outline" onClick={() => { setForm({ open: true, contact: detail }); setDetail(null); }}><Edit3 className="h-4 w-4" /> Edit</Button><Button onClick={() => setTouch(detail)}><Coffee className="h-4 w-4" /> Log touchpoint</Button></>}>
        {detail && (
          <div className="space-y-4 pb-2">
            {detail.description && <p className="whitespace-pre-wrap rounded-2xl bg-surface-2 p-4 text-sm">{detail.description}</p>}
            <h3 className="font-bold">Touchpoints</h3>
            {detail.touchpoints?.length ? (
              <ol className="space-y-3 border-l-2 border-line pl-5">
                {[...detail.touchpoints].reverse().map((tp) => (
                  <li key={tp.id} className="relative">
                    <span className="absolute -left-[27px] top-1 h-3.5 w-3.5 rounded-full border-2 border-surface bg-primary" aria-hidden />
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <p className="font-semibold">{tp.kind} · {tp.format}</p>
                        <p className="text-xs text-ink-muted">{fmtDate(tp.date || tp.created_at, { month: "short", day: "numeric", year: "numeric" })}</p>
                        {tp.notes && <p className="mt-1 text-sm">{tp.notes}</p>}
                      </div>
                      <Button size="icon" variant="ghost" aria-label="Delete touchpoint" onClick={() => removeTouch(tp)}><Trash2 className="h-4 w-4" /></Button>
                    </div>
                  </li>
                ))}
              </ol>
            ) : <p className="text-sm text-ink-muted">No touchpoints logged yet.</p>}
          </div>
        )}
      </Dialog>
    </div>
  );
}

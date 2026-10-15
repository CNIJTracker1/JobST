import { useCallback, useEffect, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { toast } from "sonner";
import {
  Archive, ArrowLeft, CalendarPlus, CheckCircle2, Coffee, Download, Edit3, ExternalLink, FileText, Link2, MapPin, MessageSquareText,
  Paperclip, Plus, Trash2, Upload, UserPlus, Wallet, XCircle, Zap, Target,
} from "lucide-react";
import { api, errorMessage } from "@/lib/api";
import { DOCUMENT_TYPES, INTERVIEW_TYPES, PIPELINE, STATUS_META } from "@/lib/constants";
import { cn, fmtDate, fmtDateTime, fromLocalInput, money, toLocalInput } from "@/lib/utils";
import { Avatar, Badge, Button, Card, ConfirmDialog, Dialog, EmptyState, Field, Input, PageLoader, Select, Stars, Textarea } from "@/components/ui";
import { useShell } from "@/components/app/ShellContext";
import StatusPill from "@/components/app/StatusPill";
import JobActionDialogs from "@/components/app/JobActionDialogs";
import { useJobActions } from "@/components/app/useJobActions";
import { ContactFormDialog, TouchpointDialog } from "@/components/app/ContactDialogs";

function Section({ title, icon: Icon, action, children }) {
  return (
    <Card className="p-5 sm:p-6">
      <div className="mb-4 flex items-center justify-between gap-3">
        <h2 className="flex items-center gap-2 text-lg font-bold"><Icon className="h-5 w-5 text-primary" />{title}</h2>
        {action}
      </div>
      {children}
    </Card>
  );
}

function Stepper({ job, onMove }) {
  const current = PIPELINE.indexOf(job.status);
  const highest = PIPELINE.indexOf(job.highest_status);
  return (
    <ol className="flex items-center gap-1.5 overflow-x-auto pb-1 scrollbar-thin" aria-label="Pipeline stage">
      {PIPELINE.map((s, i) => {
        const meta = STATUS_META[s];
        const isCurrent = i === current;
        const reached = i <= Math.max(highest, current);
        return (
          <li key={s} className="flex items-center gap-1.5">
            <button onClick={() => onMove(s)} disabled={isCurrent} aria-current={isCurrent ? "step" : undefined}
              className={cn("whitespace-nowrap rounded-full px-3 py-1.5 text-xs font-bold transition", isCurrent ? "text-white shadow-sm" : reached ? "hover:brightness-95" : "bg-surface-2 text-ink-muted hover:text-ink")}
              style={isCurrent ? { background: meta.color } : reached ? { background: `${meta.color}1F`, color: meta.color } : undefined}>
              {s}
            </button>
            {i < PIPELINE.length - 1 && <span className={cn("h-0.5 w-4 rounded", i < Math.max(highest, current) ? "bg-primary/60" : "bg-line")} aria-hidden />}
          </li>
        );
      })}
    </ol>
  );
}

function InterviewDialog({ open, onClose, jobId, interview, onSaved }) {
  const [form, setForm] = useState({ interview_type: "First round", interview_date: "", interview_notes: "" });
  const [saving, setSaving] = useState(false);
  useEffect(() => {
    if (open) setForm(interview ? { interview_type: interview.interview_type, interview_date: toLocalInput(interview.interview_date), interview_notes: interview.interview_notes || "" } : { interview_type: "First round", interview_date: "", interview_notes: "" });
  }, [open, interview]);
  const save = async () => {
    setSaving(true);
    const payload = { ...form, interview_date: fromLocalInput(form.interview_date) };
    try {
      const { data } = interview ? await api.patch(`/interviews/${interview.id}`, payload) : await api.post(`/jobs/${jobId}/interviews`, payload);
      onSaved(data);
      onClose();
    } catch (err) {
      toast.error(errorMessage(err));
    } finally {
      setSaving(false);
    }
  };
  return (
    <Dialog open={open} onClose={onClose} title={interview ? "Edit interview" : "Log an interview"} description={interview ? undefined : "Logging an interview counts toward your Interview goal."}
      footer={<><Button variant="outline" onClick={onClose}>Cancel</Button><Button onClick={save} loading={saving}>Save</Button></>}>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Round">{(id) => <Select id={id} value={form.interview_type} onChange={(e) => setForm({ ...form, interview_type: e.target.value })}>{INTERVIEW_TYPES.map((t) => <option key={t}>{t}</option>)}</Select>}</Field>
        <Field label="Date & time">{(id) => <Input id={id} type="datetime-local" value={form.interview_date} onChange={(e) => setForm({ ...form, interview_date: e.target.value })} />}</Field>
        <Field label="Prep notes / outcome" className="sm:col-span-2">{(id) => <Textarea id={id} value={form.interview_notes} onChange={(e) => setForm({ ...form, interview_notes: e.target.value })} placeholder="Who you're meeting, questions to ask, how it went…" />}</Field>
      </div>
    </Dialog>
  );
}

function DocumentDialog({ open, onClose, jobId, onSaved }) {
  const [mode, setMode] = useState("file");
  const [type, setType] = useState("Resume");
  const [name, setName] = useState("");
  const [url, setUrl] = useState("");
  const [file, setFile] = useState(null);
  const [saving, setSaving] = useState(false);
  useEffect(() => {
    if (open) { setMode("file"); setType("Resume"); setName(""); setUrl(""); setFile(null); }
  }, [open]);
  const save = async () => {
    if (mode === "file" && !file) return toast.error("Choose a file");
    if (mode === "link" && !/^https?:\/\//.test(url)) return toast.error("Add a link starting with https://");
    if (file && file.size > 5 * 1024 * 1024) return toast.error("Files must be 5 MB or smaller");
    const fd = new FormData();
    fd.append("document_type", type);
    fd.append("document_name", name);
    if (mode === "file") fd.append("file", file);
    else fd.append("url", url);
    setSaving(true);
    try {
      const { data } = await api.post(`/jobs/${jobId}/documents`, fd);
      onSaved(data);
      onClose();
      toast.success("Document saved");
    } catch (err) {
      toast.error(errorMessage(err));
    } finally {
      setSaving(false);
    }
  };
  return (
    <Dialog open={open} onClose={onClose} title="Add a document" description="Keep the exact version you sent to this employer."
      footer={<><Button variant="outline" onClick={onClose}>Cancel</Button><Button onClick={save} loading={saving}>Save</Button></>}>
      <div className="grid gap-4">
        <div className="grid grid-cols-2 gap-2">
          {[["file", "Upload file", Upload], ["link", "Paste link", Link2]].map(([m, label, Icon]) => (
            <button key={m} onClick={() => setMode(m)} aria-pressed={mode === m} className={cn("flex items-center justify-center gap-2 rounded-xl border-2 py-3 text-sm font-semibold", mode === m ? "border-primary bg-primary-soft text-primary" : "border-line text-ink-muted")}>
              <Icon className="h-4 w-4" />{label}
            </button>
          ))}
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Type">{(id) => <Select id={id} value={type} onChange={(e) => setType(e.target.value)}>{DOCUMENT_TYPES.map((d) => <option key={d.value} value={d.value}>{d.label}</option>)}</Select>}</Field>
          <Field label="Name (optional)">{(id) => <Input id={id} value={name} onChange={(e) => setName(e.target.value)} placeholder="Resume v3 – web" />}</Field>
        </div>
        {mode === "file" ? (
          <label className="flex cursor-pointer flex-col items-center justify-center gap-2 rounded-2xl border-2 border-dashed border-line p-6 text-center hover:border-primary">
            <Paperclip className="h-6 w-6 text-primary" />
            <span className="text-sm font-semibold">{file ? file.name : "Choose a PDF, Word doc or image"}</span>
            <span className="text-xs text-ink-muted">Up to 5 MB</span>
            <input type="file" className="sr-only" accept=".pdf,.doc,.docx,.txt,.png,.jpg,.jpeg" onChange={(e) => setFile(e.target.files?.[0] || null)} />
          </label>
        ) : (
          <Field label="Link">{(id) => <Input id={id} type="url" value={url} onChange={(e) => setUrl(e.target.value)} placeholder="https://drive.google.com/…" />}</Field>
        )}
      </div>
    </Dialog>
  );
}

export default function JobDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { refreshKey, handleRewards, openJobForm } = useShell();
  const [data, setData] = useState(null);
  const [notFound, setNotFound] = useState(false);
  const [notes, setNotes] = useState("");
  const [savingNotes, setSavingNotes] = useState(false);
  const [ivDialog, setIvDialog] = useState({ open: false, interview: null });
  const [docDialog, setDocDialog] = useState(false);
  const [contactDialog, setContactDialog] = useState(false);
  const [touchContact, setTouchContact] = useState(null);
  const [negotiate, setNegotiate] = useState(false);
  const [delTarget, setDelTarget] = useState(null);

  const load = useCallback(async () => {
    try {
      const { data } = await api.get(`/jobs/${id}`);
      setData(data);
      setNotes(data.job.notes || "");
    } catch (err) {
      if (err.response?.status === 404) setNotFound(true);
      else toast.error(errorMessage(err));
    }
  }, [id]);
  useEffect(() => { load(); }, [load, refreshKey]);

  const { actions, ...dialogs } = useJobActions({ onDeletedForever: () => navigate("/app/board") });

  if (notFound) return <EmptyState icon={Target} title="Job not found" message="It may have been deleted." action={<Link to="/app/board"><Button>Back to board</Button></Link>} />;
  if (!data) return <PageLoader />;
  const { job, interviews, documents, contacts } = data;
  const meta = STATUS_META[job.status];
  const cooldown = job.follow_up_available_at && new Date(job.follow_up_available_at) > new Date();

  const saveNotes = async (text = notes) => {
    setSavingNotes(true);
    try {
      const { data: res } = await api.patch(`/jobs/${job.id}`, { notes: text });
      handleRewards(res.rewards);
      toast.success("Notes saved");
      load();
    } catch (err) {
      toast.error(errorMessage(err));
    } finally {
      setSavingNotes(false);
    }
  };

  const removeItem = async () => {
    const { kind, item } = delTarget;
    try {
      await api.delete(kind === "interview" ? `/interviews/${item.id}` : `/documents/${item.id}`);
      toast.success("Removed");
      load();
    } catch (err) {
      toast.error(errorMessage(err));
    }
    setDelTarget(null);
  };

  const download = async (doc) => {
    if (doc.url) return window.open(doc.url, "_blank", "noopener");
    try {
      const res = await api.get(`/documents/${doc.id}/download`, { responseType: "blob" });
      const href = URL.createObjectURL(res.data);
      const a = Object.assign(document.createElement("a"), { href, download: doc.filename || doc.document_name });
      a.click();
      URL.revokeObjectURL(href);
    } catch (err) {
      toast.error(errorMessage(err));
    }
  };

  return (
    <div className="space-y-5">
      <Link to="/app/board" className="inline-flex items-center gap-1.5 text-sm font-semibold text-ink-muted hover:text-ink"><ArrowLeft className="h-4 w-4" /> Board</Link>

      {/* Header */}
      <Card className="overflow-hidden p-0">
        <div className="h-2" style={{ background: meta.color }} />
        <div className="p-5 sm:p-7">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div className="flex min-w-0 items-start gap-4">
              <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl text-xl font-extrabold" style={{ background: `${meta.color}1A`, color: meta.color }}>
                {job.company_name?.[0]?.toUpperCase()}
              </div>
              <div className="min-w-0">
                <h1 className="text-2xl font-extrabold leading-tight sm:text-3xl">{job.job_name}</h1>
                <p className="mt-0.5 text-lg text-ink-muted">{job.company_name}</p>
                <div className="mt-2 flex flex-wrap items-center gap-2">
                  <StatusPill status={job.status} />
                  {job.complete === true && <Badge className="bg-green-100 text-green-700">Offer accepted</Badge>}
                  {job.complete === false && <Badge className="bg-red-100 text-red-700">Offer declined</Badge>}
                  <Stars value={job.priority_score} onChange={(v) => actions.rate(job, v)} />
                </div>
              </div>
            </div>
            <div className="flex flex-wrap gap-2">
              <Button variant="outline" onClick={() => openJobForm(job)}><Edit3 className="h-4 w-4" /> Edit</Button>
              {["Applied", "Interviewed", "Offered"].includes(job.status) && (
                <Button variant="secondary" disabled={cooldown} onClick={() => actions.followUp(job)} title={cooldown ? "You can follow up again in 24 hours" : undefined}>
                  <Zap className="h-4 w-4" /> {cooldown ? "Followed up" : "Follow up"}
                </Button>
              )}
              {job.status === "Deleted" ? (
                <Button onClick={() => actions.restore(job)}>Restore</Button>
              ) : (
                <Button variant="ghost" size="icon" aria-label="Move to bin" onClick={() => actions.remove(job)}><Trash2 className="h-4 w-4" /></Button>
              )}
            </div>
          </div>
          {job.status !== "Deleted" && (
            <div className="mt-6 flex flex-wrap items-center justify-between gap-3">
              <Stepper job={job} onMove={(s) => actions.setStatus(job, s)} />
              {job.status !== "Archived" && <Button size="sm" variant="ghost" onClick={() => actions.setStatus(job, "Archived")}><Archive className="h-4 w-4" /> Archive</Button>}
            </div>
          )}
          {job.status === "Offered" && (
            <div className="mt-5 flex flex-col gap-3 rounded-2xl bg-pink-50 p-4 dark:bg-pink-500/10 sm:flex-row sm:items-center sm:justify-between">
              <p className="font-semibold text-pink-800 dark:text-pink-200">🎉 You have an offer! What would you like to do?</p>
              <div className="flex flex-wrap gap-2">
                <Button size="sm" onClick={() => actions.offer(job, "accept")}><CheckCircle2 className="h-4 w-4" /> Accept</Button>
                <Button size="sm" variant="outline" onClick={() => setNegotiate(true)}>Renegotiate</Button>
                <Button size="sm" variant="ghost" onClick={() => actions.offer(job, "decline")}><XCircle className="h-4 w-4" /> Decline</Button>
              </div>
            </div>
          )}
        </div>
      </Card>

      <div className="grid gap-5 lg:grid-cols-3">
        <div className="space-y-5 lg:col-span-2">
          <Section title="Overview" icon={FileText}>
            <dl className="grid gap-4 sm:grid-cols-3">
              {[
                [Wallet, "Pay", money(job.job_pay) || "—"],
                [MapPin, "Location", job.location || "—"],
                [Target, "Fit score", job.compare_score != null ? `${job.compare_score}/100` : "—"],
              ].map(([Icon, k, v]) => (
                <div key={k} className="rounded-2xl bg-surface-2 p-4">
                  <dt className="flex items-center gap-1.5 text-xs font-semibold text-ink-muted"><Icon className="h-3.5 w-3.5" />{k}</dt>
                  <dd className="mt-1 font-bold">{v}</dd>
                </div>
              ))}
            </dl>
            {job.description && <p className="mt-4 whitespace-pre-wrap text-ink-muted">{job.description}</p>}
            {job.job_link && <a href={job.job_link} target="_blank" rel="noreferrer" className="mt-4 inline-flex items-center gap-1.5 link"><ExternalLink className="h-4 w-4" /> View job posting</a>}
          </Section>

          <Section title="Research notes" icon={MessageSquareText}
            action={<Button size="sm" onClick={() => saveNotes()} loading={savingNotes} disabled={notes === (job.notes || "")}>Save notes</Button>}>
            <Textarea value={notes} onChange={(e) => setNotes(e.target.value)} className="min-h-[140px]" aria-label="Research notes"
              placeholder="Company research, why you want this role, questions to ask… Saving new notes counts toward your Research goal." />
          </Section>

          <Section title="Interviews" icon={CalendarPlus} action={<Button size="sm" variant="secondary" onClick={() => setIvDialog({ open: true, interview: null })}><Plus className="h-4 w-4" /> Log interview</Button>}>
            {interviews.length ? (
              <ol className="relative space-y-4 border-l-2 border-line pl-5">
                {interviews.map((iv) => (
                  <li key={iv.id} className="relative">
                    <span className="absolute -left-[27px] top-1 h-3.5 w-3.5 rounded-full border-2 border-surface bg-primary" aria-hidden />
                    <div className="flex flex-wrap items-start justify-between gap-2">
                      <div>
                        <p className="font-bold">{iv.interview_type}</p>
                        <p className="text-sm text-ink-muted">{iv.interview_date ? fmtDateTime(iv.interview_date) : "Date not set"}</p>
                        {iv.interview_notes && <p className="mt-1 whitespace-pre-wrap text-sm">{iv.interview_notes}</p>}
                      </div>
                      <div className="flex gap-1">
                        <Button size="icon" variant="ghost" aria-label="Edit interview" onClick={() => setIvDialog({ open: true, interview: iv })}><Edit3 className="h-4 w-4" /></Button>
                        <Button size="icon" variant="ghost" aria-label="Delete interview" onClick={() => setDelTarget({ kind: "interview", item: iv })}><Trash2 className="h-4 w-4" /></Button>
                      </div>
                    </div>
                  </li>
                ))}
              </ol>
            ) : (
              <p className="text-sm text-ink-muted">No interviews yet. When you land one, log it here to track every round.</p>
            )}
          </Section>
        </div>

        <div className="space-y-5">
          <Section title="People" icon={UserPlus} action={<Button size="sm" variant="secondary" onClick={() => setContactDialog(true)}><Plus className="h-4 w-4" /> Add</Button>}>
            {contacts.length ? (
              <ul className="space-y-3">
                {contacts.map((c) => (
                  <li key={c.id} className="flex items-center gap-3">
                    <Avatar name={c.contact_name} size={40} />
                    <div className="min-w-0 flex-1">
                      <p className="truncate font-semibold">{c.contact_name}</p>
                      <p className="truncate text-xs text-ink-muted">{c.job_title || c.relationship}</p>
                    </div>
                    <Button size="sm" variant="ghost" onClick={() => setTouchContact(c)} aria-label={`Log touchpoint with ${c.contact_name}`}><Coffee className="h-4 w-4" /></Button>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-sm text-ink-muted">Know someone here? Add a recruiter, hiring manager or employee — warm intros beat cold applications.</p>
            )}
          </Section>

          <Section title="Documents" icon={Paperclip} action={<Button size="sm" variant="secondary" onClick={() => setDocDialog(true)}><Plus className="h-4 w-4" /> Add</Button>}>
            {documents.length ? (
              <ul className="space-y-2">
                {documents.map((d) => (
                  <li key={d.id} className="flex items-center gap-3 rounded-xl bg-surface-2 p-3">
                    <FileText className="h-5 w-5 shrink-0 text-primary" />
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-semibold">{d.document_name}</p>
                      <p className="text-xs text-ink-muted">{DOCUMENT_TYPES.find((t) => t.value === d.document_type)?.label} · {fmtDate(d.created_at)}</p>
                    </div>
                    <Button size="icon" variant="ghost" aria-label="Open document" onClick={() => download(d)}>{d.url ? <ExternalLink className="h-4 w-4" /> : <Download className="h-4 w-4" />}</Button>
                    <Button size="icon" variant="ghost" aria-label="Delete document" onClick={() => setDelTarget({ kind: "document", item: d })}><Trash2 className="h-4 w-4" /></Button>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-sm text-ink-muted">Attach the resume and cover letter you used, so you're ready when they call.</p>
            )}
          </Section>

          <Section title="History" icon={Target}>
            <ul className="space-y-2 text-sm">
              {[...(job.status_history || [])].reverse().map((h, i) => (
                <li key={i} className="flex items-center justify-between gap-2">
                  <span className="flex items-center gap-2"><span className="h-2 w-2 rounded-full" style={{ background: STATUS_META[h.status]?.color }} />{h.status}</span>
                  <span className="text-ink-muted">{fmtDate(h.at)}</span>
                </li>
              ))}
            </ul>
          </Section>
        </div>
      </div>

      <InterviewDialog open={ivDialog.open} interview={ivDialog.interview} jobId={job.id} onClose={() => setIvDialog({ open: false, interview: null })}
        onSaved={(res) => { if (res.rewards) handleRewards(res.rewards); toast.success("Interview saved"); load(); }} />
      <DocumentDialog open={docDialog} jobId={job.id} onClose={() => setDocDialog(false)} onSaved={load} />
      <ContactFormDialog open={contactDialog} onClose={() => setContactDialog(false)} jobs={[job]} defaultJobId={job.id} onSaved={(res) => { handleRewards(res.rewards); load(); }} />
      <TouchpointDialog open={!!touchContact} contact={touchContact} onClose={() => setTouchContact(null)} onSaved={(res) => { handleRewards(res.rewards); load(); }} />
      <ConfirmDialog open={!!delTarget} onClose={() => setDelTarget(null)} onConfirm={removeItem} danger confirmLabel="Delete"
        title={`Delete this ${delTarget?.kind}?`} message="This can't be undone." />
      <RenegotiateDialog open={negotiate} onClose={() => setNegotiate(false)} job={job} onSaved={(res) => { handleRewards(res.rewards); load(); }} />
      <JobActionDialogs {...dialogs} actions={actions} />
    </div>
  );
}

function RenegotiateDialog({ open, onClose, job, onSaved }) {
  const [text, setText] = useState("");
  const [saving, setSaving] = useState(false);
  useEffect(() => { if (open) setText(job.notes || ""); }, [open, job.notes]);
  const save = async () => {
    setSaving(true);
    try {
      const { data } = await api.post(`/jobs/${job.id}/offer`, { decision: "renegotiate", notes: text });
      toast.success("Renegotiation notes saved");
      onSaved(data);
      onClose();
    } catch (err) {
      toast.error(errorMessage(err));
    } finally {
      setSaving(false);
    }
  };
  return (
    <Dialog open={open} onClose={onClose} title="Renegotiate offer" description="Plan what you'd like to ask for — salary, start date, title, flexibility."
      footer={<><Button variant="outline" onClick={onClose}>Cancel</Button><Button onClick={save} loading={saving}>Save</Button></>}>
      <Textarea value={text} onChange={(e) => setText(e.target.value)} className="min-h-[140px]" aria-label="Renegotiation notes" />
      <p className="mt-2 text-xs text-ink-muted">Tip: CareerNiche coaches can help you prepare — see the Hub.</p>
    </Dialog>
  );
}

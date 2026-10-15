import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Button, Dialog, Field, Input, Select, Stars, Textarea } from "@/components/ui";
import { api, errorMessage } from "@/lib/api";
import { PIPELINE } from "@/lib/constants";

const EMPTY = { job_name: "", company_name: "", job_link: "", job_pay: "", location: "", status: "Bookmarked", priority_score: 0, compare_score: "", description: "" };

/** Add / edit a job (port of add_edit_job_screen.dart). */
export default function JobFormDialog({ open, onClose, job, defaultStatus, onSaved }) {
  const [form, setForm] = useState(EMPTY);
  const [saving, setSaving] = useState(false);
  const [errors, setErrors] = useState({});
  const editing = !!job;

  useEffect(() => {
    if (!open) return;
    setErrors({});
    setForm(
      job
        ? { ...EMPTY, ...job, job_pay: job.job_pay ?? "", compare_score: job.compare_score ?? "", priority_score: job.priority_score || 0, job_link: job.job_link || "", description: job.description || "", location: job.location || "" }
        : { ...EMPTY, status: defaultStatus || "Bookmarked" }
    );
  }, [open, job, defaultStatus]);

  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e?.target ? e.target.value : e }));

  const submit = async (e) => {
    e?.preventDefault();
    const errs = {};
    if (!form.job_name.trim()) errs.job_name = "Job title is required";
    if (!form.company_name.trim()) errs.company_name = "Company is required";
    if (form.job_link && !/^https?:\/\//i.test(form.job_link)) errs.job_link = "Links should start with http:// or https://";
    setErrors(errs);
    if (Object.keys(errs).length) return;
    setSaving(true);
    const payload = {
      job_name: form.job_name.trim(),
      company_name: form.company_name.trim(),
      job_link: form.job_link.trim(),
      job_pay: form.job_pay === "" ? null : Number(form.job_pay),
      location: form.location.trim(),
      status: form.status,
      priority_score: form.priority_score || (editing ? 0 : null),
      compare_score: form.compare_score === "" ? null : Number(form.compare_score),
      description: form.description,
    };
    try {
      const { data } = editing ? await api.patch(`/jobs/${job.id}`, payload) : await api.post("/jobs", payload);
      toast.success(editing ? "Job updated" : "Job added to your board");
      onSaved?.(data);
      onClose();
    } catch (err) {
      toast.error(errorMessage(err));
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog
      open={open}
      onClose={onClose}
      title={editing ? "Edit job" : "Add a job"}
      description={editing ? undefined : "Every job you add earns progress toward your goals."}
      size="lg"
      footer={
        <>
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button onClick={submit} loading={saving}>{editing ? "Save changes" : "Add job"}</Button>
        </>
      }
    >
      <form onSubmit={submit} className="grid gap-4 sm:grid-cols-2" noValidate>
        <Field label="Job title" required error={errors.job_name}>
          {(id) => <Input id={id} value={form.job_name} onChange={set("job_name")} placeholder="e.g. Junior Web Developer" autoComplete="off" />}
        </Field>
        <Field label="Company" required error={errors.company_name}>
          {(id) => <Input id={id} value={form.company_name} onChange={set("company_name")} placeholder="e.g. Northshore Digital" />}
        </Field>
        <Field label="Job posting link" error={errors.job_link} className="sm:col-span-2">
          {(id) => <Input id={id} type="url" value={form.job_link} onChange={set("job_link")} placeholder="https://" />}
        </Field>
        <Field label="Stage">
          {(id) => (
            <Select id={id} value={form.status} onChange={set("status")}>
              {(editing ? [...PIPELINE, "Archived"] : PIPELINE).map((s) => <option key={s}>{s}</option>)}
            </Select>
          )}
        </Field>
        <Field label="Location">
          {(id) => <Input id={id} value={form.location} onChange={set("location")} placeholder="City or Remote" />}
        </Field>
        <Field label="Pay (CAD / year)">
          {(id) => <Input id={id} type="number" min="0" inputMode="numeric" value={form.job_pay} onChange={set("job_pay")} placeholder="65000" />}
        </Field>
        <Field label="Fit score (0–100)" hint="How well does it match what you want?">
          {(id) => <Input id={id} type="number" min="0" max="100" value={form.compare_score} onChange={set("compare_score")} placeholder="80" />}
        </Field>
        <div className="sm:col-span-2">
          <span className="block text-sm font-semibold text-ink mb-1.5">Priority</span>
          <Stars value={form.priority_score} onChange={set("priority_score")} size="h-6 w-6" />
        </div>
        <Field label="Description" className="sm:col-span-2">
          {(id) => <Textarea id={id} value={form.description} onChange={set("description")} placeholder="Paste key details from the posting…" />}
        </Field>
        <button type="submit" className="hidden" aria-hidden tabIndex={-1} />
      </form>
    </Dialog>
  );
}

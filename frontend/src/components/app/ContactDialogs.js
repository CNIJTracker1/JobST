import { useEffect, useState } from "react";
import { toast } from "sonner";
import { api, errorMessage } from "@/lib/api";
import { CONTACT_FORMATS, RELATIONSHIPS } from "@/lib/constants";
import { fromLocalInput, toLocalInput } from "@/lib/utils";
import { Button, Dialog, Field, Input, Select, Textarea } from "@/components/ui";

const EMPTY = { contact_name: "", job_title: "", company: "", email: "", phone_number: "", linkedin_url: "", relationship: "Professional", description: "", job_id: "", next_touchpoint: "" };

/** Add / edit a contact (port of add_contact_dialog.dart + user_contacts_screen.dart). */
export function ContactFormDialog({ open, onClose, contact, jobs = [], defaultJobId, onSaved }) {
  const [form, setForm] = useState(EMPTY);
  const [saving, setSaving] = useState(false);
  const editing = !!contact;
  useEffect(() => {
    if (!open) return;
    setForm(contact ? { ...EMPTY, ...contact, job_id: contact.job_id || "", next_touchpoint: toLocalInput(contact.next_touchpoint).slice(0, 10) } : { ...EMPTY, job_id: defaultJobId || "" });
  }, [open, contact, defaultJobId]);
  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }));

  const submit = async (e) => {
    e?.preventDefault();
    if (!form.contact_name.trim()) return toast.error("Add a name");
    setSaving(true);
    const payload = {
      contact_name: form.contact_name.trim(), job_title: form.job_title, company: form.company, email: form.email, phone_number: form.phone_number,
      linkedin_url: form.linkedin_url, relationship: form.relationship, description: form.description, job_id: form.job_id || null,
      next_touchpoint: form.next_touchpoint ? new Date(`${form.next_touchpoint}T09:00`).toISOString() : null,
    };
    try {
      const { data } = editing ? await api.patch(`/contacts/${contact.id}`, payload) : await api.post("/contacts", payload);
      toast.success(editing ? "Contact updated" : "Added to your network");
      onSaved?.(data);
      onClose();
    } catch (err) {
      toast.error(errorMessage(err));
    } finally {
      setSaving(false);
    }
  };
  return (
    <Dialog open={open} onClose={onClose} title={editing ? "Edit contact" : "Add to your network"} description={editing ? undefined : "Every new connection counts toward your networking goal."} size="lg"
      footer={<><Button variant="outline" onClick={onClose}>Cancel</Button><Button onClick={submit} loading={saving}>{editing ? "Save" : "Add contact"}</Button></>}>
      <form onSubmit={submit} className="grid gap-4 sm:grid-cols-2">
        <Field label="Name" required>{(id) => <Input id={id} value={form.contact_name} onChange={set("contact_name")} autoComplete="off" />}</Field>
        <Field label="Relationship">{(id) => <Select id={id} value={form.relationship} onChange={set("relationship")}>{RELATIONSHIPS.map((r) => <option key={r}>{r}</option>)}</Select>}</Field>
        <Field label="Job title">{(id) => <Input id={id} value={form.job_title} onChange={set("job_title")} placeholder="e.g. Engineering Manager" />}</Field>
        <Field label="Company">{(id) => <Input id={id} value={form.company} onChange={set("company")} />}</Field>
        <Field label="Email">{(id) => <Input id={id} type="email" value={form.email} onChange={set("email")} />}</Field>
        <Field label="Phone">{(id) => <Input id={id} type="tel" value={form.phone_number} onChange={set("phone_number")} />}</Field>
        <Field label="LinkedIn URL" className="sm:col-span-2">{(id) => <Input id={id} type="url" value={form.linkedin_url} onChange={set("linkedin_url")} placeholder="https://linkedin.com/in/…" />}</Field>
        <Field label="Linked job">
          {(id) => (
            <Select id={id} value={form.job_id} onChange={set("job_id")}>
              <option value="">Not linked to a job</option>
              {jobs.map((j) => <option key={j.id} value={j.id}>{j.job_name} · {j.company_name}</option>)}
            </Select>
          )}
        </Field>
        <Field label="Next touchpoint" hint="We'll remind you on this day">{(id) => <Input id={id} type="date" value={form.next_touchpoint} onChange={set("next_touchpoint")} />}</Field>
        <Field label="Notes" className="sm:col-span-2">{(id) => <Textarea id={id} value={form.description} onChange={set("description")} placeholder="How you met, what you talked about…" />}</Field>
        <button type="submit" hidden />
      </form>
    </Dialog>
  );
}

/** Log a coffee chat / informational interview with a contact. */
export function TouchpointDialog({ open, onClose, contact, onSaved }) {
  const [form, setForm] = useState({ format: "Video", kind: "Informational interview", date: "", notes: "" });
  const [saving, setSaving] = useState(false);
  useEffect(() => {
    if (open) setForm({ format: "Video", kind: "Informational interview", date: toLocalInput(new Date().toISOString()), notes: "" });
  }, [open]);
  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }));
  const submit = async () => {
    setSaving(true);
    try {
      const { data } = await api.post(`/contacts/${contact.id}/touchpoints`, { ...form, date: fromLocalInput(form.date) });
      toast.success("Touchpoint logged");
      onSaved?.(data);
      onClose();
    } catch (err) {
      toast.error(errorMessage(err));
    } finally {
      setSaving(false);
    }
  };
  return (
    <Dialog open={open} onClose={onClose} title="Log a touchpoint" description={contact ? `with ${contact.contact_name}` : ""}
      footer={<><Button variant="outline" onClick={onClose}>Cancel</Button><Button onClick={submit} loading={saving}>Save</Button></>}>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Type">
          {(id) => (
            <Select id={id} value={form.kind} onChange={set("kind")}>
              {["Informational interview", "Coffee chat", "Call", "Message", "Event", "Referral"].map((k) => <option key={k}>{k}</option>)}
            </Select>
          )}
        </Field>
        <Field label="Format">{(id) => <Select id={id} value={form.format} onChange={set("format")}>{CONTACT_FORMATS.map((f) => <option key={f}>{f}</option>)}</Select>}</Field>
        <Field label="When" className="sm:col-span-2">{(id) => <Input id={id} type="datetime-local" value={form.date} onChange={set("date")} />}</Field>
        <Field label="Notes" className="sm:col-span-2">{(id) => <Textarea id={id} value={form.notes} onChange={set("notes")} placeholder="Key takeaways, follow-ups, referrals…" />}</Field>
      </div>
    </Dialog>
  );
}

import { useEffect, useRef, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { toast } from "sonner";
import { Bell, Camera, ChevronDown, Database, ExternalLink, Lock, LogOut, Palette, Scale, ShieldAlert, User } from "lucide-react";
import { useAuth } from "@/context/AuthContext";
import { api, errorMessage } from "@/lib/api";
import { CAREERNICHE_URL, DAYS } from "@/lib/constants";
import { THEME_COLORS } from "@/lib/themes";
import { cn } from "@/lib/utils";
import { Avatar, Button, Card, Dialog, Field, Input, Segmented, Select, Switch } from "@/components/ui";
import { PageHeader } from "@/components/app/AppShell";
import { useShell } from "@/components/app/ShellContext";

function Section({ icon: Icon, title, subtitle, children, defaultOpen, danger }) {
  const [open, setOpen] = useState(!!defaultOpen);
  return (
    <Card className={cn("overflow-hidden", danger && "border-red-200 dark:border-red-500/30")}>
      <button className="flex w-full items-center gap-4 p-5 text-left" aria-expanded={open} onClick={() => setOpen(!open)}>
        <span className={cn("flex h-10 w-10 items-center justify-center rounded-xl", danger ? "bg-red-50 text-red-600 dark:bg-red-500/10" : "bg-primary-soft text-primary")}><Icon className="h-5 w-5" /></span>
        <span className="flex-1"><span className="block font-bold">{title}</span>{subtitle && <span className="block text-sm text-ink-muted">{subtitle}</span>}</span>
        <ChevronDown className={cn("h-5 w-5 text-ink-muted transition", open && "rotate-180")} />
      </button>
      {open && <div className="border-t border-line p-5">{children}</div>}
    </Card>
  );
}

const Row = ({ label, hint, children }) => (
  <div className="flex items-center justify-between gap-4 py-3">
    <div><p className="font-semibold">{label}</p>{hint && <p className="text-sm text-ink-muted">{hint}</p>}</div>
    {children}
  </div>
);

/** Resize an uploaded image to a 256px square data URL (keeps avatars small). */
function resizeImage(file) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => {
      const size = 256;
      const canvas = Object.assign(document.createElement("canvas"), { width: size, height: size });
      const s = Math.min(img.width, img.height);
      canvas.getContext("2d").drawImage(img, (img.width - s) / 2, (img.height - s) / 2, s, s, 0, 0, size, size);
      resolve(canvas.toDataURL("image/jpeg", 0.85));
    };
    img.onerror = reject;
    img.src = URL.createObjectURL(file);
  });
}

export default function Settings() {
  const { user, setUser, updateSettings, logout } = useAuth();
  const { bump } = useShell();
  const navigate = useNavigate();
  const s = user.settings;
  const [username, setUsername] = useState(user.username);
  const [pw, setPw] = useState({ current: "", next: "", confirm: "" });
  const [themes, setThemes] = useState([]);
  const [deleting, setDeleting] = useState(false);
  const [confirmText, setConfirmText] = useState("");
  const [busy, setBusy] = useState("");
  const fileRef = useRef(null);
  const [perm, setPerm] = useState(typeof Notification !== "undefined" ? Notification.permission : "unsupported");

  useEffect(() => { api.get("/themes").then((r) => setThemes(r.data.themes)); }, []);

  const save = async (changes, msg = "Saved") => {
    try {
      await updateSettings(changes);
      toast.success(msg);
    } catch (err) {
      toast.error(errorMessage(err));
    }
  };
  const saveProfile = async (patch, msg) => {
    try {
      const { data } = await api.patch("/me", patch);
      setUser((u) => ({ ...u, ...data.user }));
      toast.success(msg);
    } catch (err) {
      toast.error(errorMessage(err));
    }
  };
  const onPhoto = async (e) => {
    const f = e.target.files?.[0];
    if (!f) return;
    try {
      await saveProfile({ avatar: await resizeImage(f) }, "Profile photo updated");
    } catch {
      toast.error("Couldn't read that image");
    }
  };
  const changePassword = async () => {
    if (!pw.current || !pw.next || !pw.confirm) return toast.error("Please fill in all fields");
    if (pw.next !== pw.confirm) return toast.error("New passwords do not match");
    if (pw.next.length < 6) return toast.error("Password must be at least 6 characters");
    setBusy("pw");
    try {
      await api.post("/auth/change-password", { current_password: pw.current, new_password: pw.next });
      setPw({ current: "", next: "", confirm: "" });
      toast.success("Password changed");
    } catch (err) {
      toast.error(errorMessage(err));
    } finally {
      setBusy("");
    }
  };
  const demo = async (load) => {
    setBusy("demo");
    try {
      load ? await api.post("/demo/seed") : await api.delete("/demo");
      toast.success(load ? "Sample data added" : "Sample data removed");
      bump();
    } finally {
      setBusy("");
    }
  };
  const askPermission = async () => {
    if (typeof Notification === "undefined") return;
    setPerm(await Notification.requestPermission());
  };
  const deleteAccount = async () => {
    await api.delete("/me");
    logout();
    toast.success("Your account and data were deleted");
    navigate("/");
  };
  const visit = async () => {
    window.open(CAREERNICHE_URL, "_blank", "noopener");
    const { data } = await api.post("/themes/careerniche/visit");
    if (data.unlocked) {
      toast.success("🟢 CareerNiche theme unlocked!");
      setThemes((t) => t.map((x) => (x.key === "careerNiche" ? { ...x, unlocked: true } : x)));
      setUser((u) => ({ ...u, unlocked_themes: [...(u.unlocked_themes || []), "careerNiche"] }));
    }
  };

  return (
    <div className="mx-auto max-w-3xl">
      <PageHeader title="Settings" />
      <div className="space-y-4">
        <Section icon={User} title="Profile" subtitle="Photo and display name" defaultOpen>
          <div className="flex flex-col gap-5 sm:flex-row sm:items-center">
            <div className="relative w-fit">
              <Avatar name={user.username} src={user.avatar} size={84} />
              <button onClick={() => fileRef.current?.click()} className="absolute -bottom-1 -right-1 flex h-9 w-9 items-center justify-center rounded-full bg-primary text-primary-fg shadow-lift" aria-label="Change profile photo"><Camera className="h-4 w-4" /></button>
              <input ref={fileRef} type="file" accept="image/*" className="sr-only" onChange={onPhoto} />
            </div>
            <div className="flex-1">
              <Field label="Display name" hint="3–20 characters">
                {(id) => (
                  <div className="flex gap-2">
                    <Input id={id} value={username} onChange={(e) => setUsername(e.target.value)} maxLength={20} />
                    <Button disabled={username.trim() === user.username || username.trim().length < 3} onClick={() => saveProfile({ username: username.trim() }, "Username changed")}>Save</Button>
                  </div>
                )}
              </Field>
              {user.avatar && <button className="mt-2 text-sm text-ink-muted hover:text-ink" onClick={() => saveProfile({ avatar: "" }, "Photo removed")}>Remove photo</button>}
            </div>
          </div>
        </Section>

        <Section icon={Palette} title="Appearance" subtitle="Theme, dark mode and text size">
          <Row label="Dark mode"><Switch checked={!!s.dark_mode} onChange={(v) => updateSettings({ dark_mode: v })} label="Dark mode" /></Row>
          <Row label="Text size">
            <Segmented value={s.font_size} onChange={(v) => updateSettings({ font_size: v })} options={[{ value: "defaultSize", label: "Default" }, { value: "large", label: "Large" }, { value: "extraLarge", label: "XL" }]} />
          </Row>
          <p className="mb-2 mt-3 font-semibold">Theme</p>
          <div className="grid grid-cols-3 gap-2 sm:grid-cols-5">
            {themes.map((t) => {
              const c = THEME_COLORS[t.key];
              const active = s.app_theme === t.key;
              return (
                <button key={t.key} disabled={!t.unlocked} onClick={() => updateSettings({ app_theme: t.key })} aria-pressed={active}
                  className={cn("relative rounded-xl border-2 p-2 text-left text-xs font-semibold transition", active ? "border-primary" : "border-line", !t.unlocked && "opacity-50")}>
                  <span className="mb-1.5 flex h-8 overflow-hidden rounded-lg" aria-hidden><span className="flex-[3]" style={{ background: c.primary }} /><span className="flex-1" style={{ background: c.accent }} /></span>
                  <span className="block truncate">{t.label}</span>
                  {!t.unlocked && <Lock className="absolute right-2 top-2 h-3.5 w-3.5 text-white drop-shadow" />}
                </button>
              );
            })}
          </div>
          <p className="mt-3 text-sm text-ink-muted">Locked themes are unlocked with tokens in <Link to="/app/growth?tab=rewards" className="link">Growth → Rewards</Link>.</p>
        </Section>

        <Section icon={Bell} title="Notifications" subtitle="Reminders, quotes and your weekly email">
          <Row label="Browser notifications" hint={perm === "granted" ? "Enabled on this device" : perm === "denied" ? "Blocked — allow them in your browser settings" : "Needed for daily reminders while the app is open"}>
            {perm === "granted" ? <span className="text-sm font-semibold text-primary">On</span> : <Button size="sm" variant="secondary" onClick={askPermission} disabled={perm === "denied" || perm === "unsupported"}>Enable</Button>}
          </Row>
          <Row label="Daily reminder" hint="A nudge to apply or reach out"><Switch checked={!!s.daily_reminder} onChange={(v) => save({ daily_reminder: v })} label="Daily reminder" /></Row>
          {s.daily_reminder && (
            <Row label="Reminder time"><Input type="time" value={s.reminder_time} onChange={(e) => save({ reminder_time: e.target.value }, `Reminder set for ${e.target.value}`)} className="h-10 w-32" aria-label="Reminder time" /></Row>
          )}
          <Row label="Motivational quote" hint="A fresh quote on your dashboard"><Switch checked={!!s.quote_notification} onChange={(v) => save({ quote_notification: v })} label="Motivational quote" /></Row>
          <Row label="Weekly summary email" hint="Your progress, delivered to your inbox"><Switch checked={!!s.weekly_report} onChange={(v) => save({ weekly_report: v })} label="Weekly summary email" /></Row>
          {s.weekly_report && (
            <Row label="Send it on">
              <Select value={s.report_day} onChange={(e) => save({ report_day: Number(e.target.value) }, `Weekly report set to ${DAYS[e.target.value]}s`)} className="h-10 w-40" aria-label="Weekly report day">
                {DAYS.map((d, i) => <option key={d} value={i}>{d}</option>)}
              </Select>
            </Row>
          )}
          <Row label="Time zone" hint="Used for daily and weekly resets">
            <Button size="sm" variant="ghost" onClick={() => save({ timezone: Intl.DateTimeFormat().resolvedOptions().timeZone }, "Time zone updated")}>{s.timezone} · use this device</Button>
          </Row>
        </Section>

        <Section icon={Lock} title="Account" subtitle={user.email}>
          <div className="grid gap-3 sm:grid-cols-3">
            <Field label="Current password">{(id) => <Input id={id} type="password" autoComplete="current-password" value={pw.current} onChange={(e) => setPw({ ...pw, current: e.target.value })} />}</Field>
            <Field label="New password">{(id) => <Input id={id} type="password" autoComplete="new-password" value={pw.next} onChange={(e) => setPw({ ...pw, next: e.target.value })} />}</Field>
            <Field label="Confirm password">{(id) => <Input id={id} type="password" autoComplete="new-password" value={pw.confirm} onChange={(e) => setPw({ ...pw, confirm: e.target.value })} />}</Field>
          </div>
          <Button className="mt-4" onClick={changePassword} loading={busy === "pw"}>Change password</Button>
        </Section>

        <Section icon={Database} title="Sample data" subtitle="Explore the app with example jobs and contacts">
          <div className="flex flex-wrap gap-2">
            <Button variant="secondary" loading={busy === "demo"} onClick={() => demo(true)}>Load sample data</Button>
            <Button variant="outline" loading={busy === "demo"} onClick={() => demo(false)}>Remove sample data</Button>
          </div>
          <p className="mt-2 text-sm text-ink-muted">Sample data never earns points, and removing it leaves your own jobs untouched.</p>
        </Section>

        <Section icon={Scale} title="Legal & about">
          <div className="flex flex-wrap gap-2">
            <Link to="/privacy"><Button variant="outline">Privacy Policy</Button></Link>
            <Link to="/terms"><Button variant="outline">Terms of Service</Button></Link>
            <Button variant="outline" onClick={visit}><ExternalLink className="h-4 w-4" /> Visit CareerNiche</Button>
          </div>
          <p className="mt-2 text-sm text-ink-muted">Visiting careerniche.ca unlocks the CareerNiche green theme. 🟢</p>
        </Section>

        <Section icon={ShieldAlert} title="Danger zone" danger>
          <div className="flex flex-wrap gap-2">
            <Button variant="outline" onClick={() => { logout(); navigate("/"); }}><LogOut className="h-4 w-4" /> Log out</Button>
            <Button variant="danger" onClick={() => setDeleting(true)}>Delete account</Button>
          </div>
        </Section>
      </div>

      <Dialog open={deleting} onClose={() => { setDeleting(false); setConfirmText(""); }} title="Delete your account?" size="sm"
        footer={<><Button variant="outline" onClick={() => setDeleting(false)}>Cancel</Button><Button variant="danger" disabled={confirmText !== "DELETE"} onClick={deleteAccount}>Delete forever</Button></>}>
        <p className="text-sm text-ink-muted">This permanently deletes your jobs, contacts, rewards and town. Type <b className="text-ink">DELETE</b> to confirm.</p>
        <Input className="mt-3" value={confirmText} onChange={(e) => setConfirmText(e.target.value)} aria-label="Type DELETE to confirm" />
      </Dialog>
    </div>
  );
}

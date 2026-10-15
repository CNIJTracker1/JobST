import { useEffect, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { toast } from "sonner";
import { Check, Clock, Coins, ExternalLink, Lock, Plus, Sparkles, Target, Trash2, Trophy } from "lucide-react";
import { useAuth } from "@/context/AuthContext";
import { api, errorMessage } from "@/lib/api";
import { ACTION_META, CAREERNICHE_URL } from "@/lib/constants";
import { THEME_COLORS } from "@/lib/themes";
import { cn, timeAgo } from "@/lib/utils";
import { Button, Card, ConfirmDialog, Dialog, Field, Input, PageLoader, Progress, Segmented, Select } from "@/components/ui";
import { PageHeader } from "@/components/app/AppShell";
import { useShell } from "@/components/app/ShellContext";
import CityBuilder from "@/components/app/CityBuilder";

function countdown(iso) {
  const ms = new Date(iso) - Date.now();
  if (ms <= 0) return "resetting…";
  const h = Math.floor(ms / 36e5);
  if (h >= 24) return `${Math.floor(h / 24)}d ${h % 24}h left`;
  return `${h}h ${Math.floor((ms % 36e5) / 6e4)}m left`;
}

function GoalDialog({ open, onClose, onSaved, goal }) {
  const [form, setForm] = useState({ goal_type: "daily", action_type: "apply", target: 2 });
  const [saving, setSaving] = useState(false);
  useEffect(() => {
    if (open) setForm(goal ? { goal_type: goal.goal_type, action_type: goal.action_type, target: goal.target } : { goal_type: "daily", action_type: "apply", target: 2 });
  }, [open, goal]);
  const save = async () => {
    if (!form.target || form.target < 1) return toast.error("Please enter a valid target count");
    setSaving(true);
    try {
      const { data } = await api.post("/goals", { ...form, target: Number(form.target) });
      toast.success(goal ? "Goal updated" : "Goal activated!");
      onSaved(data);
      onClose();
    } catch (err) {
      toast.error(errorMessage(err));
    } finally {
      setSaving(false);
    }
  };
  return (
    <Dialog open={open} onClose={onClose} title={goal ? "Edit goal" : "Add a goal"} size="sm"
      footer={<><Button variant="outline" onClick={onClose}>Cancel</Button><Button onClick={save} loading={saving}>{goal ? "Save" : "Activate goal"}</Button></>}>
      <div className="grid gap-4">
        <div>
          <span className="mb-1.5 block text-sm font-semibold">Frequency</span>
          <Segmented value={form.goal_type} onChange={(v) => setForm({ ...form, goal_type: v })} options={[{ value: "daily", label: "Daily" }, { value: "weekly", label: "Weekly" }]} />
        </div>
        <Field label="Action">
          {(id) => (
            <Select id={id} value={form.action_type} onChange={(e) => setForm({ ...form, action_type: e.target.value })} disabled={!!goal}>
              {Object.entries(ACTION_META).map(([k, v]) => <option key={k} value={k}>{v.emoji} {v.label}</option>)}
            </Select>
          )}
        </Field>
        <Field label="Target count">{(id) => <Input id={id} type="number" min="1" max="500" value={form.target} onChange={(e) => setForm({ ...form, target: e.target.value })} />}</Field>
      </div>
    </Dialog>
  );
}

function MissionsTab() {
  const { refreshKey } = useShell();
  const [missions, setMissions] = useState(null);
  const [goals, setGoals] = useState(null);
  const [dialog, setDialog] = useState({ open: false, goal: null });
  const [del, setDel] = useState(null);
  useEffect(() => {
    api.get("/missions").then((r) => setMissions(r.data));
    api.get("/goals").then((r) => setGoals(r.data));
  }, [refreshKey]);
  if (!missions || !goals) return <PageLoader />;
  const remove = async () => {
    const { data } = await api.delete(`/goals/${del.goal_type}/${del.action_type}`);
    setGoals(data);
    toast.success("Goal deleted");
    setDel(null);
  };
  return (
    <div className="grid gap-5 lg:grid-cols-5">
      <div className="lg:col-span-3">
        <h2 className="mb-3 text-lg font-bold">Missions</h2>
        <div className="space-y-3">
          {missions.map((m) => (
            <Card key={m.id} className={cn("flex items-center gap-4 p-4", m.completed && "bg-primary-soft/60")}>
              <div className={cn("flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl text-2xl", m.completed ? "bg-primary text-primary-fg" : "bg-surface-2")}>
                {m.completed ? <Check className="h-6 w-6" /> : ACTION_META[m.action_type]?.emoji}
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-baseline justify-between gap-x-3">
                  <p className="font-bold">{m.name}</p>
                  <p className="text-sm font-bold text-amber-600 dark:text-amber-400">+{m.points} pts</p>
                </div>
                <p className="text-sm text-ink-muted">{m.description}</p>
                <div className="mt-2 flex items-center gap-3">
                  <Progress value={m.progress} max={m.target} className="flex-1" />
                  <span className="text-xs font-bold tabular-nums">{m.progress}/{m.target}</span>
                </div>
                <p className="mt-1 flex items-center gap-1 text-xs text-ink-faint"><Clock className="h-3 w-3" />{m.reset_label} · {countdown(m.resets_at)}</p>
              </div>
            </Card>
          ))}
        </div>
      </div>
      <div className="lg:col-span-2">
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-lg font-bold">Your goals</h2>
          <Button size="sm" variant="secondary" onClick={() => setDialog({ open: true, goal: null })}><Plus className="h-4 w-4" /> Add goal</Button>
        </div>
        <Card className="divide-y divide-line">
          {goals.length ? goals.map((g) => (
            <div key={g.id} className="flex items-center gap-3 p-4">
              <span className="text-xl" aria-hidden>{ACTION_META[g.action_type]?.emoji}</span>
              <button className="min-w-0 flex-1 text-left" onClick={() => setDialog({ open: true, goal: g })} aria-label={`Edit ${g.goal_type} ${g.action_type} goal`}>
                <p className="text-sm font-bold">{ACTION_META[g.action_type]?.label} <span className="font-medium text-ink-muted">· {g.goal_type}</span></p>
                <div className="mt-1.5 flex items-center gap-2">
                  <Progress value={g.current} max={g.target} className="flex-1" barClass={g.completed ? "bg-green-500" : undefined} />
                  <span className="text-xs font-bold tabular-nums">{g.current}/{g.target}</span>
                </div>
              </button>
              <Button size="icon" variant="ghost" aria-label="Delete goal" onClick={() => setDel(g)}><Trash2 className="h-4 w-4" /></Button>
            </div>
          )) : <p className="p-5 text-sm text-ink-muted">No goals yet. Add one to stay on pace.</p>}
        </Card>
        <p className="mt-3 text-xs text-ink-muted">Daily goals reset at midnight; weekly goals reset on Sunday. Moving a job backward and forward never double-counts.</p>
      </div>
      <GoalDialog open={dialog.open} goal={dialog.goal} onClose={() => setDialog({ open: false, goal: null })} onSaved={setGoals} />
      <ConfirmDialog open={!!del} onClose={() => setDel(null)} onConfirm={remove} danger confirmLabel="Delete" title="Delete goal?" message={`Are you sure you want to delete your ${del?.goal_type} goal for ${ACTION_META[del?.action_type]?.label}?`} />
    </div>
  );
}

function RewardsTab() {
  const { user, updateSettings, setTokens } = useAuth();
  const { refreshKey } = useShell();
  const [summary, setSummary] = useState(null);
  const [themes, setThemes] = useState(null);
  const [activity, setActivity] = useState([]);
  const [busy, setBusy] = useState(null);
  const load = () => {
    api.get("/rewards/summary").then((r) => setSummary(r.data));
    api.get("/themes").then((r) => setThemes(r.data));
    api.get("/rewards/activity?limit=12").then((r) => setActivity(r.data));
  };
  useEffect(load, [refreshKey]);
  if (!summary || !themes) return <PageLoader />;

  const unlock = async (t) => {
    setBusy(t.key);
    try {
      const { data } = await api.post(`/themes/${t.key}/unlock`);
      setThemes(data);
      setTokens(data.tokens);
      toast.success(`${t.emoji} ${t.label} unlocked!`);
    } catch (err) {
      toast.error(errorMessage(err));
    } finally {
      setBusy(null);
    }
  };
  const visit = async () => {
    window.open(CAREERNICHE_URL, "_blank", "noopener");
    const { data } = await api.post("/themes/careerniche/visit");
    if (data.unlocked) toast.success("🟢 CareerNiche theme unlocked!");
    load();
  };
  const unlockedCount = summary.badges.filter((b) => b.unlocked).length;

  return (
    <div className="space-y-6">
      <div className="grid gap-4 sm:grid-cols-4">
        {[["Total points", summary.points.total, Sparkles], ["This week", summary.points.weekly, Target], ["Tokens", summary.tokens, Coins], ["Badges", `${unlockedCount}/${summary.badges.length}`, Trophy]].map(([k, v, Icon]) => (
          <Card key={k} className="p-5"><Icon className="h-5 w-5 text-primary" /><p className="mt-2 text-2xl font-extrabold">{v}</p><p className="text-sm text-ink-muted">{k}</p></Card>
        ))}
      </div>

      <section>
        <h2 className="mb-3 text-lg font-bold">Badges</h2>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {summary.badges.map((b) => (
            <Card key={b.type} className={cn("flex items-center gap-4 p-4", !b.unlocked && "opacity-60")}>
              <div className={cn("flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl text-3xl", b.unlocked ? "bg-amber-100 dark:bg-amber-500/20 animate-pop" : "bg-surface-2 grayscale")}>{b.unlocked ? b.icon : <Lock className="h-6 w-6 text-ink-faint" />}</div>
              <div><p className="font-bold">{b.name}</p><p className="text-sm text-ink-muted">{b.description}</p>{b.unlocked && <p className="text-xs font-semibold text-primary">Unlocked {timeAgo(b.unlocked_at)}</p>}</div>
            </Card>
          ))}
        </div>
      </section>

      <section>
        <div className="mb-3 flex items-end justify-between gap-3">
          <div><h2 className="text-lg font-bold">Theme shop</h2><p className="text-sm text-ink-muted">Spend tokens to unlock new looks. Tap an unlocked theme to apply it.</p></div>
        </div>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
          {themes.themes.map((t) => {
            const active = user.settings.app_theme === t.key;
            const c = THEME_COLORS[t.key];
            return (
              <div key={t.key} className={cn("rounded-2xl border-2 bg-surface p-3 transition", active ? "border-primary" : "border-line")}>
                <div className="flex h-16 overflow-hidden rounded-xl" aria-hidden>
                  <div className="flex-[3]" style={{ background: c.primary }} /><div className="flex-1" style={{ background: c.accent }} />
                </div>
                <p className="mt-2 truncate text-sm font-bold">{t.emoji} {t.label}</p>
                {t.unlocked ? (
                  <Button size="sm" variant={active ? "primary" : "secondary"} className="mt-2 w-full" disabled={active} onClick={() => updateSettings({ app_theme: t.key })}>{active ? "Applied" : "Apply"}</Button>
                ) : t.unlock === "visit" ? (
                  <Button size="sm" variant="outline" className="mt-2 w-full" onClick={visit}><ExternalLink className="h-3.5 w-3.5" /> Visit site</Button>
                ) : (
                  <Button size="sm" variant="outline" className="mt-2 w-full" loading={busy === t.key} disabled={themes.tokens < t.cost} onClick={() => unlock(t)}>
                    <Lock className="h-3.5 w-3.5" /> {t.cost} <Coins className="h-3.5 w-3.5 text-amber-500" />
                  </Button>
                )}
              </div>
            );
          })}
        </div>
      </section>

      <section>
        <h2 className="mb-3 text-lg font-bold">Recent activity</h2>
        <Card className="divide-y divide-line">
          {activity.length ? activity.map((a) => (
            <div key={a.id} className="flex items-center justify-between gap-3 px-5 py-3 text-sm">
              <span>{ACTION_META[a.action]?.emoji} {ACTION_META[a.action]?.label}</span>
              <span className="flex items-center gap-3">{a.points > 0 && <span className="font-bold text-amber-600">+{a.points}</span>}<span className="text-ink-muted">{timeAgo(a.created_at)}</span></span>
            </div>
          )) : <p className="p-5 text-sm text-ink-muted">Your rewarded actions will show up here.</p>}
        </Card>
      </section>
    </div>
  );
}

export default function Growth() {
  const [params, setParams] = useSearchParams();
  const tab = params.get("tab") || "missions";
  return (
    <div>
      <PageHeader eyebrow="Growth" title="Missions, rewards & your town" subtitle="Small daily wins add up. Complete missions to earn points and tokens, then spend them on themes and your city." />
      <Segmented className="mb-6" value={tab} onChange={(v) => setParams({ tab: v })}
        options={[{ value: "missions", label: "Missions & goals" }, { value: "rewards", label: "Rewards & themes" }, { value: "city", label: "City builder" }]} />
      {tab === "missions" ? <MissionsTab /> : tab === "rewards" ? <RewardsTab /> : <CityBuilder />}
    </div>
  );
}

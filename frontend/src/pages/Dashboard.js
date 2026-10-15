import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { ArrowRight, Bell, CalendarClock, Coins, Compass, Flame, Plus, Quote, Sparkles, Trophy, Users } from "lucide-react";
import { useAuth } from "@/context/AuthContext";
import { api } from "@/lib/api";
import { ACTION_META, PIPELINE, STATUS_META } from "@/lib/constants";
import { cn, greeting, relativeDay, fmtDateTime, timeAgo } from "@/lib/utils";
import { Button, Card, Progress, Ring, Skeleton, Stars } from "@/components/ui";
import { useShell } from "@/components/app/ShellContext";
import StatusPill from "@/components/app/StatusPill";

function computeStreak(activity) {
  const days = new Set(activity.map((a) => new Date(a.created_at).toDateString()));
  let streak = 0;
  const d = new Date();
  if (!days.has(d.toDateString())) d.setDate(d.getDate() - 1); // today not done yet doesn't break it
  while (days.has(d.toDateString())) {
    streak += 1;
    d.setDate(d.getDate() - 1);
  }
  return streak;
}

export default function Dashboard() {
  const { user } = useAuth();
  const { openJobForm, refreshKey } = useShell();
  const [data, setData] = useState(null);
  const [quote, setQuote] = useState(null);

  useEffect(() => {
    let alive = true;
    Promise.all([
      api.get("/jobs"),
      api.get("/rewards/summary"),
      api.get("/missions"),
      api.get("/notifications"),
      api.get("/rewards/activity?limit=200"),
    ]).then(([jobs, summary, missions, notes, activity]) => {
      if (alive) setData({ jobs: jobs.data, summary: summary.data, missions: missions.data, upcoming: notes.data.items, activity: activity.data });
    });
    return () => { alive = false; };
  }, [refreshKey]);

  useEffect(() => {
    api.get("/quote").then((r) => setQuote(r.data)).catch(() => {});
  }, []);

  const counts = useMemo(() => {
    const c = Object.fromEntries(PIPELINE.map((s) => [s, 0]));
    (data?.jobs || []).forEach((j) => { if (c[j.status] != null) c[j.status] += 1; });
    return c;
  }, [data]);
  const streak = useMemo(() => computeStreak(data?.activity || []), [data]);

  if (!data)
    return (
      <div className="grid gap-5 lg:grid-cols-3">
        <Skeleton className="h-40 lg:col-span-2" /><Skeleton className="h-40" />
        <Skeleton className="h-24 lg:col-span-3" /><Skeleton className="h-64 lg:col-span-2" /><Skeleton className="h-64" />
      </div>
    );

  const { summary, missions, upcoming, jobs } = data;
  const activeMissions = missions.filter((m) => !m.completed).slice(0, 4);
  const recent = jobs.filter((j) => j.status !== "Archived").slice(0, 5);
  const weeklyApply = summary.goals.find((g) => g.goal_type === "weekly" && g.action_type === "apply");

  return (
    <div className="space-y-6">
      {/* Greeting */}
      <div className="grid gap-5 lg:grid-cols-3">
        <Card className="relative overflow-hidden p-6 sm:p-7 lg:col-span-2">
          <div className="pointer-events-none absolute -right-16 -top-16 h-56 w-56 rounded-full bg-primary/10" aria-hidden />
          <p className="eyebrow">{new Date().toLocaleDateString("en-CA", { weekday: "long", month: "long", day: "numeric" })}</p>
          <h1 className="mt-1 text-2xl font-extrabold sm:text-3xl">{greeting()}, {user?.username} 👋</h1>
          <p className="mt-1 text-ink-muted">
            {user?.settings?.target_role ? <>Working toward <span className="font-semibold text-ink">{user.settings.target_role}</span>. </> : null}
            {weeklyApply ? <>You've applied to <b className="text-ink">{weeklyApply.current}</b> of <b className="text-ink">{weeklyApply.target}</b> jobs this week.</> : "Let's make progress today."}
          </p>
          {weeklyApply && <Progress className="mt-4 max-w-md" value={weeklyApply.current} max={weeklyApply.target} />}
          {quote && (
            <figure className="mt-5 flex max-w-xl gap-3 rounded-2xl bg-surface-2 p-4">
              <Quote className="h-5 w-5 shrink-0 text-primary" aria-hidden />
              <div><blockquote className="text-sm italic text-ink">“{quote.text}”</blockquote><figcaption className="mt-1 text-xs font-semibold text-ink-muted">— {quote.author}</figcaption></div>
            </figure>
          )}
        </Card>
        <Card className="grid grid-cols-2 gap-px overflow-hidden bg-line p-0">
          {[
            { icon: Flame, label: "Day streak", value: streak, color: "text-orange-500" },
            { icon: Sparkles, label: "Points today", value: summary.points.daily, color: "text-primary" },
            { icon: Trophy, label: "This week", value: summary.points.weekly, color: "text-violet-500" },
            { icon: Coins, label: "Tokens", value: summary.tokens, color: "text-amber-500", to: "/app/growth?tab=city" },
          ].map((s) => {
            const inner = (
              <>
                <s.icon className={cn("h-5 w-5", s.color)} />
                <p className="mt-2 text-2xl font-extrabold">{s.value}</p>
                <p className="text-xs font-semibold text-ink-muted">{s.label}</p>
              </>
            );
            return s.to ? <Link key={s.label} to={s.to} className="bg-surface p-5 hover:bg-surface-2">{inner}</Link> : <div key={s.label} className="bg-surface p-5">{inner}</div>;
          })}
        </Card>
      </div>

      {/* Pipeline chips */}
      <div className="flex gap-3 overflow-x-auto pb-1 scrollbar-thin">
        {PIPELINE.map((s) => (
          <Link key={s} to={`/app/board?focus=${s}`} className="group min-w-[9.5rem] flex-1 rounded-2xl border border-line bg-surface p-4 shadow-soft transition hover:-translate-y-0.5 hover:shadow-lift">
            <span className="flex items-center justify-between">
              <span className="text-xs font-bold uppercase tracking-wider" style={{ color: STATUS_META[s].color }}>{s}</span>
              <ArrowRight className="h-4 w-4 text-ink-faint transition group-hover:translate-x-0.5 group-hover:text-ink" />
            </span>
            <span className="mt-1 block text-3xl font-extrabold">{counts[s]}</span>
            <span className="text-xs text-ink-muted">{STATUS_META[s].hint}</span>
          </Link>
        ))}
      </div>

      <div className="grid gap-5 lg:grid-cols-3">
        {/* Missions */}
        <Card className="p-5 sm:p-6 lg:col-span-2">
          <div className="mb-4 flex items-center justify-between">
            <h2 className="text-lg font-bold">Today's missions</h2>
            <Link to="/app/growth" className="text-sm link">All missions</Link>
          </div>
          {activeMissions.length ? (
            <div className="grid gap-3 sm:grid-cols-2">
              {activeMissions.map((m) => (
                <div key={m.id} className="flex items-center gap-4 rounded-2xl bg-surface-2 p-4">
                  <Ring value={m.progress} max={m.target} size={58}>{m.progress}/{m.target}</Ring>
                  <div className="min-w-0">
                    <p className="truncate font-bold">{ACTION_META[m.action_type]?.emoji} {m.name}</p>
                    <p className="truncate text-sm text-ink-muted">{m.description}</p>
                    <p className="mt-0.5 text-xs font-bold text-amber-600 dark:text-amber-400">+{m.points} pts · {m.reset_label}</p>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <p className="rounded-2xl bg-surface-2 p-5 text-sm text-ink-muted">Every mission is complete — legendary. New ones unlock when they reset. 🏆</p>
          )}
        </Card>

        {/* Upcoming */}
        <Card className="p-5 sm:p-6">
          <h2 className="mb-4 text-lg font-bold">Coming up</h2>
          {upcoming.length ? (
            <ul className="space-y-3">
              {upcoming.slice(0, 5).map((it) => (
                <li key={it.id}>
                  <Link to={it.job_id ? `/app/jobs/${it.job_id}` : "/app/network"} className="flex items-start gap-3 rounded-xl p-2 -m-2 hover:bg-surface-2">
                    <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-primary-soft text-primary">
                      {it.kind === "interview" ? <CalendarClock className="h-4 w-4" /> : it.kind === "follow_up" ? <Bell className="h-4 w-4" /> : <Users className="h-4 w-4" />}
                    </span>
                    <span className="min-w-0">
                      <span className="block truncate text-sm font-semibold">{it.title}</span>
                      <span className={cn("text-xs", it.overdue ? "font-bold text-red-600" : "text-ink-muted")}>
                        {it.kind === "follow_up" ? it.body : it.overdue ? "Overdue" : it.kind === "interview" ? fmtDateTime(it.at) : relativeDay(it.at)}
                      </span>
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-sm text-ink-muted">No interviews or coffee chats this week. Reach out to someone in your <Link to="/app/network" className="link">network</Link>?</p>
          )}
        </Card>

        {/* Recent jobs */}
        <Card className="p-5 sm:p-6 lg:col-span-2">
          <div className="mb-3 flex items-center justify-between">
            <h2 className="text-lg font-bold">Recently updated</h2>
            <Button size="sm" variant="secondary" onClick={() => openJobForm()}><Plus className="h-4 w-4" /> Add job</Button>
          </div>
          {recent.length ? (
            <ul className="divide-y divide-line">
              {recent.map((j) => (
                <li key={j.id}>
                  <Link to={`/app/jobs/${j.id}`} className="flex items-center gap-3 py-3 hover:opacity-80">
                    <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl text-sm font-extrabold" style={{ background: `${STATUS_META[j.status].color}1A`, color: STATUS_META[j.status].color }}>
                      {j.company_name?.[0]?.toUpperCase()}
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="truncate font-semibold">{j.job_name}</p>
                      <p className="truncate text-sm text-ink-muted">{j.company_name} · {timeAgo(j.updated_at)}</p>
                    </div>
                    <div className="hidden sm:block"><Stars value={j.priority_score} /></div>
                    <StatusPill status={j.status} />
                  </Link>
                </li>
              ))}
            </ul>
          ) : (
            <div className="rounded-2xl bg-surface-2 p-6 text-center">
              <p className="font-semibold">Your board is empty</p>
              <p className="mt-1 text-sm text-ink-muted">Add the first job you're excited about — it counts toward today's mission.</p>
              <Button className="mt-4" onClick={() => openJobForm()}><Plus className="h-4 w-4" /> Add your first job</Button>
            </div>
          )}
        </Card>

        {/* Hub highlight */}
        <Card className="relative overflow-hidden border-0 bg-[#121212] p-6 text-white">
          <div className="absolute -right-10 -top-10 h-40 w-40 rounded-full bg-[#76BC21]/30 blur-2xl" aria-hidden />
          <Compass className="relative h-8 w-8 text-[#76BC21]" />
          <h2 className="relative mt-3 text-xl font-extrabold">Get coached by CareerNiche</h2>
          <p className="relative mt-1 text-sm text-white/70">Resume reviews, mock interviews and one-on-one coaching — from people who know local employers.</p>
          <Link to="/app/hub" className="relative mt-5 inline-flex items-center gap-2 rounded-xl bg-[#76BC21] px-4 py-2.5 text-sm font-bold text-[#121212] hover:brightness-105">
            Explore the Hub <ArrowRight className="h-4 w-4" />
          </Link>
        </Card>
      </div>
    </div>
  );
}

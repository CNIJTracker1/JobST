import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Link, NavLink, Outlet, useLocation, useNavigate } from "react-router-dom";
import {
  BarChart3, Bell, CalendarClock, Coins, Compass, Home, KanbanSquare, LogOut, Plus, Settings as SettingsIcon, Sprout, Users,
} from "lucide-react";
import { useAuth } from "@/context/AuthContext";
import { api } from "@/lib/api";
import { celebrate } from "@/lib/celebrate";
import { cn, relativeDay } from "@/lib/utils";
import { applyTheme } from "@/lib/themes";
import { Avatar, Button } from "@/components/ui";
import Logo from "@/components/Logo";
import JobFormDialog from "./JobFormDialog";
import { ShellContext } from "./ShellContext";

const NAV = [
  { to: "/app", label: "Home", icon: Home, end: true },
  { to: "/app/board", label: "Board", icon: KanbanSquare },
  { to: "/app/network", label: "Network", icon: Users },
  { to: "/app/growth", label: "Growth", icon: Sprout },
  { to: "/app/analytics", label: "Analytics", icon: BarChart3 },
  { to: "/app/hub", label: "CareerNiche Hub", short: "Hub", icon: Compass },
  { to: "/app/settings", label: "Settings", icon: SettingsIcon },
];
const MOBILE_NAV = ["/app", "/app/board", "/app/network", "/app/growth", "/app/hub"];

function useDailyReminder(settings) {
  // Browser stand-in for flutter_local_notifications: fires while a tab is open.
  useEffect(() => {
    if (!settings?.daily_reminder || typeof Notification === "undefined" || Notification.permission !== "granted") return;
    const [h, m] = (settings.reminder_time || "09:00").split(":").map(Number);
    const next = new Date();
    next.setHours(h, m, 0, 0);
    if (next <= new Date()) next.setDate(next.getDate() + 1);
    const t = setTimeout(() => {
      try {
        new Notification("Time to job hunt! 🚀", { body: "Your next opportunity is waiting — log an application or reach out to a contact today." });
      } catch { /* some browsers need a service worker */ }
    }, next - new Date());
    return () => clearTimeout(t);
  }, [settings?.daily_reminder, settings?.reminder_time]);
}

function NotificationsMenu() {
  const [open, setOpen] = useState(false);
  const [items, setItems] = useState(null);
  const ref = useRef(null);
  const navigate = useNavigate();

  useEffect(() => {
    api.get("/notifications").then((r) => setItems(r.data.items)).catch(() => setItems([]));
  }, []);
  useEffect(() => {
    if (!open) return;
    const close = (e) => ref.current && !ref.current.contains(e.target) && setOpen(false);
    const esc = (e) => e.key === "Escape" && setOpen(false);
    document.addEventListener("mousedown", close);
    document.addEventListener("keydown", esc);
    return () => {
      document.removeEventListener("mousedown", close);
      document.removeEventListener("keydown", esc);
    };
  }, [open]);

  const count = items?.length || 0;
  const go = (it) => {
    setOpen(false);
    navigate(it.job_id ? `/app/jobs/${it.job_id}` : "/app/network");
  };
  return (
    <div className="relative" ref={ref}>
      <Button variant="ghost" size="icon" aria-label={`Reminders${count ? `, ${count} new` : ""}`} aria-expanded={open} onClick={() => setOpen((o) => !o)}>
        <Bell className="h-5 w-5" />
        {count > 0 && <span className="absolute right-1.5 top-1.5 h-2.5 w-2.5 rounded-full bg-red-500 ring-2 ring-surface" />}
      </Button>
      {open && (
        <div className="absolute right-0 z-40 mt-2 w-[min(22rem,calc(100vw-2rem))] rounded-2xl border border-line bg-surface p-2 shadow-lift animate-fade-up">
          <div className="flex items-center justify-between px-3 py-2">
            <p className="font-bold">Reminders</p>
            <span className="text-xs text-ink-muted">Next 7 days</span>
          </div>
          {!count ? (
            <p className="px-3 pb-4 pt-1 text-sm text-ink-muted">You're all caught up. 🎉</p>
          ) : (
            <ul className="max-h-80 overflow-y-auto scrollbar-thin">
              {items.map((it) => (
                <li key={it.id}>
                  <button onClick={() => go(it)} className="flex w-full items-start gap-3 rounded-xl px-3 py-2.5 text-left hover:bg-surface-2">
                    <span className={cn("mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg",
                      it.kind === "interview" ? "bg-green-100 text-green-700" : it.kind === "follow_up" ? "bg-amber-100 text-amber-700" : "bg-sky-100 text-sky-700")}>
                      {it.kind === "interview" ? <CalendarClock className="h-4 w-4" /> : it.kind === "follow_up" ? <Bell className="h-4 w-4" /> : <Users className="h-4 w-4" />}
                    </span>
                    <span className="min-w-0">
                      <span className="block truncate text-sm font-semibold">{it.title}</span>
                      <span className="block truncate text-xs text-ink-muted">{it.body}</span>
                      {it.kind !== "follow_up" && <span className={cn("text-xs font-semibold", it.overdue ? "text-red-600" : "text-primary")}>{it.overdue ? "Overdue" : relativeDay(it.at)}</span>}
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}

export default function AppShell() {
  const { user, logout, setTokens } = useAuth();
  const [jobForm, setJobForm] = useState({ open: false, job: null, status: null });
  const [refreshKey, setRefreshKey] = useState(0);
  const location = useLocation();
  const navigate = useNavigate();
  useDailyReminder(user?.settings);

  useEffect(() => window.scrollTo(0, 0), [location.pathname]);
  // Re-apply the user's theme when entering the app (the landing page uses brand colors)
  useEffect(() => {
    if (user?.settings) applyTheme(user.settings);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const bump = useCallback(() => setRefreshKey((k) => k + 1), []);
  const handleRewards = useCallback(
    (rewards) => {
      celebrate(rewards);
      if (rewards?.tokens != null) setTokens(rewards.tokens);
    },
    [setTokens]
  );
  const openJobForm = useCallback((job = null, status = null) => setJobForm({ open: true, job, status }), []);
  const ctx = useMemo(() => ({ openJobForm, refreshKey, bump, handleRewards }), [openJobForm, refreshKey, bump, handleRewards]);

  const onSaved = (data) => {
    handleRewards(data.rewards);
    bump();
  };

  return (
    <ShellContext.Provider value={ctx}>
      <a href="#main" className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-50 focus:rounded-lg focus:bg-surface focus:px-4 focus:py-2">Skip to content</a>
      <div className="min-h-screen bg-bg lg:pl-64">
        {/* Desktop sidebar */}
        <aside className="fixed inset-y-0 left-0 z-30 hidden w-64 flex-col border-r border-line bg-surface lg:flex">
          <div className="px-5 py-5"><Logo to="/app" sub="Job Tracker" /></div>
          <div className="px-4">
            <Button className="w-full" onClick={() => openJobForm()}><Plus className="h-4 w-4" /> Add job</Button>
          </div>
          <nav className="mt-4 flex-1 space-y-1 px-3" aria-label="Main">
            {NAV.map(({ to, label, icon: Icon, end }) => (
              <NavLink key={to} to={to} end={end}
                className={({ isActive }) => cn("flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-semibold transition",
                  isActive ? "bg-primary-soft text-primary" : "text-ink-muted hover:bg-surface-2 hover:text-ink")}>
                <Icon className="h-[1.15rem] w-[1.15rem]" /> {label}
              </NavLink>
            ))}
          </nav>
          <div className="m-3 rounded-2xl bg-surface-2 p-3">
            <div className="flex items-center gap-3">
              <Avatar name={user?.username} src={user?.avatar} size={38} />
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-bold">{user?.username}</p>
                <p className="flex items-center gap-1 text-xs font-semibold text-ink-muted"><Coins className="h-3.5 w-3.5 text-amber-500" /> {user?.tokens ?? 0} tokens</p>
              </div>
              <Button variant="ghost" size="icon" onClick={() => { logout(); navigate("/"); }} aria-label="Log out"><LogOut className="h-4 w-4" /></Button>
            </div>
          </div>
        </aside>

        {/* Top bar */}
        <header className="sticky top-0 z-20 border-b border-line bg-surface/85 backdrop-blur-md">
          <div className="flex h-16 items-center justify-between gap-3 px-4 sm:px-6">
            <div className="lg:hidden"><Logo to="/app" /></div>
            <div className="hidden lg:block text-sm text-ink-muted">
              Not another job board — <span className="font-semibold text-ink">your career community.</span>
            </div>
            <div className="flex items-center gap-1.5">
              <Link to="/app/growth?tab=city" className="flex items-center gap-1.5 rounded-full bg-amber-50 px-3 py-1.5 text-sm font-bold text-amber-700 dark:bg-amber-500/15 dark:text-amber-300" aria-label={`${user?.tokens ?? 0} tokens`}>
                <Coins className="h-4 w-4" /> {user?.tokens ?? 0}
              </Link>
              <NotificationsMenu key={refreshKey} />
              <Link to="/app/settings" className="lg:hidden rounded-full focus-visible:ring-2 focus-visible:ring-primary/50" aria-label="Settings">
                <Avatar name={user?.username} src={user?.avatar} size={34} />
              </Link>
            </div>
          </div>
        </header>

        <main id="main" className="px-4 pb-28 pt-6 sm:px-6 lg:pb-10">
          <div className="mx-auto max-w-6xl">
            <Outlet />
          </div>
        </main>

        {/* Mobile FAB + bottom nav */}
        <button onClick={() => openJobForm()} aria-label="Add job"
          className="fixed bottom-20 right-4 z-30 flex h-14 w-14 items-center justify-center rounded-2xl bg-primary text-primary-fg shadow-lift active:scale-95 lg:hidden">
          <Plus className="h-6 w-6" />
        </button>
        <nav className="fixed inset-x-0 bottom-0 z-30 border-t border-line bg-surface/95 backdrop-blur-md safe-bottom lg:hidden" aria-label="Main">
          <div className="grid grid-cols-5">
            {NAV.filter((n) => MOBILE_NAV.includes(n.to)).map(({ to, label, short, icon: Icon, end }) => (
              <NavLink key={to} to={to} end={end}
                className={({ isActive }) => cn("flex flex-col items-center gap-0.5 py-2.5 text-[11px] font-semibold", isActive ? "text-primary" : "text-ink-muted")}>
                {({ isActive }) => (
                  <>
                    <span className={cn("rounded-full px-4 py-1 transition", isActive && "bg-primary-soft")}><Icon className="h-5 w-5" /></span>
                    {short || label}
                  </>
                )}
              </NavLink>
            ))}
          </div>
        </nav>
      </div>

      <JobFormDialog open={jobForm.open} job={jobForm.job} defaultStatus={jobForm.status} onClose={() => setJobForm((f) => ({ ...f, open: false }))} onSaved={onSaved} />
    </ShellContext.Provider>
  );
}

export function PageHeader({ title, subtitle, actions, eyebrow }) {
  return (
    <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
      <div>
        {eyebrow && <p className="eyebrow mb-1">{eyebrow}</p>}
        <h1 className="text-2xl font-extrabold sm:text-3xl">{title}</h1>
        {subtitle && <p className="mt-1 text-ink-muted">{subtitle}</p>}
      </div>
      {actions && <div className="flex flex-wrap gap-2">{actions}</div>}
    </div>
  );
}


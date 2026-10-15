import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { toast } from "sonner";
import { Bar, BarChart, CartesianGrid, Legend, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { BarChart3, Mail } from "lucide-react";
import { useAuth } from "@/context/AuthContext";
import { api, errorMessage } from "@/lib/api";
import { PIPELINE, STATUS_META } from "@/lib/constants";
import { fmtDate } from "@/lib/utils";
import { Button, Card, Dialog, EmptyState, PageLoader, Ring, Stars } from "@/components/ui";
import { PageHeader } from "@/components/app/AppShell";
import { useShell } from "@/components/app/ShellContext";
import StatusPill from "@/components/app/StatusPill";

const cssColor = (name) => {
  const [r, g, b] = (getComputedStyle(document.documentElement).getPropertyValue(name).trim() || "118 188 33").split(/\s+/);
  return `rgb(${r},${g},${b})`;
};

function Metric({ label, value, hint }) {
  return (
    <Card className="p-5">
      <p className="text-sm font-semibold text-ink-muted">{label}</p>
      <p className="mt-1 text-3xl font-extrabold">{value == null ? "N/A" : `${value}%`}</p>
      <p className="mt-0.5 text-xs text-ink-faint">{hint}</p>
    </Card>
  );
}

export default function Analytics() {
  const { user } = useAuth();
  const { refreshKey } = useShell();
  const [data, setData] = useState(null);
  const [preview, setPreview] = useState(null);
  const [sending, setSending] = useState(false);
  useEffect(() => { api.get("/analytics").then((r) => setData(r.data)); }, [refreshKey]);
  // Read theme colors at render time (theme vars are applied by a parent effect)
  const colors = { primary: cssColor("--primary"), accent: cssColor("--accent"), grid: cssColor("--line"), ink: cssColor("--ink-muted") };

  if (!data) return <PageLoader />;
  if (!data.total) return (
    <div>
      <PageHeader title="Analytics" />
      <EmptyState icon={BarChart3} title="No data yet" message="Add a few jobs and your progress charts will appear here." action={<Link to="/app/board"><Button>Go to board</Button></Link>} />
    </div>
  );

  const maxFunnel = Math.max(...PIPELINE.map((s) => data.funnel[s]), 1);
  const weekly = data.weekly.map((w) => ({ ...w, label: fmtDate(w.week_start) }));

  const openPreview = async () => {
    try {
      const { data: html } = await api.get("/reports/weekly/preview", { responseType: "text" });
      setPreview(html);
    } catch (err) {
      toast.error(errorMessage(err));
    }
  };
  const sendNow = async () => {
    setSending(true);
    try {
      const { data: res } = await api.post("/reports/weekly/send");
      res.sent ? toast.success("Weekly report sent to your inbox") : toast.info(res.message);
    } finally {
      setSending(false);
    }
  };

  return (
    <div className="space-y-5">
      <PageHeader title="Analytics" subtitle="See what's working so you can do more of it." actions={<Button variant="secondary" onClick={openPreview}><Mail className="h-4 w-4" /> Weekly report</Button>} />

      <div className="grid gap-5 lg:grid-cols-3">
        <Card className="flex flex-col items-center justify-center p-6 text-center">
          <p className="text-sm font-semibold text-ink-muted">Overall progress</p>
          <div className="my-4"><Ring value={data.overall_progress || 0} max={100} size={140} stroke={12}><span className="text-3xl font-extrabold">{data.overall_progress ?? 0}%</span></Ring></div>
          <p className="text-sm text-ink-muted">of {data.total} tracked jobs reached <b className="text-ink">Applied</b> or beyond</p>
        </Card>
        <div className="grid grid-cols-2 gap-4 lg:col-span-2">
          <Metric label="Response rate" value={data.response_rate} hint="Applied → interviewed" />
          <Metric label="Conversion rate" value={data.conversion_rate} hint="Applied → offered" />
          <Metric label="Interview rate" value={data.interview_rate} hint="Of all tracked jobs" />
          <Metric label="Offer rate" value={data.offer_rate} hint={`${data.offers_accepted} offer${data.offers_accepted === 1 ? "" : "s"} accepted`} />
        </div>
      </div>

      <Card className="p-5 sm:p-6">
        <h2 className="mb-4 text-lg font-bold">Weekly activity</h2>
        <div className="h-72">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={weekly} margin={{ top: 4, right: 4, left: -18, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke={colors.grid} />
              <XAxis dataKey="label" tick={{ fontSize: 12, fill: colors.ink }} axisLine={false} tickLine={false} />
              <YAxis allowDecimals={false} tick={{ fontSize: 12, fill: colors.ink }} axisLine={false} tickLine={false} />
              <Tooltip cursor={{ fill: colors.grid, opacity: 0.4 }} contentStyle={{ borderRadius: 12, border: "none", boxShadow: "0 8px 24px rgba(0,0,0,.12)" }} />
              <Legend iconType="circle" wrapperStyle={{ fontSize: 12 }} />
              <Bar dataKey="applications" name="Applications" fill={colors.primary} radius={[6, 6, 0, 0]} />
              <Bar dataKey="interviews" name="Interviews" fill="#2E7D32" radius={[6, 6, 0, 0]} />
              <Bar dataKey="networking" name="Networking" fill={colors.accent} radius={[6, 6, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </Card>

      <div className="grid gap-5 lg:grid-cols-2">
        <Card className="p-5 sm:p-6">
          <h2 className="text-lg font-bold">Pipeline funnel</h2>
          <p className="mb-4 text-sm text-ink-muted">How many jobs ever reached each stage</p>
          <div className="space-y-3">
            {PIPELINE.map((s) => (
              <div key={s}>
                <div className="mb-1 flex justify-between text-sm"><span className="font-semibold">{s}</span><span className="font-bold tabular-nums">{data.funnel[s]}</span></div>
                <div className="h-3 overflow-hidden rounded-full bg-surface-2">
                  <div className="h-full rounded-full transition-[width] duration-700" style={{ width: `${(data.funnel[s] / maxFunnel) * 100}%`, background: STATUS_META[s].color }} />
                </div>
              </div>
            ))}
          </div>
        </Card>
        <Card className="p-5 sm:p-6">
          <h2 className="text-lg font-bold">Current status breakdown</h2>
          <div className="my-4 flex h-4 overflow-hidden rounded-full" aria-hidden>
            {Object.entries(data.by_status).map(([s, n]) => n > 0 && <div key={s} style={{ flex: n, background: STATUS_META[s].color }} />)}
          </div>
          <ul className="grid grid-cols-2 gap-2 text-sm">
            {Object.entries(data.by_status).map(([s, n]) => (
              <li key={s} className="flex items-center justify-between rounded-xl bg-surface-2 px-3 py-2">
                <span className="flex items-center gap-2"><span className="h-2.5 w-2.5 rounded-full" style={{ background: STATUS_META[s].color }} />{s}</span><b>{n}</b>
              </li>
            ))}
            <li className="col-span-2 flex items-center justify-between rounded-xl border border-line px-3 py-2"><span className="font-semibold">Total jobs</span><b>{data.total}</b></li>
          </ul>
        </Card>
      </div>

      <Card className="p-5 sm:p-6">
        <h2 className="mb-3 text-lg font-bold">Top priority applications</h2>
        <ul className="divide-y divide-line">
          {data.top_priority.map((j) => (
            <li key={j.id}>
              <Link to={`/app/jobs/${j.id}`} className="flex items-center gap-3 py-3 hover:opacity-80">
                <div className="min-w-0 flex-1"><p className="truncate font-semibold">{j.job_name}</p><p className="truncate text-sm text-ink-muted">{j.company_name}</p></div>
                <Stars value={j.priority_score} /><StatusPill status={j.status} />
              </Link>
            </li>
          ))}
        </ul>
      </Card>

      <Dialog open={!!preview} onClose={() => setPreview(null)} title="Weekly report preview" description={`Emailed every ${["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"][user.settings.report_day ?? 1]} when enabled in Settings.`} size="lg"
        footer={<><Button variant="outline" onClick={() => setPreview(null)}>Close</Button><Button onClick={sendNow} loading={sending}><Mail className="h-4 w-4" /> Email it to me</Button></>}>
        {preview && <iframe title="Weekly report" srcDoc={preview} className="h-[60vh] w-full rounded-xl border border-line bg-white" sandbox="" />}
      </Dialog>
    </div>
  );
}

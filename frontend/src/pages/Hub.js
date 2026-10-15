import { useEffect, useState } from "react";
import { toast } from "sonner";
import {
  ArrowRight, BellRing, Check, Compass, DollarSign, ExternalLink, FileText, GraduationCap, LayoutTemplate, Lightbulb, Linkedin, Mail,
  MessagesSquare, Mic, PenLine, Users, BookOpen,
} from "lucide-react";
import { api, errorMessage } from "@/lib/api";
import { CAREERNICHE_CLUB_URL } from "@/lib/constants";
import { cn } from "@/lib/utils";
import { Badge, Button, Card, PageLoader } from "@/components/ui";
import { PageHeader } from "@/components/app/AppShell";

const ICONS = { FileText, Mic, PenLine, Linkedin, Users, Compass, LayoutTemplate, MessagesSquare, DollarSign, GraduationCap, Mail, Lightbulb };

export default function Hub() {
  const [hub, setHub] = useState(null);
  useEffect(() => { api.get("/hub").then((r) => setHub(r.data)); }, []);
  if (!hub) return <PageLoader />;

  const notify = async (item, kind) => {
    try {
      await api.post("/hub/notify", { item_id: item.id, kind });
      setHub((h) => {
        const key = kind === "service" ? "services" : kind === "resource" ? "resources" : "articles";
        return { ...h, [key]: h[key].map((x) => (x.id === item.id ? { ...x, notify: true } : x)) };
      });
      toast.success("We'll let you know as soon as it's live");
    } catch (err) {
      toast.error(errorMessage(err));
    }
  };
  const visit = async () => {
    window.open(hub.website, "_blank", "noopener");
    const { data } = await api.post("/themes/careerniche/visit");
    if (data.unlocked) toast.success("🟢 CareerNiche theme unlocked! Apply it in Growth → Rewards.");
  };

  const NotifyBtn = ({ item, kind }) =>
    item.notify ? (
      <Badge className="bg-primary-soft text-primary"><Check className="h-3.5 w-3.5" /> On the list</Badge>
    ) : (
      <Button size="sm" variant="secondary" onClick={() => notify(item, kind)}><BellRing className="h-3.5 w-3.5" /> Notify me</Button>
    );

  return (
    <div className="space-y-8">
      <PageHeader eyebrow="CareerNiche Hub" title="Coaching, resources and community" subtitle="You don't have to job search alone. Book help from CareerNiche coaches and learn from people who hire." />

      <Card className="relative overflow-hidden border-0 bg-[#121212] p-6 text-white sm:p-8">
        <div className="absolute -right-16 -top-16 h-64 w-64 rounded-full bg-[#76BC21]/25 blur-3xl" aria-hidden />
        <div className="relative flex flex-col gap-5 md:flex-row md:items-center md:justify-between">
          <div className="max-w-xl">
            <Badge className="bg-[#76BC21] text-[#121212]">CareerNiche Club</Badge>
            <h2 className="mt-3 text-2xl font-extrabold sm:text-3xl">Meet the businesses hiring in your community</h2>
            <p className="mt-2 text-white/70">Workshops, recruiter connections, job postings from partner businesses and a community that has your back.</p>
          </div>
          <div className="flex flex-wrap gap-2">
            <a href={CAREERNICHE_CLUB_URL} target="_blank" rel="noreferrer"><Button variant="brand">Join the Club <ArrowRight className="h-4 w-4" /></Button></a>
            <Button variant="outline" className="border-white/20 bg-transparent text-white hover:bg-white/10" onClick={visit}><ExternalLink className="h-4 w-4" /> careerniche.ca</Button>
          </div>
        </div>
      </Card>

      <section>
        <h2 className="mb-1 text-xl font-bold">Services</h2>
        <p className="mb-4 text-sm text-ink-muted">Online booking is coming soon — tap “Notify me” and we'll reach out.</p>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {hub.services.map((s) => {
            const Icon = ICONS[s.icon] || Compass;
            return (
              <Card key={s.id} className="flex flex-col p-5 transition hover:-translate-y-0.5 hover:shadow-lift">
                <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-primary-soft text-primary"><Icon className="h-6 w-6" /></div>
                <h3 className="mt-4 font-bold">{s.title}</h3>
                <p className="mt-1 flex-1 text-sm text-ink-muted">{s.subtitle}</p>
                <div className="mt-4 flex items-center justify-between"><span className="text-xs font-semibold text-ink-faint">Coming soon</span><NotifyBtn item={s} kind="service" /></div>
              </Card>
            );
          })}
        </div>
      </section>

      <section>
        <h2 className="mb-4 text-xl font-bold">Featured articles</h2>
        <div className="-mx-4 flex snap-x gap-4 overflow-x-auto px-4 pb-2 scrollbar-thin sm:mx-0 sm:px-0">
          {hub.articles.map((a, i) => (
            <Card key={a.id} className="w-[80vw] max-w-sm shrink-0 snap-start overflow-hidden p-0 sm:w-80">
              <div className={cn("flex h-28 items-end p-4", ["bg-gradient-to-br from-[#76BC21] to-[#385510]", "bg-gradient-to-br from-[#4A8C8E] to-[#1F3B4D]", "bg-gradient-to-br from-[#C49C48] to-[#7a5b1c]"][i % 3])}>
                <Badge className="bg-white/90 text-[#121212]">{a.tag}</Badge>
              </div>
              <div className="p-4">
                <h3 className="font-bold leading-snug">{a.title}</h3>
                <div className="mt-3 flex items-center justify-between">
                  <span className="flex items-center gap-1 text-xs text-ink-muted"><BookOpen className="h-3.5 w-3.5" />{a.read_minutes} min read</span>
                  <NotifyBtn item={a} kind="article" />
                </div>
              </div>
            </Card>
          ))}
        </div>
      </section>

      <section>
        <h2 className="mb-4 text-xl font-bold">Resources</h2>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {hub.resources.map((r) => {
            const Icon = ICONS[r.icon] || Lightbulb;
            return (
              <Card key={r.id} className="flex items-center gap-4 p-4">
                <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-surface-2 text-primary"><Icon className="h-5 w-5" /></div>
                <div className="min-w-0 flex-1"><p className="font-bold">{r.title}</p><p className="truncate text-sm text-ink-muted">{r.subtitle}</p></div>
                <NotifyBtn item={r} kind="resource" />
              </Card>
            );
          })}
        </div>
      </section>
    </div>
  );
}

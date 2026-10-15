import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";
import { ArrowLeft, ArrowRight, Database, Sparkles, Target } from "lucide-react";
import { useAuth } from "@/context/AuthContext";
import { api, errorMessage } from "@/lib/api";
import { applyBrand } from "@/lib/themes";
import { cn } from "@/lib/utils";
import { Button, Input } from "@/components/ui";
import Logo from "@/components/Logo";

const ROLES = ["Web Developer", "Mobile Developer", "Designer", "Data Analyst", "Marketing", "Customer Service", "Healthcare", "Trades"];

export default function Onboarding() {
  const { user, updateSettings } = useAuth();
  const navigate = useNavigate();
  const [step, setStep] = useState(0);
  const [role, setRole] = useState(user?.settings?.target_role || "");
  const [goal, setGoal] = useState(user?.settings?.weekly_application_goal || 10);
  const [demo, setDemo] = useState(true);
  const [saving, setSaving] = useState(false);
  useEffect(() => applyBrand(), []);

  const finish = async () => {
    setSaving(true);
    try {
      if (demo) await api.post("/demo/seed");
      await updateSettings({ target_role: role.trim(), weekly_application_goal: Number(goal), onboarded: true });
      toast.success("You're all set! Your first missions are live.");
      navigate("/app", { replace: true });
    } catch (err) {
      toast.error(errorMessage(err));
    } finally {
      setSaving(false);
    }
  };

  const steps = [
    {
      icon: Sparkles,
      title: `Welcome, ${user?.username}! What role are you aiming for?`,
      sub: "We'll use this to personalise your dashboard. You can change it anytime.",
      body: (
        <>
          <Input value={role} onChange={(e) => setRole(e.target.value)} placeholder="e.g. Junior Web Developer" aria-label="Target role" className="h-12 bg-white text-base" />
          <div className="mt-4 flex flex-wrap gap-2">
            {ROLES.map((r) => (
              <button key={r} onClick={() => setRole(r)} className={cn("rounded-full border px-3.5 py-1.5 text-sm font-semibold transition", role === r ? "border-brand bg-brand text-brand-ink" : "border-black/10 bg-white hover:border-brand")}>{r}</button>
            ))}
          </div>
        </>
      ),
    },
    {
      icon: Target,
      title: "How many applications per week?",
      sub: "A steady pace beats a burnout sprint. This becomes your weekly Apply goal.",
      body: (
        <div className="rounded-3xl bg-white p-6 shadow-soft">
          <p className="text-center text-6xl font-extrabold text-brand-ink">{goal}</p>
          <p className="text-center text-sm font-semibold text-brand-charcoal">applications / week</p>
          <input type="range" min="3" max="30" value={goal} onChange={(e) => setGoal(e.target.value)} className="mt-6 w-full accent-[#76BC21]" aria-label="Weekly application goal" />
          <div className="mt-1 flex justify-between text-xs text-brand-charcoal"><span>3 · steady</span><span>30 · all in</span></div>
        </div>
      ),
    },
    {
      icon: Database,
      title: "Start fresh or explore with sample data?",
      sub: "Sample jobs and contacts help you see how everything works. Remove them anytime in Settings.",
      body: (
        <div className="grid gap-3 sm:grid-cols-2">
          {[
            { v: true, t: "Load sample data", d: "10 jobs, 4 contacts and upcoming interviews" },
            { v: false, t: "Start empty", d: "I'll add my own jobs right away" },
          ].map((o) => (
            <button key={String(o.v)} onClick={() => setDemo(o.v)} className={cn("rounded-2xl border-2 bg-white p-5 text-left transition", demo === o.v ? "border-brand shadow-soft" : "border-transparent hover:border-black/10")} aria-pressed={demo === o.v}>
              <p className="font-bold text-brand-ink">{o.t}</p>
              <p className="mt-1 text-sm text-brand-charcoal">{o.d}</p>
            </button>
          ))}
        </div>
      ),
    },
  ];
  const s = steps[step];
  const last = step === steps.length - 1;

  return (
    <div className="min-h-screen bg-brand-cream px-5 py-6 sm:px-10">
      <Logo />
      <div className="mx-auto max-w-xl py-12 sm:py-20">
        <div className="mb-8 flex gap-2" aria-label={`Step ${step + 1} of ${steps.length}`}>
          {steps.map((_, i) => <span key={i} className={cn("h-1.5 flex-1 rounded-full transition", i <= step ? "bg-brand" : "bg-black/10")} />)}
        </div>
        <div key={step} className="animate-fade-up">
          <div className="mb-5 flex h-14 w-14 items-center justify-center rounded-2xl bg-brand text-brand-ink"><s.icon className="h-7 w-7" /></div>
          <h1 className="text-3xl font-extrabold text-brand-ink">{s.title}</h1>
          <p className="mt-2 text-brand-charcoal">{s.sub}</p>
          <div className="mt-8">{s.body}</div>
        </div>
        <div className="mt-10 flex items-center justify-between">
          {step > 0 ? <Button variant="ghost" onClick={() => setStep(step - 1)}><ArrowLeft className="h-4 w-4" /> Back</Button> : <span />}
          <Button variant="brand" size="lg" loading={saving} onClick={() => (last ? finish() : setStep(step + 1))}>
            {last ? "Let's go" : "Continue"} <ArrowRight className="h-4 w-4" />
          </Button>
        </div>
      </div>
    </div>
  );
}

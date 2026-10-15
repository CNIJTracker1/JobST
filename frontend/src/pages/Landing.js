import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { toast } from "sonner";
import {
  ArrowRight, BarChart3, Briefcase, Building2, Check, ChevronDown, Coffee, FileText, Handshake, HeartHandshake, KanbanSquare,
  Linkedin, Mail, Menu, MessageCircle, Mic, PenLine, Sparkles, Sprout, Target, Trophy, Users, X, Compass, Instagram, Facebook,
} from "lucide-react";
import { useAuth } from "@/context/AuthContext";
import { api, errorMessage } from "@/lib/api";
import { applyBrand } from "@/lib/themes";
import { CAREERNICHE_CLUB_URL, CAREERNICHE_URL } from "@/lib/constants";
import { cn } from "@/lib/utils";
import { Avatar, Button, Field, Input, Select, Textarea } from "@/components/ui";
import Logo from "@/components/Logo";

const NAV_LINKS = [
  { href: "#seekers", label: "For Job Seekers" },
  { href: "#businesses", label: "For Businesses" },
  { href: "#how", label: "How It Works" },
  { href: "#community", label: "Community" },
  { href: "#faq", label: "FAQ" },
];

/* ── Hero visual: a live-looking slice of the app ─────────────────────────── */
function HeroPreview() {
  return (
    <div className="relative mx-auto w-full max-w-[34rem]" aria-hidden>
      <div className="absolute -inset-6 rounded-[2.5rem] bg-gradient-to-br from-brand/25 via-brand-mint to-transparent blur-2xl" />
      <div className="relative rounded-3xl border border-black/5 bg-white p-4 shadow-lift sm:p-5">
        <div className="mb-4 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="h-2.5 w-2.5 rounded-full bg-red-300" /><span className="h-2.5 w-2.5 rounded-full bg-amber-300" /><span className="h-2.5 w-2.5 rounded-full bg-green-300" />
          </div>
          <span className="rounded-full bg-brand-mint px-2.5 py-1 text-[11px] font-bold text-brand-dark">This week: 7 applications</span>
        </div>
        <div className="grid grid-cols-2 gap-3">
          {[
            { name: "Applied", color: "#7B1FA2" },
            { name: "Interviewed", color: "#2E7D32" },
          ].map((col) => (
            <div key={col.name} className="rounded-2xl bg-[#F4F6F1] p-2.5">
              <p className="mb-2 flex items-center gap-1.5 px-1 text-[11px] font-bold" style={{ color: col.color }}>
                <span className="h-1.5 w-1.5 rounded-full" style={{ background: col.color }} /> {col.name}
              </p>
              <div className="space-y-2">
                {col.name === "Applied" ? (
                  <>
                    <div className="relative z-10 animate-slide-card rounded-xl border border-black/5 bg-white p-2.5 shadow-soft">
                      <p className="text-[12px] font-bold text-brand-ink">Junior Web Developer</p>
                      <p className="text-[11px] text-brand-charcoal">Northshore Digital</p>
                      <p className="mt-1 text-[11px] text-amber-500">★★★★★</p>
                    </div>
                    <div className="rounded-xl border border-black/5 bg-white p-2.5 opacity-80">
                      <p className="text-[12px] font-bold text-brand-ink">iOS Developer</p>
                      <p className="text-[11px] text-brand-charcoal">Red Pine Mobile</p>
                    </div>
                  </>
                ) : (
                  <>
                    <div className="h-[70px] rounded-xl border-2 border-dashed border-green-200" />
                    <div className="rounded-xl border border-black/5 bg-white p-2.5 opacity-80">
                      <p className="text-[12px] font-bold text-brand-ink">Mobile App Intern</p>
                      <p className="text-[11px] text-brand-charcoal">Lighthouse Learning</p>
                    </div>
                  </>
                )}
              </div>
            </div>
          ))}
        </div>
        <div className="mt-3 flex items-center gap-3 rounded-2xl border border-black/5 bg-white p-3">
          <Avatar name="Priya Nair" size={36} />
          <div className="min-w-0 flex-1">
            <p className="text-[12px] font-bold text-brand-ink">Priya Nair · Engineering Manager</p>
            <p className="text-[11px] text-brand-charcoal">Coffee chat Tues · linked to Northshore Digital</p>
          </div>
          <Coffee className="h-4 w-4 text-brand-dark" />
        </div>
      </div>
      {/* Floating chips */}
      <div className="absolute -right-2 -top-4 animate-float rounded-2xl bg-brand-ink px-3.5 py-2 text-sm font-bold text-white shadow-lift sm:-right-6">
        <span className="text-brand">+50 pts</span> Interview Ready ✓
      </div>
      <div className="absolute -bottom-5 -left-2 animate-float rounded-2xl border border-black/5 bg-white px-3.5 py-2 text-sm font-semibold text-brand-ink shadow-lift [animation-delay:1.2s] sm:-left-8">
        🎤 Coach session booked
      </div>
    </div>
  );
}

/* ── Small building blocks ────────────────────────────────────────────────── */
const SectionTitle = ({ eyebrow, title, sub, center }) => (
  <div className={cn("max-w-2xl", center && "mx-auto text-center")}>
    <p className="text-xs font-bold uppercase tracking-[0.14em] text-brand-dark">{eyebrow}</p>
    <h2 className="mt-2 text-3xl font-extrabold text-brand-ink sm:text-4xl">{title}</h2>
    {sub && <p className="mt-3 text-lg text-brand-charcoal">{sub}</p>}
  </div>
);

function Feature({ icon: Icon, title, text }) {
  return (
    <div className="group rounded-3xl border border-black/5 bg-white p-6 shadow-soft transition hover:-translate-y-1 hover:shadow-lift">
      <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-2xl bg-brand-mint text-brand-dark transition group-hover:bg-brand group-hover:text-brand-ink">
        <Icon className="h-6 w-6" />
      </div>
      <h3 className="text-lg font-bold text-brand-ink">{title}</h3>
      <p className="mt-1.5 text-[15px] leading-relaxed text-brand-charcoal">{text}</p>
    </div>
  );
}

function FaqItem({ q, a }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="rounded-2xl border border-black/5 bg-white">
      <button className="flex w-full items-center justify-between gap-4 px-5 py-4 text-left font-bold text-brand-ink" aria-expanded={open} onClick={() => setOpen(!open)}>
        {q}
        <ChevronDown className={cn("h-5 w-5 shrink-0 transition", open && "rotate-180")} />
      </button>
      {open && <p className="px-5 pb-5 -mt-1 text-brand-charcoal leading-relaxed">{a}</p>}
    </div>
  );
}

function LeadForm() {
  const [form, setForm] = useState({ name: "", email: "", company: "", kind: "business", message: "" });
  const [sending, setSending] = useState(false);
  const [done, setDone] = useState(false);
  const set = (k) => (e) => setForm({ ...form, [k]: e.target.value });
  const submit = async (e) => {
    e.preventDefault();
    if (!form.name || !form.email) return toast.error("Add your name and email");
    setSending(true);
    try {
      await api.post("/leads", form);
      setDone(true);
    } catch (err) {
      toast.error(errorMessage(err));
    } finally {
      setSending(false);
    }
  };
  if (done)
    return (
      <div className="rounded-3xl bg-white p-8 text-center text-brand-ink">
        <div className="mx-auto mb-3 flex h-14 w-14 items-center justify-center rounded-full bg-brand-mint text-brand-dark animate-pop"><Check className="h-7 w-7" /></div>
        <h3 className="text-xl font-bold">Thanks — we'll be in touch!</h3>
        <p className="mt-1 text-brand-charcoal">A CareerNiche team member will reach out within two business days.</p>
      </div>
    );
  return (
    <form onSubmit={submit} className="grid gap-4 rounded-3xl bg-white p-6 text-brand-ink shadow-lift sm:grid-cols-2 sm:p-8">
      <Field label="Your name" required>{(id) => <Input id={id} value={form.name} onChange={set("name")} autoComplete="name" />}</Field>
      <Field label="Work email" required>{(id) => <Input id={id} type="email" value={form.email} onChange={set("email")} autoComplete="email" />}</Field>
      <Field label="Company">{(id) => <Input id={id} value={form.company} onChange={set("company")} autoComplete="organization" />}</Field>
      <Field label="I'm a…">
        {(id) => (
          <Select id={id} value={form.kind} onChange={set("kind")}>
            <option value="business">Business / recruiter</option>
            <option value="seeker">Job seeker</option>
          </Select>
        )}
      </Field>
      <Field label="What are you hiring for?" className="sm:col-span-2">
        {(id) => <Textarea id={id} value={form.message} onChange={set("message")} placeholder="Roles, locations, timing…" />}
      </Field>
      <div className="sm:col-span-2">
        <Button type="submit" variant="brand" size="lg" loading={sending} className="w-full sm:w-auto">Partner with CareerNiche <ArrowRight className="h-4 w-4" /></Button>
      </div>
    </form>
  );
}

/* ── Page ─────────────────────────────────────────────────────────────────── */
export default function Landing() {
  const { user } = useAuth();
  const [menu, setMenu] = useState(false);
  useEffect(() => {
    applyBrand();
    document.title = "Job Search Tracker | CareerNiche";
  }, []);

  const primaryCta = user ? { to: "/app", label: "Open my tracker" } : { to: "/register", label: "Join free" };

  return (
    <div className="min-h-screen bg-brand-cream text-brand-ink">
      {/* Nav */}
      <header className="sticky top-0 z-40 border-b border-black/5 bg-brand-cream/85 backdrop-blur-md">
        <div className="container-page flex h-16 items-center justify-between">
          <Logo />
          <nav className="hidden items-center gap-7 lg:flex" aria-label="Primary">
            {NAV_LINKS.map((l) => <a key={l.href} href={l.href} className="text-sm font-semibold text-brand-charcoal hover:text-brand-ink">{l.label}</a>)}
          </nav>
          <div className="hidden items-center gap-2 sm:flex">
            {!user && <Link to="/login" className="px-3 text-sm font-semibold text-brand-charcoal hover:text-brand-ink">Log in</Link>}
            <Link to={primaryCta.to}><Button variant="brand">{primaryCta.label}</Button></Link>
          </div>
          <button className="rounded-xl p-2 lg:hidden" onClick={() => setMenu(!menu)} aria-label="Menu" aria-expanded={menu}>
            {menu ? <X className="h-6 w-6" /> : <Menu className="h-6 w-6" />}
          </button>
        </div>
        {menu && (
          <div className="border-t border-black/5 bg-brand-cream lg:hidden">
            <nav className="container-page flex flex-col py-3" aria-label="Mobile">
              {NAV_LINKS.map((l) => <a key={l.href} href={l.href} onClick={() => setMenu(false)} className="py-2.5 font-semibold">{l.label}</a>)}
              <div className="mt-2 flex gap-2 pb-2">
                {!user && <Link to="/login" className="flex-1"><Button variant="outline" className="w-full">Log in</Button></Link>}
                <Link to={primaryCta.to} className="flex-1"><Button variant="brand" className="w-full">{primaryCta.label}</Button></Link>
              </div>
            </nav>
          </div>
        )}
      </header>

      <main>
        {/* Hero */}
        <section className="relative overflow-hidden">
          <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_top_right,rgba(118,188,33,.18),transparent_55%)]" />
          <div className="container-page relative grid items-center gap-14 py-14 sm:py-20 lg:grid-cols-[1.05fr_1fr] lg:py-24">
            <div className="animate-fade-up">
              <span className="inline-flex items-center gap-2 rounded-full border border-brand/30 bg-white px-3 py-1 text-xs font-bold text-brand-dark">
                <Sparkles className="h-3.5 w-3.5" /> Built by CareerNiche · Made in Canada
              </span>
              <h1 className="mt-5 text-4xl font-extrabold leading-[1.05] sm:text-5xl lg:text-6xl">
                Not another job board.<br />
                <span className="relative whitespace-nowrap">
                  <span className="relative z-10">Your career community.</span>
                  <span className="absolute inset-x-0 bottom-1 -z-0 h-3 rounded bg-brand/40 sm:h-4" aria-hidden />
                </span>
              </h1>
              <p className="mt-5 max-w-xl text-lg leading-relaxed text-brand-charcoal sm:text-xl">
                Track every application, grow your network, and get coached by CareerNiche — all in one place. Where job seekers and businesses actually connect.
              </p>
              <div className="mt-8 flex flex-wrap gap-3">
                <Link to={primaryCta.to}><Button variant="brand" size="lg">{primaryCta.label} <ArrowRight className="h-4 w-4" /></Button></Link>
                <a href="#businesses"><Button variant="outline" size="lg" className="bg-white"><Building2 className="h-4 w-4" /> I'm hiring</Button></a>
              </div>
              <div className="mt-8 flex items-center gap-3">
                <div className="flex -space-x-2">
                  {["Ana R", "Jay K", "Mo S", "Lee T"].map((n) => <Avatar key={n} name={n} size={32} className="ring-2 ring-brand-cream" />)}
                </div>
                <p className="text-sm text-brand-charcoal"><span className="font-bold text-brand-ink">Free for job seekers.</span> Coaching and business partnerships through CareerNiche.</p>
              </div>
            </div>
            <HeroPreview />
          </div>
        </section>

        {/* Why we're different */}
        <section className="border-y border-black/5 bg-white">
          <div className="container-page grid gap-6 py-12 md:grid-cols-3">
            {[
              { k: "Job boards", v: "Apply into the void", icon: X, muted: true },
              { k: "CareerNiche", v: "Real connections with people who hire", icon: HeartHandshake },
              { k: "CareerNiche", v: "Real coaching and real progress you can see", icon: Target },
            ].map((x, i) => (
              <div key={i} className={cn("flex items-start gap-4 rounded-2xl p-5", x.muted ? "bg-[#F4F4F2]" : "bg-brand-mint")}>
                <div className={cn("flex h-11 w-11 shrink-0 items-center justify-center rounded-xl", x.muted ? "bg-white text-brand-charcoal" : "bg-brand text-brand-ink")}>
                  <x.icon className="h-5 w-5" />
                </div>
                <div>
                  <p className={cn("text-xs font-bold uppercase tracking-wider", x.muted ? "text-brand-charcoal/70" : "text-brand-dark")}>{x.k}</p>
                  <p className={cn("mt-0.5 text-lg font-bold", x.muted && "text-brand-charcoal line-through decoration-2 decoration-red-400/70")}>{x.v}</p>
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* For job seekers */}
        <section id="seekers" className="container-page scroll-mt-20 py-20">
          <SectionTitle eyebrow="For job seekers" title="Everything your search needs — and the people to help" sub="Spreadsheets lose track. Job boards don't call back. CareerNiche keeps you organized, connected and motivated." />
          <div className="mt-10 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
            <Feature icon={KanbanSquare} title="Visual pipeline board" text="Drag jobs from Bookmarked → Applying → Applied → Interviewed → Offered. Always know where you stand." />
            <Feature icon={Users} title="Your network, organized" text="Track contacts, coffee chats and informational interviews — and who connects you to which job." />
            <Feature icon={Trophy} title="Goals, missions & rewards" text="Daily and weekly missions earn points and tokens. Unlock themes and grow your own city as you progress." />
            <Feature icon={BarChart3} title="Analytics + weekly email" text="See applications per week, response and interview rates, and get a weekly progress report in your inbox." />
            <Feature icon={FileText} title="Interviews & documents" text="Log every interview round and keep the exact resume and cover letter you sent to each company." />
            <Feature icon={HeartHandshake} title="CareerNiche coaches" text="Resume reviews, mock interviews and one-on-one coaching are a click away inside the app." />
          </div>
        </section>

        {/* For businesses */}
        <section id="businesses" className="scroll-mt-16 bg-brand-ink text-white">
          <div className="container-page grid gap-12 py-20 lg:grid-cols-2 lg:items-center">
            <div>
              <p className="text-xs font-bold uppercase tracking-[0.14em] text-brand">For businesses & recruiters</p>
              <h2 className="mt-2 text-3xl font-extrabold sm:text-4xl">Meet prepared, motivated candidates — not 500 anonymous resumes.</h2>
              <p className="mt-4 text-lg text-white/70">CareerNiche job seekers are organized, coached and serious about their search. Partner with us to connect with local talent who are ready to contribute from day one.</p>
              <ul className="mt-6 space-y-3">
                {["Introductions to coached candidates who match your roles", "Recruiter memberships with access to CareerNiche Club", "Hiring events, workshops and community partnerships across Ontario"].map((t) => (
                  <li key={t} className="flex items-start gap-3"><span className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-brand text-brand-ink"><Check className="h-4 w-4" /></span><span className="text-white/90">{t}</span></li>
                ))}
              </ul>
              <a href={CAREERNICHE_CLUB_URL} target="_blank" rel="noreferrer" className="mt-6 inline-flex items-center gap-2 font-semibold text-brand hover:underline underline-offset-4">
                Explore CareerNiche Club <ArrowRight className="h-4 w-4" />
              </a>
            </div>
            <LeadForm />
          </div>
        </section>

        {/* How it works */}
        <section id="how" className="container-page scroll-mt-20 py-20">
          <SectionTitle center eyebrow="How it works" title="Three steps to a search that actually moves" />
          <div className="relative mt-12 grid gap-6 md:grid-cols-3">
            <div className="absolute left-[16%] right-[16%] top-8 hidden h-0.5 bg-gradient-to-r from-brand/0 via-brand to-brand/0 md:block" aria-hidden />
            {[
              { n: 1, icon: Sprout, t: "Join", d: "Create your free account and set a weekly goal that fits your life." },
              { n: 2, icon: Handshake, t: "Track & connect", d: "Add jobs, log contacts and coffee chats, and complete missions as you go." },
              { n: 3, icon: Briefcase, t: "Get hired with support", d: "Lean on CareerNiche coaches and partner businesses to land the offer." },
            ].map((s) => (
              <div key={s.n} className="relative rounded-3xl bg-white p-6 text-center shadow-soft">
                <div className="relative mx-auto flex h-16 w-16 items-center justify-center rounded-2xl bg-brand text-brand-ink shadow-soft">
                  <s.icon className="h-7 w-7" />
                  <span className="absolute -right-2 -top-2 flex h-7 w-7 items-center justify-center rounded-full bg-brand-ink text-xs font-bold text-white">{s.n}</span>
                </div>
                <h3 className="mt-4 text-xl font-bold">{s.t}</h3>
                <p className="mt-1.5 text-brand-charcoal">{s.d}</p>
              </div>
            ))}
          </div>
        </section>

        {/* Services teaser */}
        <section className="bg-white">
          <div className="container-page py-20">
            <div className="flex flex-wrap items-end justify-between gap-4">
              <SectionTitle eyebrow="CareerNiche services" title="Coaching that meets you where you are" />
              <a href={CAREERNICHE_URL} target="_blank" rel="noreferrer"><Button variant="outline">Visit careerniche.ca <ArrowRight className="h-4 w-4" /></Button></a>
            </div>
            <div className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {[
                [FileText, "Resume Review", "Get expert feedback on your resume"],
                [Mic, "Mock Interviews", "Practice with a career coach"],
                [PenLine, "Cover Letter Writing", "Professionally written cover letters"],
                [Linkedin, "LinkedIn Optimization", "Stand out to recruiters"],
                [Users, "Career Coaching", "One-on-one sessions with a career expert"],
                [Compass, "Job Search Strategy", "Build a personalized job search plan"],
              ].map(([Icon, t, d]) => (
                <div key={t} className="flex items-center gap-4 rounded-2xl border border-black/5 p-4 transition hover:border-brand/40 hover:bg-brand-mint/50">
                  <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-brand-mint text-brand-dark"><Icon className="h-5 w-5" /></div>
                  <div><p className="font-bold">{t}</p><p className="text-sm text-brand-charcoal">{d}</p></div>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* Community / testimonials */}
        <section id="community" className="container-page scroll-mt-20 py-20">
          <SectionTitle center eyebrow="Community" title="Stories from the CareerNiche community" sub="Real member stories are coming soon — these cards are placeholders." />
          <div className="mt-10 grid gap-5 md:grid-cols-3">
            {[1, 2, 3].map((i) => (
              <figure key={i} className="flex flex-col rounded-3xl border-2 border-dashed border-brand/30 bg-white p-6">
                <MessageCircle className="h-7 w-7 text-brand" />
                <blockquote className="mt-3 flex-1 text-brand-charcoal">“Testimonial placeholder — replace with a real member story about how CareerNiche helped their search.”</blockquote>
                <figcaption className="mt-5 flex items-center gap-3">
                  <div className="h-10 w-10 rounded-full bg-brand-mint" aria-hidden />
                  <div><p className="font-bold">Member name</p><p className="text-sm text-brand-charcoal">Role · City</p></div>
                </figcaption>
              </figure>
            ))}
          </div>
        </section>

        {/* FAQ */}
        <section id="faq" className="scroll-mt-20 bg-white">
          <div className="container-page grid gap-10 py-20 lg:grid-cols-[1fr_1.4fr]">
            <SectionTitle eyebrow="FAQ" title="Questions? We've got answers." sub="Still curious? Reach the team at careerniche.ca." />
            <div className="space-y-3">
              <FaqItem q="Is it free?" a="Yes. The job tracker — pipeline, network, goals, rewards and analytics — is free for job seekers. CareerNiche coaching services and memberships are optional extras." />
              <FaqItem q="Is this a job board?" a="No. We don't list thousands of jobs. CareerNiche is a connection hub: you track the opportunities you find, build relationships with people who hire, and get coached along the way. Businesses partner with us to meet prepared candidates." />
              <FaqItem q="How do businesses join?" a="Use the “Partner with CareerNiche” form above. Our team will set up a recruiter membership and introduce you to candidates who match your roles." />
              <FaqItem q="Is my data private?" a="Your applications, notes and contacts are private to your account. We never sell your data, and you can delete your account and everything in it from Settings at any time." />
              <FaqItem q="Does it work on mobile?" a="Yes — the tracker is designed mobile-first, with a bottom tab bar and quick add button on phones, and a full sidebar layout on desktop." />
            </div>
          </div>
        </section>

        {/* Final CTA */}
        <section className="container-page py-20">
          <div className="relative overflow-hidden rounded-[2rem] bg-brand px-6 py-14 text-center sm:px-12">
            <div className="pointer-events-none absolute -right-10 -top-10 h-56 w-56 rounded-full bg-white/20" aria-hidden />
            <div className="pointer-events-none absolute -bottom-16 -left-10 h-64 w-64 rounded-full bg-brand-dark/15" aria-hidden />
            <h2 className="relative text-3xl font-extrabold text-brand-ink sm:text-4xl">Ready to take control of your job search?</h2>
            <p className="relative mx-auto mt-3 max-w-xl text-lg text-brand-ink/75">Join free in under a minute. Your first missions are waiting.</p>
            <div className="relative mt-7 flex flex-wrap justify-center gap-3">
              <Link to={primaryCta.to}><Button variant="dark" size="lg">{primaryCta.label} <ArrowRight className="h-4 w-4" /></Button></Link>
              <a href="#businesses"><Button variant="outline" size="lg" className="border-brand-ink/20 bg-white/70">I'm hiring</Button></a>
            </div>
          </div>
        </section>
      </main>

      <footer className="border-t border-black/5 bg-white">
        <div className="container-page grid gap-8 py-12 md:grid-cols-[1.5fr_1fr_1fr]">
          <div>
            <Logo />
            <p className="mt-3 max-w-sm text-sm text-brand-charcoal">Connecting job seekers, local businesses and career coaches across Canada.</p>
            <div className="mt-4 flex gap-2">
              {/* TODO: replace with CareerNiche's real social profile URLs */}
              {[[Linkedin, "LinkedIn"], [Instagram, "Instagram"], [Facebook, "Facebook"], [Mail, "Contact"]].map(([Icon, label]) => (
                <a key={label} href={CAREERNICHE_URL} target="_blank" rel="noreferrer" aria-label={label} className="flex h-9 w-9 items-center justify-center rounded-xl bg-brand-mint text-brand-dark hover:bg-brand"><Icon className="h-4 w-4" /></a>
              ))}
            </div>
          </div>
          <div>
            <p className="font-bold">Product</p>
            <ul className="mt-3 space-y-2 text-sm text-brand-charcoal">
              <li><a href="#seekers" className="hover:text-brand-ink">For job seekers</a></li>
              <li><a href="#businesses" className="hover:text-brand-ink">For businesses</a></li>
              <li><Link to="/register" className="hover:text-brand-ink">Create account</Link></li>
            </ul>
          </div>
          <div>
            <p className="font-bold">Company</p>
            <ul className="mt-3 space-y-2 text-sm text-brand-charcoal">
              <li><a href={CAREERNICHE_URL} target="_blank" rel="noreferrer" className="hover:text-brand-ink">About CareerNiche</a></li>
              <li><a href={CAREERNICHE_URL} target="_blank" rel="noreferrer" className="hover:text-brand-ink">Contact</a></li>
              <li><Link to="/privacy" className="hover:text-brand-ink">Privacy</Link></li>
              <li><Link to="/terms" className="hover:text-brand-ink">Terms</Link></li>
            </ul>
          </div>
        </div>
        <div className="border-t border-black/5 py-5 text-center text-sm text-brand-charcoal">© 2026 CareerNiche Inc. · careerniche.ca</div>
      </footer>
    </div>
  );
}

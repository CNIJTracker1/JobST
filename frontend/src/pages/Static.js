import { useEffect } from "react";
import { Link } from "react-router-dom";
import { ArrowLeft, Compass } from "lucide-react";
import { applyBrand } from "@/lib/themes";
import { Button } from "@/components/ui";
import Logo from "@/components/Logo";

const COPY = {
  privacy: {
    title: "Privacy Policy",
    body: [
      "Placeholder — replace with CareerNiche's reviewed privacy policy before launch.",
      "What we store: your account details, the jobs, contacts, notes, interviews and documents you add, and your reward progress.",
      "How it's used: only to run your tracker and send the emails you opt into (verification, password reset, weekly report).",
      "Your control: you can delete your account and all associated data at any time from Settings → Danger zone.",
    ],
  },
  terms: {
    title: "Terms of Service",
    body: [
      "Placeholder — replace with CareerNiche's reviewed terms of service before launch.",
      "The CareerNiche Job Tracker is provided to help you organize your job search. You're responsible for the content you add.",
      "Rewards, tokens and themes have no cash value.",
    ],
  },
};

export function Legal({ kind }) {
  useEffect(() => applyBrand(), []);
  const c = COPY[kind];
  return (
    <div className="min-h-screen bg-brand-cream px-5 py-6 text-brand-ink sm:px-10">
      <Logo />
      <article className="mx-auto max-w-2xl py-12">
        <Link to={-1} className="mb-6 inline-flex items-center gap-1.5 text-sm font-semibold text-brand-charcoal hover:text-brand-ink"><ArrowLeft className="h-4 w-4" /> Back</Link>
        <h1 className="text-4xl font-extrabold">{c.title}</h1>
        <div className="mt-6 space-y-4 text-lg leading-relaxed text-brand-charcoal">{c.body.map((p) => <p key={p}>{p}</p>)}</div>
      </article>
    </div>
  );
}

export function NotFound() {
  useEffect(() => applyBrand(), []);
  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-brand-cream px-6 text-center text-brand-ink">
      <Compass className="h-14 w-14 text-brand" />
      <h1 className="mt-4 text-3xl font-extrabold">This page took a different career path</h1>
      <p className="mt-2 text-brand-charcoal">We couldn't find what you were looking for.</p>
      <Link to="/" className="mt-6"><Button variant="brand">Go home</Button></Link>
    </div>
  );
}

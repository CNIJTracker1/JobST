import { useEffect, useState } from "react";
import { Link, useLocation, useNavigate, useSearchParams } from "react-router-dom";
import { toast } from "sonner";
import { ArrowLeft, CheckCircle2, Eye, EyeOff, MailCheck } from "lucide-react";
import { useAuth } from "@/context/AuthContext";
import { api, errorMessage } from "@/lib/api";
import { applyBrand } from "@/lib/themes";
import { Button, Field, Input } from "@/components/ui";
import Logo from "@/components/Logo";

/** DEV_MODE only: the API returns the link when no email provider is configured. */
function devLinkToast(title, link) {
  toast.info(title, { duration: 15000, action: { label: "Open", onClick: () => window.location.assign(link) } });
}

function AuthLayout({ title, subtitle, children, footer }) {
  useEffect(() => applyBrand(), []);
  return (
    <div className="grid min-h-screen bg-brand-cream lg:grid-cols-2">
      <div className="flex flex-col px-5 py-6 sm:px-10">
        <Logo />
        <div className="mx-auto flex w-full max-w-md flex-1 flex-col justify-center py-10 animate-fade-up">
          <h1 className="text-3xl font-extrabold text-brand-ink">{title}</h1>
          {subtitle && <p className="mt-2 text-brand-charcoal">{subtitle}</p>}
          <div className="mt-8">{children}</div>
          {footer && <div className="mt-6 text-sm text-brand-charcoal">{footer}</div>}
        </div>
      </div>
      <aside className="relative hidden overflow-hidden bg-brand-ink p-12 text-white lg:flex lg:flex-col lg:justify-end">
        <div className="absolute -right-24 -top-24 h-96 w-96 rounded-full bg-brand/30 blur-3xl" aria-hidden />
        <div className="absolute bottom-40 left-10 h-40 w-40 rounded-full bg-brand/20 blur-2xl" aria-hidden />
        <div className="relative space-y-4">
          {["🔖 Bookmarked 3 jobs · +15 pts", "☕ Coffee chat with Priya on Tuesday", "🎤 Interview Ready mission complete!"].map((t, i) => (
            <div key={t} className="w-fit rounded-2xl bg-white/10 px-4 py-3 text-sm font-semibold backdrop-blur animate-fade-up" style={{ animationDelay: `${0.2 + i * 0.15}s`, marginLeft: i * 28 }}>{t}</div>
          ))}
          <h2 className="pt-8 text-4xl font-extrabold leading-tight">Not another job board.<br /><span className="text-brand">Your career community.</span></h2>
          <p className="max-w-md text-white/70">Track applications, grow your network and get coached by CareerNiche — all in one place.</p>
        </div>
      </aside>
    </div>
  );
}

function PasswordInput(props) {
  const [show, setShow] = useState(false);
  return (
    <div className="relative">
      <Input type={show ? "text" : "password"} className="pr-11" {...props} />
      <button type="button" onClick={() => setShow(!show)} className="absolute right-2 top-1/2 -translate-y-1/2 rounded-lg p-1.5 text-ink-muted hover:text-ink" aria-label={show ? "Hide password" : "Show password"}>
        {show ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
      </button>
    </div>
  );
}

const GoogleIcon = () => (
  <svg viewBox="0 0 24 24" className="h-5 w-5" aria-hidden>
    <path fill="#4285F4" d="M22.6 12.2c0-.8-.1-1.5-.2-2.2H12v4.2h5.9a5 5 0 0 1-2.2 3.3v2.7h3.6c2.1-1.9 3.3-4.8 3.3-8z" />
    <path fill="#34A853" d="M12 23c3 0 5.5-1 7.3-2.7l-3.6-2.8c-1 .7-2.2 1.1-3.7 1.1-2.8 0-5.2-1.9-6.1-4.5H2.2v2.8A11 11 0 0 0 12 23z" />
    <path fill="#FBBC05" d="M5.9 14.1a6.6 6.6 0 0 1 0-4.2V7.1H2.2a11 11 0 0 0 0 9.8l3.7-2.8z" />
    <path fill="#EA4335" d="M12 5.4c1.6 0 3 .6 4.1 1.6l3.1-3.1A11 11 0 0 0 2.2 7.1l3.7 2.8C6.8 7.3 9.2 5.4 12 5.4z" />
  </svg>
);

function SocialButtons() {
  // TODO(Emergent): wire Google via Emergent-managed Google Auth; LinkedIn was "coming soon" in the Flutter app too.
  const soon = (p) => toast.info(`${p} sign-in is coming soon`);
  return (
    <>
      <div className="grid gap-3 sm:grid-cols-2">
        <Button type="button" variant="outline" className="bg-white" onClick={() => soon("Google")}><GoogleIcon /> Google</Button>
        <Button type="button" variant="outline" className="bg-white" onClick={() => soon("LinkedIn")}>
          <svg viewBox="0 0 24 24" className="h-5 w-5" aria-hidden><rect width="24" height="24" rx="4" fill="#0A66C2" /><path fill="#fff" d="M7 9.5h2.5V17H7zM8.25 6a1.4 1.4 0 1 1 0 2.8 1.4 1.4 0 0 1 0-2.8zM11 9.5h2.4v1c.4-.7 1.3-1.2 2.5-1.2 2.3 0 2.8 1.5 2.8 3.5V17h-2.5v-3.6c0-.9 0-2-1.2-2s-1.5.9-1.5 1.9V17H11z" /></svg>
          LinkedIn
        </Button>
      </div>
      <div className="my-6 flex items-center gap-3 text-xs font-semibold uppercase tracking-wider text-ink-faint">
        <span className="h-px flex-1 bg-line" /> or with email <span className="h-px flex-1 bg-line" />
      </div>
    </>
  );
}

export function Login() {
  const { login } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [form, setForm] = useState({ email: "", password: "" });
  const [loading, setLoading] = useState(false);
  const submit = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      await login(form.email, form.password);
      navigate(location.state?.from || "/app", { replace: true });
    } catch (err) {
      toast.error(errorMessage(err, "Couldn't log in"));
    } finally {
      setLoading(false);
    }
  };
  return (
    <AuthLayout title="Welcome back" subtitle="Log in to pick up where you left off." footer={<>New to CareerNiche? <Link to="/register" className="link">Create a free account</Link></>}>
      <SocialButtons />
      <form onSubmit={submit} className="space-y-4">
        <Field label="Email">{(id) => <Input id={id} type="email" autoComplete="email" required value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />}</Field>
        <Field label="Password">{(id) => <PasswordInput id={id} autoComplete="current-password" required value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} />}</Field>
        <div className="flex justify-end"><Link to="/forgot-password" className="text-sm link">Forgot password?</Link></div>
        <Button type="submit" variant="brand" size="lg" className="w-full" loading={loading}>Log in</Button>
      </form>
    </AuthLayout>
  );
}

export function Register() {
  const { register } = useAuth();
  const navigate = useNavigate();
  const [form, setForm] = useState({ username: "", email: "", password: "" });
  const [errors, setErrors] = useState({});
  const [loading, setLoading] = useState(false);
  const submit = async (e) => {
    e.preventDefault();
    const errs = {};
    if (form.username.trim().length < 3 || form.username.trim().length > 20) errs.username = "Use 3–20 characters";
    if (form.password.length < 6) errs.password = "At least 6 characters";
    setErrors(errs);
    if (Object.keys(errs).length) return;
    setLoading(true);
    try {
      const data = await register(form);
      if (data.dev_verification_link) devLinkToast("Email isn't configured — dev verification link", data.dev_verification_link);
      navigate("/onboarding", { replace: true });
    } catch (err) {
      toast.error(errorMessage(err, "Couldn't create your account"));
    } finally {
      setLoading(false);
    }
  };
  return (
    <AuthLayout title="Join CareerNiche" subtitle="Free for job seekers. Takes less than a minute." footer={<>Already have an account? <Link to="/login" className="link">Log in</Link></>}>
      <SocialButtons />
      <form onSubmit={submit} className="space-y-4" noValidate>
        <Field label="Display name" error={errors.username}>{(id) => <Input id={id} autoComplete="nickname" value={form.username} onChange={(e) => setForm({ ...form, username: e.target.value })} placeholder="How should we greet you?" />}</Field>
        <Field label="Email">{(id) => <Input id={id} type="email" autoComplete="email" required value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />}</Field>
        <Field label="Password" error={errors.password} hint="At least 6 characters">{(id) => <PasswordInput id={id} autoComplete="new-password" value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} />}</Field>
        <Button type="submit" variant="brand" size="lg" className="w-full" loading={loading}>Create my account</Button>
        <p className="text-center text-xs text-ink-muted">By joining you agree to our <Link to="/terms" className="underline">Terms</Link> and <Link to="/privacy" className="underline">Privacy Policy</Link>.</p>
      </form>
    </AuthLayout>
  );
}

export function ForgotPassword() {
  const [email, setEmail] = useState("");
  const [sent, setSent] = useState(false);
  const [loading, setLoading] = useState(false);
  const submit = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      const { data } = await api.post("/auth/forgot-password", { email });
      setSent(true);
      if (data.dev_reset_link) devLinkToast("Email isn't configured — dev reset link", data.dev_reset_link);
    } catch (err) {
      toast.error(errorMessage(err));
    } finally {
      setLoading(false);
    }
  };
  return (
    <AuthLayout title="Reset your password" subtitle="We'll email you a secure link." footer={<Link to="/login" className="inline-flex items-center gap-1 link"><ArrowLeft className="h-4 w-4" /> Back to log in</Link>}>
      {sent ? (
        <div className="rounded-2xl bg-white p-6 text-center shadow-soft">
          <MailCheck className="mx-auto h-10 w-10 text-brand-dark" />
          <p className="mt-3 font-bold">Check your inbox</p>
          <p className="mt-1 text-sm text-brand-charcoal">If an account exists for {email}, a reset link is on its way. It expires in 1 hour.</p>
        </div>
      ) : (
        <form onSubmit={submit} className="space-y-4">
          <Field label="Email">{(id) => <Input id={id} type="email" required value={email} onChange={(e) => setEmail(e.target.value)} />}</Field>
          <Button type="submit" variant="brand" size="lg" className="w-full" loading={loading}>Send reset link</Button>
        </form>
      )}
    </AuthLayout>
  );
}

export function ResetPassword() {
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const [pw, setPw] = useState({ a: "", b: "" });
  const [loading, setLoading] = useState(false);
  const submit = async (e) => {
    e.preventDefault();
    if (pw.a.length < 6) return toast.error("Password must be at least 6 characters");
    if (pw.a !== pw.b) return toast.error("Passwords don't match");
    setLoading(true);
    try {
      await api.post("/auth/reset-password", { token: params.get("token"), password: pw.a });
      toast.success("Password updated — log in with your new password");
      navigate("/login");
    } catch (err) {
      toast.error(errorMessage(err));
    } finally {
      setLoading(false);
    }
  };
  return (
    <AuthLayout title="Choose a new password">
      <form onSubmit={submit} className="space-y-4">
        <Field label="New password">{(id) => <PasswordInput id={id} autoComplete="new-password" value={pw.a} onChange={(e) => setPw({ ...pw, a: e.target.value })} />}</Field>
        <Field label="Confirm password">{(id) => <PasswordInput id={id} autoComplete="new-password" value={pw.b} onChange={(e) => setPw({ ...pw, b: e.target.value })} />}</Field>
        <Button type="submit" variant="brand" size="lg" className="w-full" loading={loading}>Update password</Button>
      </form>
    </AuthLayout>
  );
}

export function VerifyEmail() {
  const [params] = useSearchParams();
  const { user, refreshUser, logout } = useAuth();
  const navigate = useNavigate();
  const token = params.get("token");
  const [state, setState] = useState(token ? "verifying" : "waiting");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!token) return;
    api.post("/auth/verify-email", { token })
      .then(async () => {
        setState("done");
        await refreshUser();
      })
      .catch((err) => {
        setState("error");
        toast.error(errorMessage(err));
      });
  }, [token, refreshUser]);

  const resend = async () => {
    setLoading(true);
    try {
      const { data } = await api.post("/auth/resend-verification");
      toast.success("Verification email sent");
      if (data.dev_verification_link) devLinkToast("Email isn't configured — dev verification link", data.dev_verification_link);
    } catch (err) {
      toast.error(errorMessage(err));
    } finally {
      setLoading(false);
    }
  };

  if (state === "done")
    return (
      <AuthLayout title="Email verified 🎉">
        <CheckCircle2 className="h-12 w-12 text-brand" />
        <Button variant="brand" size="lg" className="mt-6 w-full" onClick={() => navigate(user ? "/app" : "/login")}>Continue</Button>
      </AuthLayout>
    );
  return (
    <AuthLayout title={state === "verifying" ? "Verifying…" : "Verify your email"} subtitle={user ? `We sent a link to ${user.email}. Click it to activate your account.` : "Open the link we emailed you to activate your account."}>
      {user && (
        <div className="flex flex-col gap-3">
          <Button variant="brand" size="lg" onClick={async () => (await refreshUser())?.email_verified && navigate("/app")}>I've verified — continue</Button>
          <Button variant="outline" size="lg" className="bg-white" onClick={resend} loading={loading}>Resend email</Button>
          <button className="text-sm link" onClick={() => { logout(); navigate("/login"); }}>Use a different account</button>
        </div>
      )}
    </AuthLayout>
  );
}

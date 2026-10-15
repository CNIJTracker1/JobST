import { BrowserRouter, Navigate, Route, Routes, useLocation } from "react-router-dom";
import { Toaster } from "sonner";
import { AuthProvider, useAuth } from "@/context/AuthContext";
import { PageLoader } from "@/components/ui";
import AppShell from "@/components/app/AppShell";
import Landing from "@/pages/Landing";
import { Login, Register, ForgotPassword, ResetPassword, VerifyEmail } from "@/pages/Auth";
import Onboarding from "@/pages/Onboarding";
import Dashboard from "@/pages/Dashboard";
import Board from "@/pages/Board";
import JobDetail from "@/pages/JobDetail";
import Network from "@/pages/Network";
import Growth from "@/pages/Growth";
import Analytics from "@/pages/Analytics";
import Hub from "@/pages/Hub";
import Settings from "@/pages/Settings";
import { Legal, NotFound } from "@/pages/Static";

function Protected({ children, allowUnonboarded = false }) {
  const { user, loading, requireVerification } = useAuth();
  const location = useLocation();
  if (loading) return <PageLoader />;
  if (!user) return <Navigate to="/login" replace state={{ from: location.pathname }} />;
  if (requireVerification && !user.email_verified) return <Navigate to="/verify-email" replace />;
  if (!allowUnonboarded && !user.settings?.onboarded) return <Navigate to="/onboarding" replace />;
  return children;
}

function GuestOnly({ children }) {
  const { user, loading } = useAuth();
  if (loading) return <PageLoader />;
  return user ? <Navigate to="/app" replace /> : children;
}

export default function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <Routes>
          <Route path="/" element={<Landing />} />
          <Route path="/login" element={<GuestOnly><Login /></GuestOnly>} />
          <Route path="/register" element={<GuestOnly><Register /></GuestOnly>} />
          <Route path="/forgot-password" element={<ForgotPassword />} />
          <Route path="/reset-password" element={<ResetPassword />} />
          <Route path="/verify-email" element={<VerifyEmail />} />
          <Route path="/privacy" element={<Legal kind="privacy" />} />
          <Route path="/terms" element={<Legal kind="terms" />} />
          <Route path="/onboarding" element={<Protected allowUnonboarded><Onboarding /></Protected>} />
          <Route path="/app" element={<Protected><AppShell /></Protected>}>
            <Route index element={<Dashboard />} />
            <Route path="board" element={<Board />} />
            <Route path="jobs/:id" element={<JobDetail />} />
            <Route path="network" element={<Network />} />
            <Route path="growth" element={<Growth />} />
            <Route path="analytics" element={<Analytics />} />
            <Route path="hub" element={<Hub />} />
            <Route path="settings" element={<Settings />} />
          </Route>
          <Route path="*" element={<NotFound />} />
        </Routes>
      </BrowserRouter>
      <Toaster position="top-center" richColors closeButton toastOptions={{ style: { fontFamily: "inherit" } }} />
    </AuthProvider>
  );
}

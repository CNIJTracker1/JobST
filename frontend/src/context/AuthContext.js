import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { api, tokenStore } from "@/lib/api";
import { applyTheme } from "@/lib/themes";

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [requireVerification, setRequireVerification] = useState(false);
  const [loading, setLoading] = useState(!!tokenStore.get());

  const refreshUser = useCallback(async () => {
    if (!tokenStore.get()) {
      setUser(null);
      setLoading(false);
      return null;
    }
    try {
      const { data } = await api.get("/auth/me");
      setUser(data.user);
      setRequireVerification(data.require_verification);
      return data.user;
    } catch {
      tokenStore.set(null);
      setUser(null);
      return null;
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    refreshUser();
  }, [refreshUser]);

  const startSession = useCallback((data) => {
    tokenStore.set(data.token);
    setUser(data.user);
    return data;
  }, []);

  const login = useCallback(async (email, password) => startSession((await api.post("/auth/login", { email, password })).data), [startSession]);

  const register = useCallback(
    async (form) => {
      const timezone = Intl.DateTimeFormat().resolvedOptions().timeZone;
      const data = (await api.post("/auth/register", { ...form, timezone })).data;
      startSession(data);
      await refreshUser();
      return data;
    },
    [startSession, refreshUser]
  );

  const logout = useCallback(() => {
    tokenStore.set(null);
    setUser(null);
  }, []);

  /** Optimistically apply settings (theme, dark mode, font) then persist. */
  const updateSettings = useCallback(async (changes) => {
    setUser((u) => (u ? { ...u, settings: { ...u.settings, ...changes } } : u));
    const { data } = await api.patch("/settings", changes);
    setUser((u) => (u ? { ...u, settings: data } : u));
    return data;
  }, []);

  const setTokens = useCallback((tokens) => setUser((u) => (u ? { ...u, tokens } : u)), []);

  // Apply the user's theme whenever their appearance settings change
  const s = user?.settings;
  useEffect(() => {
    if (s) applyTheme(s);
  }, [s?.app_theme, s?.dark_mode, s?.font_size]); // eslint-disable-line react-hooks/exhaustive-deps

  const value = useMemo(
    () => ({ user, loading, requireVerification, login, register, logout, refreshUser, updateSettings, setUser, setTokens }),
    [user, loading, requireVerification, login, register, logout, refreshUser, updateSettings, setTokens]
  );
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export const useAuth = () => useContext(AuthContext);

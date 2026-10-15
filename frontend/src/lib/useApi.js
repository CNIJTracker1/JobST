import { useCallback, useEffect, useRef, useState } from "react";
import { api, errorMessage } from "./api";

/** Tiny data hook: GET on mount + `reload()`; keeps previous data while refreshing. */
export function useApi(path, { skip = false } = {}) {
  const [data, setData] = useState(null);
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(!skip);
  const alive = useRef(true);

  const reload = useCallback(async () => {
    if (!path) return null;
    setLoading(true);
    try {
      const res = await api.get(path);
      if (alive.current) {
        setData(res.data);
        setError(null);
      }
      return res.data;
    } catch (err) {
      if (alive.current) setError(errorMessage(err));
      return null;
    } finally {
      if (alive.current) setLoading(false);
    }
  }, [path]);

  useEffect(() => {
    alive.current = true;
    if (!skip) reload();
    return () => {
      alive.current = false;
    };
  }, [reload, skip]);

  return { data, setData, error, loading, reload };
}

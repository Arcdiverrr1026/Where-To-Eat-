import { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react';
import { request } from '../api';

const AuthContext = createContext(null);
const EntriesContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [attempt, setAttempt] = useState(0);
  useEffect(() => {
    const controller = new AbortController();
    setLoading(true); setError('');
    request('/api/library/auth/me', { signal: controller.signal })
      .then((data) => { if (!controller.signal.aborted) setUser(data); })
      .catch((failure) => {
        if (!controller.signal.aborted) {
          setUser(null);
          if (failure.status !== 401) setError(failure.message);
        }
      }).finally(() => { if (!controller.signal.aborted) setLoading(false); });
    return () => controller.abort();
  }, [attempt]);
  useEffect(() => {
    const invalidate = () => setUser(null);
    window.addEventListener('library:unauthorized', invalidate);
    return () => window.removeEventListener('library:unauthorized', invalidate);
  }, []);
  async function logout() {
    await request('/api/library/auth/logout', { method: 'POST' });
    setUser(null);
  }
  return <AuthContext.Provider value={{ user, setUser, loading, error, retry: () => setAttempt((value) => value + 1), logout }}>{children}</AuthContext.Provider>;
}

export function useAuth() { return useContext(AuthContext); }

export function EntriesProvider({ children, enabled = true }) {
  const [entries, setEntries] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const active = useRef(null);
  const refresh = useCallback(async () => {
    if (!enabled) { setEntries([]); setLoading(false); return; }
    active.current?.abort();
    const controller = new AbortController();
    active.current = controller;
    setLoading(true); setError('');
    try {
      const result = await request('/api/library/entries', { signal: controller.signal });
      if (!controller.signal.aborted) setEntries(result.entries);
    } catch (failure) { if (!controller.signal.aborted) setError(failure.message); }
    finally { if (!controller.signal.aborted) setLoading(false); }
  }, [enabled]);
  useEffect(() => { refresh(); return () => active.current?.abort(); }, [refresh]);
  return <EntriesContext.Provider value={{ entries, loading, error, refresh }}>{children}</EntriesContext.Provider>;
}

export function useEntries() { return useContext(EntriesContext); }

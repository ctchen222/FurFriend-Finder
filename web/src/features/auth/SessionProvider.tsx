import { createContext, useContext, type ReactNode } from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import type { SessionUser } from '../../../../src/contracts/web';
import { useResource } from '../../hooks/useResource';
import { ApiError, post } from '../../api/client';
import { Feedback } from '../../ui/Feedback';

type Session = { user: SessionUser | null; loading: boolean; error: Error | null; refresh: () => void; signOut: () => Promise<void> };
const SessionContext = createContext<Session | null>(null);
export function SessionProvider({ children }: { children: ReactNode }) {
  const state = useResource<{ user: SessionUser }>('/api/v1/me');
  const unauthenticated = state.error instanceof ApiError && state.error.status === 401;
  return <SessionContext.Provider value={{
    user: state.data?.user ?? null, loading: state.loading,
    error: unauthenticated ? null : state.error, refresh: state.reload,
    signOut: async () => { await post('/api/auth/sign-out'); state.reload(); },
  }}>{children}</SessionContext.Provider>;
}
export function useSession() {
  const value = useContext(SessionContext);
  if (!value) throw new Error('SessionProvider is required');
  return value;
}
export function Protected({ children }: { children: ReactNode }) {
  const { user, loading, error, refresh } = useSession();
  const location = useLocation();
  if (loading) return <Feedback loading />;
  if (error) return <Feedback error={error} retry={refresh} />;
  if (!user) return <Navigate to={`/login?returnTo=${encodeURIComponent(location.pathname)}`} replace />;
  return children;
}

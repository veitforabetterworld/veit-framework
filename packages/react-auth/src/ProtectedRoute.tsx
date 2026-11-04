import React from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from './AuthContext.js';

/** The login URL with the current page as `?<nextParam>=` (keeps a query the login path already has). */
export function veitLoginPathWithNext(loginPath: string, next: string, nextParam = 'next'): string {
  const hashAt = loginPath.indexOf('#');
  const base = hashAt === -1 ? loginPath : loginPath.slice(0, hashAt);
  const hash = hashAt === -1 ? '' : loginPath.slice(hashAt);
  const sep = base.includes('?') ? '&' : '?';
  return `${base}${sep}${encodeURIComponent(nextParam)}=${encodeURIComponent(next)}${hash}`;
}

export function ProtectedRoute<User>({
  children,
  loginPath = '/login',
  loadingFallback,
  nextParam,
}: {
  children: React.ReactNode;
  loginPath?: string;
  loadingFallback?: React.ReactNode;
  /**
   * Also put the page into the login URL, e.g. 'next' → `/login?next=%2Forders%3Fid%3D3`, so the way back survives a
   * reload or a new tab (router state does not). The framework's LoginForm and RegisterForm read `next`. Without it
   * only router state carries the page, as before.
   */
  nextParam?: string;
}) {
  const { user, loading } = useAuth<User>();
  const location = useLocation();

  if (loading) return <>{loadingFallback ?? null}</>;
  if (!user) {
    const to = nextParam
      ? veitLoginPathWithNext(loginPath, `${location.pathname}${location.search}${location.hash}`, nextParam)
      : loginPath;
    return <Navigate to={to} state={{ from: location }} replace />;
  }
  return <>{children}</>;
}

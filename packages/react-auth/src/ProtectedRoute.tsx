import React from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from './AuthContext.js';

export function ProtectedRoute<User>({
  children,
  loginPath = '/login',
  loadingFallback,
}: {
  children: React.ReactNode;
  loginPath?: string;
  loadingFallback?: React.ReactNode;
}) {
  const { user, loading } = useAuth<User>();
  const location = useLocation();

  if (loading) return <>{loadingFallback ?? null}</>;
  if (!user) return <Navigate to={loginPath} state={{ from: location }} replace />;
  return <>{children}</>;
}

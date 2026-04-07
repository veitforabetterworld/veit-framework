import { useEffect } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from './AuthContext.js';

export function useRedirectIfAuthenticated<User>(fallbackPath = '/'): boolean {
  const { user, loading } = useAuth<User>();
  const navigate = useNavigate();
  const location = useLocation();
  const afterLoginPath =
    (location.state as { from?: { pathname: string } })?.from?.pathname ?? fallbackPath;

  useEffect(() => {
    if (loading || !user) return;
    navigate(afterLoginPath, { replace: true });
  }, [loading, user, navigate, afterLoginPath]);

  return loading || !!user;
}

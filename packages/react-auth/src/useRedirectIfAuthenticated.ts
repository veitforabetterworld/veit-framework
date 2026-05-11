import { useEffect } from 'react';
import { useLocation, useNavigate, useSearchParams } from 'react-router-dom';
import { useAuth } from './AuthContext.js';
import { resolvePostLoginPath } from './postLoginPath.js';

export function useRedirectIfAuthenticated<User>(fallbackPath = '/'): boolean {
  const { user, loading } = useAuth<User>();
  const navigate = useNavigate();
  const location = useLocation();
  const [searchParams] = useSearchParams();
  const afterLoginPath = resolvePostLoginPath(
    (location.state as { from?: unknown })?.from,
    searchParams.get('next'),
    fallbackPath,
  );

  useEffect(() => {
    if (loading || !user) return;
    navigate(afterLoginPath, { replace: true });
  }, [loading, user, navigate, afterLoginPath]);

  return loading || !!user;
}

import React, { createContext, useContext, useEffect, useMemo, useState } from 'react';

export type EffectivePermission = {
  permission: string;
  scope_type: string;
  scope_ref_id: number | null;
  scope_key: string;
};

type PermissionContextValue = {
  loading: boolean;
  permissions: EffectivePermission[];
  has: (permission: string, scopeType?: string, scopeRefId?: number) => boolean;
};

const PermissionContext = createContext<PermissionContextValue | null>(null);

export function PermissionProvider({
  loading,
  permissions,
  children,
}: {
  loading: boolean;
  permissions: EffectivePermission[];
  children: React.ReactNode;
}) {
  const permissionSet = useMemo(
    () => new Set(permissions.map((p) => `${p.permission}@${p.scope_key}`)),
    [permissions],
  );
  const value = useMemo<PermissionContextValue>(
    () => ({
      loading,
      permissions,
      has: (permission: string, scopeType?: string, scopeRefId?: number) => {
        if (!scopeType || scopeRefId == null) {
          return permissions.some((p) => p.permission === permission);
        }
        return permissionSet.has(`${permission}@${scopeType}:${scopeRefId}`);
      },
    }),
    [loading, permissionSet, permissions],
  );
  return <PermissionContext.Provider value={value}>{children}</PermissionContext.Provider>;
}

export function usePermission() {
  const ctx = useContext(PermissionContext);
  if (!ctx) throw new Error('usePermission must be used within PermissionProvider');
  return ctx;
}

export function Can({
  permission,
  scopeType,
  scopeRefId,
  children,
  fallback = null,
}: {
  permission: string;
  scopeType?: string;
  scopeRefId?: number;
  children: React.ReactNode;
  fallback?: React.ReactNode;
}) {
  const { has } = usePermission();
  return <>{has(permission, scopeType, scopeRefId) ? children : fallback}</>;
}

export function createPermissionProvider<UserType>(options: {
  useUser: () => UserType | null | undefined;
  userKey: (user: UserType) => string | number;
  loadPermissions: (user: UserType) => Promise<EffectivePermission[]>;
}) {
  return function GeneratedPermissionProvider({ children }: { children: React.ReactNode }) {
    const user = options.useUser();
    const [permissions, setPermissions] = useState<EffectivePermission[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
      let cancelled = false;
      if (!user) {
        setPermissions([]);
        setLoading(false);
        return;
      }
      setLoading(true);
      options
        .loadPermissions(user)
        .then((rows) => {
          if (!cancelled) setPermissions(rows);
        })
        .catch(() => {
          if (!cancelled) setPermissions([]);
        })
        .finally(() => {
          if (!cancelled) setLoading(false);
        });
      return () => {
        cancelled = true;
      };
    }, [user ? options.userKey(user) : null]);

    return (
      <PermissionProvider loading={loading} permissions={permissions}>
        {children}
      </PermissionProvider>
    );
  };
}

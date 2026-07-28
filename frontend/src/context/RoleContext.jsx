import { createContext, useContext, useMemo, useState } from 'react';

const RoleContext = createContext(null);

const STORAGE_KEY = 'sieve.role';

export const ROLE_DEFAULT_ROUTE = {
  ops: '/',
  sales: '/check',
};

export function RoleProvider({ children }) {
  const [role, setRole] = useState(() => localStorage.getItem(STORAGE_KEY) || 'ops');

  const value = useMemo(
    () => ({
      role,
      isOps: role === 'ops',
      isSales: role === 'sales',
      setRole: (next) => {
        localStorage.setItem(STORAGE_KEY, next);
        setRole(next);
      },
    }),
    [role],
  );

  return <RoleContext.Provider value={value}>{children}</RoleContext.Provider>;
}

export function useRole() {
  return useContext(RoleContext);
}

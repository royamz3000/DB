import { createContext, useContext, useMemo } from 'react';

const RoleContext = createContext(null);

export const ROLE_DEFAULT_ROUTE = {
  ops: '/',
  sales: '/check',
};

// Role now comes from the signed-in user's account (assigned when their
// account was created), not a self-service toggle — see routes/auth.js's
// requireOps middleware, which enforces this server-side too.
export function RoleProvider({ user, children }) {
  const value = useMemo(
    () => ({
      role: user.role,
      isOps: user.role === 'ops',
      isSales: user.role === 'sales',
      user,
    }),
    [user],
  );

  return <RoleContext.Provider value={value}>{children}</RoleContext.Provider>;
}

export function useRole() {
  return useContext(RoleContext);
}

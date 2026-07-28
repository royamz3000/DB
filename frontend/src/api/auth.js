import { apiGet, apiPost } from './client';

export const fetchSession = () => apiGet('/auth/session');
export const login = (email, password) => apiPost('/auth/login', { email, password });
export const logout = () => apiPost('/auth/logout', {});
export const changePassword = (currentPassword, newPassword) =>
  apiPost('/auth/change-password', { currentPassword, newPassword });

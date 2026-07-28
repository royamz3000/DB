import { apiGet, apiPost } from './client';

export const fetchSession = () => apiGet('/auth/session');
export const login = (password) => apiPost('/auth/login', { password });
export const logout = () => apiPost('/auth/logout', {});

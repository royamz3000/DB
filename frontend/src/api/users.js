import { apiDelete, apiGet, apiPost } from './client';

export const fetchUsers = () => apiGet('/users');
export const createUser = (payload) => apiPost('/users', payload);
export const deleteUser = (id) => apiDelete(`/users/${id}`);

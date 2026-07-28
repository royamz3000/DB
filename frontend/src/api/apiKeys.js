import { apiDelete, apiGet, apiPost } from './client';

export const fetchApiKeys = () => apiGet('/api-keys');
export const createApiKey = (payload) => apiPost('/api-keys', payload);
export const deleteApiKey = (id) => apiDelete(`/api-keys/${id}`);

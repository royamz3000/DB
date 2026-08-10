import { apiGet, apiPost, apiDelete } from './client';

export const fetchLists = () => apiGet('/lists');
export const createList = (payload) => apiPost('/lists', payload);
export const deleteList = (id) => apiDelete(`/lists/${id}`);

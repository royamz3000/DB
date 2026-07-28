import { apiGet, apiPost } from './client';

export const fetchLists = () => apiGet('/lists');
export const createList = (payload) => apiPost('/lists', payload);

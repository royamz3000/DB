import { apiDelete, apiGet, apiPost } from './client';

export function fetchSuppressions({ search, reasons, listId, page, pageSize }) {
  const params = new URLSearchParams();
  if (search) params.set('search', search);
  if (reasons && reasons.length) params.set('reasons', reasons.join(','));
  if (listId) params.set('listId', listId);
  if (page) params.set('page', page);
  if (pageSize) params.set('pageSize', pageSize);
  return apiGet(`/suppressions?${params.toString()}`);
}

export const fetchEntry = (id) => apiGet(`/suppressions/${id}`);
export const unsuppressEntries = (ids) => apiPost('/suppressions/unsuppress', { ids });
export const addEntryNote = (id, note) => apiPost(`/suppressions/${id}/notes`, { note });
export const askOpsToReview = (id) => apiPost(`/suppressions/${id}/ask-review`, {});
export const revalidateEntry = (id) => apiPost(`/suppressions/${id}/revalidate`, {});

export function exportSuppressionsUrl({ search, reasons, listId }) {
  const params = new URLSearchParams();
  if (search) params.set('search', search);
  if (reasons && reasons.length) params.set('reasons', reasons.join(','));
  if (listId) params.set('listId', listId);
  return `/api/suppressions/export?${params.toString()}`;
}

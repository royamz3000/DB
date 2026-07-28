import { apiFetch, apiGet, apiPost } from './client';

export const runCheckBatch = (payload) => apiPost('/checks', payload);
export const quickCheck = (email) => apiPost('/checks/quick', { email });
export const fetchRecentChecks = (params = {}) => {
  const search = new URLSearchParams(params).toString();
  return apiGet(`/checks${search ? `?${search}` : ''}`);
};
export const fetchCheckBatch = (id) => apiGet(`/checks/${id}`);
export const recheckBatch = (id) => apiPost(`/checks/${id}/recheck`, {});

export function uploadCheckFile(file, deepCheck) {
  const fd = new FormData();
  fd.append('file', file);
  fd.append('deepCheck', String(deepCheck));
  return apiFetch('/checks/upload', { method: 'POST', body: fd });
}

export const cleanExportUrl = (batchId) => `/api/checks/${batchId}/export?scope=deliverable`;
export const suppressedExportUrl = (batchId) => `/api/checks/${batchId}/export?scope=suppressed`;

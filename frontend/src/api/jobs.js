import { apiFetch, apiGet, apiPost } from './client';

export function stageFile(file) {
  const fd = new FormData();
  fd.append('file', file);
  return apiFetch('/jobs/stage', { method: 'POST', body: fd });
}

export const createImportJob = (payload) => apiPost('/jobs', payload);
export const fetchJob = (id) => apiGet(`/jobs/${id}`);
export const fetchRecentJobs = (params = {}) => {
  const search = new URLSearchParams(params).toString();
  return apiGet(`/jobs${search ? `?${search}` : ''}`);
};
export const skippedReportUrl = (jobId) => `/api/jobs/${jobId}/skipped-report`;

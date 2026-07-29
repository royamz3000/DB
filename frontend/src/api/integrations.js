import { apiGet, apiPatch, apiPost } from './client';

export const fetchConstantContactConnections = () => apiGet('/integrations/constant-contact');
export const updateConnectionList = (id, destinationListId) =>
  apiPatch(`/integrations/constant-contact/${id}`, { destinationListId });
export const syncConnectionNow = (id) => apiPost(`/integrations/constant-contact/${id}/sync-now`, {});
export const disconnectConnection = (id) => apiPost(`/integrations/constant-contact/${id}/disconnect`, {});
export const constantContactConnectUrl = '/api/integrations/constant-contact/connect';

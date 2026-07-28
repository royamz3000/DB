import { apiGet, apiPatch } from './client';

export const fetchWebhookSettings = () => apiGet('/settings/webhooks');
export const updateWebhookSettings = (payload) => apiPatch('/settings/webhooks', payload);

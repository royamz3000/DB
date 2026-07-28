import { apiGet } from './client';

export const fetchOverviewStats = () => apiGet('/stats/overview');

import { apiGet, apiPost } from './client';

export const fetchTables = () => apiGet('/database/tables');
export const fetchTableRows = (table, page, pageSize) =>
  apiGet(`/database/tables/${table}?${new URLSearchParams({ page, pageSize }).toString()}`);
export const runSqlQuery = (sql) => apiPost('/database/query', { sql });
export const resetDatabase = () => apiPost('/database/reset', {});

import { httpClient } from "@/utils/http";

export type PageData<T> = { list: T[]; total: number };
export type DashboardData = { visitorCount: number; onlineUsers: number; ipCount: number; visitTotal: number; moduleVisits: PageData<{ module: string; visits: number }>; moduleLabels?: Record<string, string>; moduleVisitTrend: { days: string[]; list: Array<{ day: string; module: string; visits: number }> }; recentActions: AuditLogRow[] };
export type UserRow = { id: string; username: string; code?: string; role: string; disabled: boolean; createdAt?: string };
export type UserOption = { id: string; username: string; role: string };
export type VisitorRow = Record<string, unknown> & { id: number; module: string; key?: string; connection_status?: "online" | "offline"; user_id: number; username?: string; token?: string; ip: string; item1: string; visit_count?: number };
export type BlacklistRow = { id: number; user_id: number; username?: string; ip: string; created_at: string };
export type MappingRow = { id: number; map_key: string; map_value: string };
export type DataDictionaryRow = { key: string; label: string };
export type DataDictionaryCreateInput = DataDictionaryRow;
export type TemplateRow = { id: number; module: string; label?: string; keys?: string[]; title: string; site_title?: string; form_title?: string; enabled: boolean };
export type BatchIDsRequest = { ids: number[]; action: string };
export type AuditLogRow = { id: number; operator_id?: number; operator_name: string; target_user_id?: number; action: string; target_type: string; target_ids: string; target_ref: string; request_ip: string; success: boolean; error_message?: string; created_at: string };
export type AuditOperator = { id: string; username: string; role: string };
export type AuditLogFilters = { operatorId?: string; action?: string; success?: string; startAt?: string; endAt?: string };

export const businessApi = {
  dashboard: (page: number, pageSize: number) => httpClient.get<DashboardData>("/api/dashboard", { params: { page, pageSize } }),
  users: (page: number, pageSize: number) => httpClient.get<PageData<UserRow>>("/api/users", { params: { page, pageSize } }),
  userOptions: () => httpClient.get<UserOption[]>("/api/users/options"),
  // 2026-09-10 11:31:06 CST：管理员需要按用户查看业务数据，userId 仅作为查询条件传递，最终权限由后端 token 角色校验。
  blacklist: (page: number, pageSize: number, userId?: string) => httpClient.get<PageData<BlacklistRow>>("/api/blacklist", { params: { page, pageSize, userId } }),
  visitors: (page: number, pageSize: number, userId?: string) => httpClient.get<PageData<VisitorRow>>("/api/visitors", { params: { page, pageSize, userId } }),
  mappings: (page: number, pageSize: number) => httpClient.get<PageData<MappingRow>>("/api/mappings", { params: { page, pageSize } }),
  exportMappings: () => httpClient.get<{ entries: Array<{ key: string; value: string }> }>("/api/mappings/export"),
  importMappings: (entries: Array<{ key: string; value: string }>) => httpClient.post<{ imported: number }>("/api/mappings/import", { entries }),
  dictionary: (page: number, pageSize: number) => httpClient.get<PageData<DataDictionaryRow>>("/api/dictionary", { params: { page, pageSize } }),
  exportDictionary: () => httpClient.get<{ entries: DataDictionaryRow[] }>("/api/dictionary/export"),
  importDictionary: (entries: DataDictionaryRow[]) => httpClient.post<{ imported: number }>("/api/dictionary/import", { entries }),
  ipRegion: (ip: string) => httpClient.get<{ region: string }>("/api/ip-region", { params: { ip } }),
  createDictionary: (entry: DataDictionaryCreateInput) => httpClient.post("/api/dictionary", entry),
  updateDictionary: (key: string, label: string) => httpClient.put(`/api/dictionary/${encodeURIComponent(key)}`, { label }),
  deleteDictionary: (key: string) => httpClient.delete(`/api/dictionary/${encodeURIComponent(key)}`),
  templates: (page: number, pageSize: number) => httpClient.get<PageData<TemplateRow>>("/api/templates", { params: { page, pageSize } }),
  exportTemplates: () => httpClient.get<{ entries: TemplateRow[] }>("/api/templates/export"),
  importTemplates: (entries: Array<{ module: string; label: string; keys: string[]; title: string; siteTitle: string; formTitle: string; enabled: boolean }>) => httpClient.post<{ imported: number }>("/api/templates/import", { entries }),
  auditLogs: (page: number, pageSize: number, filters: AuditLogFilters) => httpClient.get<PageData<AuditLogRow>>("/api/audit-logs", { params: { page, pageSize, ...filters } }),
  auditOperators: () => httpClient.get<AuditOperator[]>("/api/audit-logs/operators"),
};

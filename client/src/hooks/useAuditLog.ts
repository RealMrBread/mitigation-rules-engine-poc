import { useQuery } from '@tanstack/react-query';
import { apiClient } from '@/lib/api';

export interface AuditLogEntry {
  id: string;
  action: string;
  entity_type: string;
  entity_id: string | null;
  user_id: string;
  details: unknown;
  created_at: string;
}

export function useAuditLog() {
  return useQuery({
    queryKey: ['audit-log'],
    queryFn: () => apiClient.get<AuditLogEntry[]>('/admin/audit-log'),
    staleTime: 30 * 1000,
  });
}

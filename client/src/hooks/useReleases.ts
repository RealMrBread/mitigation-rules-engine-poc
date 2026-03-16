import { useMutation, useQuery } from '@tanstack/react-query';
import { apiClient } from '@/lib/api';
import { queryClient } from '@/lib/query-client';

// --------------------------------------------------------------------------
// Types for release API responses
// --------------------------------------------------------------------------

export interface ReleaseListItem {
  id: string;
  name: string;
  published_at: string;
  published_by: string;
  is_active: boolean;
}

export interface ReleaseDetail extends ReleaseListItem {}

export interface ReleaseRuleItem {
  id: string;
  release_id: string;
  rule_id: string;
  rule_snapshot: unknown;
}

// --------------------------------------------------------------------------
// useReleaseList -- GET /api/releases
// --------------------------------------------------------------------------

export function useReleaseList() {
  return useQuery({
    queryKey: ['releases'],
    queryFn: () => apiClient.get<ReleaseListItem[]>('/releases'),
    staleTime: 30 * 1000,
  });
}

// --------------------------------------------------------------------------
// useRelease -- GET /api/releases/:id
// --------------------------------------------------------------------------

export function useRelease(id: string | undefined) {
  return useQuery({
    queryKey: ['releases', id],
    queryFn: () => apiClient.get<ReleaseDetail>(`/releases/${id}`),
    enabled: !!id,
  });
}

// --------------------------------------------------------------------------
// useReleaseRules -- GET /api/releases/:id/rules
// --------------------------------------------------------------------------

export function useReleaseRules(id: string | undefined) {
  return useQuery({
    queryKey: ['releases', id, 'rules'],
    queryFn: () => apiClient.get<ReleaseRuleItem[]>(`/releases/${id}/rules`),
    enabled: !!id,
  });
}

// --------------------------------------------------------------------------
// usePublishRelease -- POST /api/releases
// --------------------------------------------------------------------------

export function usePublishRelease() {
  return useMutation({
    mutationFn: async (name: string) => {
      return apiClient.post<ReleaseDetail>('/releases', { name });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['releases'] });
    },
  });
}

// --------------------------------------------------------------------------
// useActivateRelease -- PUT /api/releases/:id/activate
// --------------------------------------------------------------------------

export function useActivateRelease() {
  return useMutation({
    mutationFn: async (id: string) => {
      return apiClient.put<ReleaseDetail>(`/releases/${id}/activate`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['releases'] });
    },
  });
}

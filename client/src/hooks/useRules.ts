import { useMutation, useQuery } from '@tanstack/react-query';
import { apiClient } from '@/lib/api';
import { queryClient } from '@/lib/query-client';
import type { RuleType } from '@shared/types/rule.js';

// --------------------------------------------------------------------------
// Types for rule API responses
// --------------------------------------------------------------------------

export interface RuleListItem {
  id: string;
  name: string;
  description: string | null;
  type: string;
  config: unknown;
  mitigations: unknown[];
  version: number;
  createdAt: string;
  updatedAt: string;
}

export interface RuleDetail extends RuleListItem {}

// --------------------------------------------------------------------------
// useRuleList -- GET /api/rules
// --------------------------------------------------------------------------

export function useRuleList() {
  return useQuery({
    queryKey: ['rules'],
    queryFn: () => apiClient.get<RuleListItem[]>('/rules'),
    staleTime: 30 * 1000,
  });
}

// --------------------------------------------------------------------------
// useRule -- GET /api/rules/:id
// --------------------------------------------------------------------------

export function useRule(id: string | undefined) {
  return useQuery({
    queryKey: ['rules', id],
    queryFn: () => apiClient.get<RuleDetail>(`/rules/${id}`),
    enabled: !!id,
  });
}

// --------------------------------------------------------------------------
// useCreateRule -- POST /api/rules
// --------------------------------------------------------------------------

export function useCreateRule() {
  return useMutation({
    mutationFn: async (data: {
      name: string;
      description: string;
      type: RuleType;
      config: unknown;
      mitigations: unknown[];
    }) => {
      return apiClient.post<RuleDetail>('/rules', data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['rules'] });
    },
  });
}

// --------------------------------------------------------------------------
// useUpdateRule -- PUT /api/rules/:id
// --------------------------------------------------------------------------

export function useUpdateRule() {
  return useMutation({
    mutationFn: async ({
      id,
      ...data
    }: {
      id: string;
      version: number;
      name?: string;
      description?: string;
      type?: RuleType;
      config?: unknown;
      mitigations?: unknown[];
    }) => {
      return apiClient.put<RuleDetail>(`/rules/${id}`, data);
    },
    onSuccess: (data) => {
      queryClient.setQueryData(['rules', data.id], data);
      queryClient.invalidateQueries({ queryKey: ['rules'] });
    },
  });
}

// --------------------------------------------------------------------------
// useDeleteRule -- DELETE /api/rules/:id
// --------------------------------------------------------------------------

export function useDeleteRule() {
  return useMutation({
    mutationFn: async (id: string) => {
      return apiClient.delete(`/rules/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['rules'] });
    },
  });
}

// --------------------------------------------------------------------------
// useTestRule -- POST /api/rules/:id/test
// --------------------------------------------------------------------------

export function useTestRule() {
  return useMutation({
    mutationFn: async ({
      ruleId,
      observations,
    }: {
      ruleId: string;
      observations: Record<string, unknown>;
    }) => {
      return apiClient.post<unknown>(`/rules/${ruleId}/test`, { observations });
    },
  });
}

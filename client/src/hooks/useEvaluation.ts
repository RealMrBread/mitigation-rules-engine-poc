import { useMutation, useQuery } from '@tanstack/react-query';
import { apiClient } from '@/lib/api';
import { queryClient } from '@/lib/query-client';
import type { EvaluateRequest } from '@shared/types/api.js';
import type { EvaluationResult } from '@shared/types/evaluation.js';

export type { EvaluationResult };

export interface EvaluationListItem {
  evaluation_id: string;
  created_at: string;
  state: string;
  property_id: string;
  auto_declined: boolean;
  total_vulnerabilities: number;
  mitigatable: number;
}

// --------------------------------------------------------------------------
// useSubmitEvaluation -- POST /api/evaluate
// --------------------------------------------------------------------------

export function useSubmitEvaluation() {
  return useMutation({
    mutationKey: ['evaluate'],
    mutationFn: async (request: EvaluateRequest) => {
      return apiClient.post<EvaluationResult>('/evaluate', request);
    },
    onSuccess: (data) => {
      // Pre-seed the cache so the results page doesn't need to re-fetch
      queryClient.setQueryData(['evaluation', data.evaluation_id], data);
    },
  });
}

// --------------------------------------------------------------------------
// useEvaluation -- GET /api/evaluations/:id
// --------------------------------------------------------------------------

export function useEvaluation(id: string | undefined) {
  return useQuery({
    queryKey: ['evaluation', id],
    queryFn: () => apiClient.get<EvaluationResult>(`/evaluations/${id}`),
    enabled: !!id,
    staleTime: Infinity, // Evaluations are immutable once created
  });
}

// --------------------------------------------------------------------------
// useEvaluationList -- GET /api/evaluations
// --------------------------------------------------------------------------

export function useEvaluationList(propertyId?: string) {
  return useQuery({
    queryKey: ['evaluations', { propertyId }],
    queryFn: () => {
      const params = propertyId ? `?property_id=${propertyId}` : '';
      return apiClient.get<EvaluationListItem[]>(`/evaluations${params}`);
    },
    staleTime: 30 * 1000, // 30 seconds
  });
}

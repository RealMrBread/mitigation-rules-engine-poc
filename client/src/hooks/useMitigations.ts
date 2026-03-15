import { useMutation } from '@tanstack/react-query';
import { apiClient } from '@/lib/api';
import { queryClient } from '@/lib/query-client';
import type { SelectMitigationsRequest } from '@shared/types/api.js';

// --------------------------------------------------------------------------
// useSelectMitigations -- POST /api/evaluate/:id/mitigations
// --------------------------------------------------------------------------

export function useSelectMitigations(evaluationId: string) {
  return useMutation({
    mutationKey: ['submitMitigations', evaluationId],
    mutationFn: async (request: SelectMitigationsRequest) => {
      return apiClient.post<{ success: boolean }>(
        `/evaluate/${evaluationId}/mitigations`,
        request,
      );
    },
    onSuccess: () => {
      // Invalidate the evaluation cache so re-fetching picks up saved mitigations
      queryClient.invalidateQueries({
        queryKey: ['evaluation', evaluationId],
      });
    },
  });
}

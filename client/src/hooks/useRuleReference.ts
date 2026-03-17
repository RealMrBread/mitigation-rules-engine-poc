import { useQuery } from '@tanstack/react-query';
import { apiClient } from '@/lib/api';

export type RuleSnapshotType =
  | 'simple_threshold'
  | 'conditional_threshold'
  | 'computed_with_modifiers';

export interface RuleSnapshotMitigation {
  id: string;
  name: string;
  description: string;
  category: 'full' | 'bridge';
  effect?: string;
}

export interface RuleSnapshot {
  id: string;
  name: string;
  description: string;
  type: RuleSnapshotType;
  config: Record<string, unknown>;
  mitigations: RuleSnapshotMitigation[];
}

export interface ActiveReleaseRulesResponse {
  release_name: string;
  rules: RuleSnapshot[];
}

export function useActiveReleaseRules() {
  return useQuery({
    queryKey: ['releases', 'active', 'rules'],
    queryFn: () => apiClient.get<ActiveReleaseRulesResponse>('/releases/active/rules'),
    staleTime: 60 * 1000,
  });
}

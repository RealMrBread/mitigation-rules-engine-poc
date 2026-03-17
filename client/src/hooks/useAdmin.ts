import { useMutation, useQuery } from '@tanstack/react-query';
import { apiClient } from '@/lib/api';
import { queryClient } from '@/lib/query-client';
import type { Role } from '@shared/types/user.js';

interface AdminSettings {
  bridge_mitigation_limit: number;
}

interface AdminUser {
  id: string;
  email: string;
  role: Role;
  createdAt?: string;
}

export function useSettings() {
  return useQuery({
    queryKey: ['admin', 'settings'],
    queryFn: () => apiClient.get<AdminSettings>('/admin/settings'),
  });
}

export function useUpdateSettings() {
  return useMutation({
    mutationFn: (data: { bridge_mitigation_limit: number }) =>
      apiClient.put<AdminSettings>('/admin/settings', data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin', 'settings'] });
    },
  });
}

export function useUserList() {
  return useQuery({
    queryKey: ['admin', 'users'],
    queryFn: () => apiClient.get<AdminUser[]>('/admin/users'),
  });
}

export function useCreateUser() {
  return useMutation({
    mutationFn: (data: { email: string; password: string; role: Role }) =>
      apiClient.post<AdminUser>('/admin/users', data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin', 'users'] });
    },
  });
}

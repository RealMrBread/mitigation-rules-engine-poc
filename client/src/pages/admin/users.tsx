import { useState } from 'react';
import { useUserList, useCreateUser } from '@/hooks/useAdmin';
import { ApiClientError } from '@/lib/api';
import type { Role } from '@shared/types/user.js';

const inputClass =
  'w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500';
const labelClass = 'block text-sm font-medium text-gray-700 mb-1';

const ROLE_LABELS: Record<Role, { label: string; color: string }> = {
  admin: { label: 'Admin', color: 'bg-red-100 text-red-700' },
  applied_science: { label: 'Applied Science', color: 'bg-purple-100 text-purple-700' },
  underwriter: { label: 'Underwriter', color: 'bg-blue-100 text-blue-700' },
};

function formatDate(isoString: string): string {
  return new Date(isoString).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
}

function SkeletonRow() {
  return (
    <tr className="animate-pulse">
      <td className="px-6 py-4"><div className="h-4 bg-gray-200 rounded w-48" /></td>
      <td className="px-6 py-4"><div className="h-4 bg-gray-200 rounded w-24" /></td>
      <td className="px-6 py-4"><div className="h-4 bg-gray-200 rounded w-28" /></td>
    </tr>
  );
}

export function AdminUsersPage() {
  const { data: users, isLoading, error } = useUserList();
  const createUser = useCreateUser();
  const [showForm, setShowForm] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [role, setRole] = useState<Role>('underwriter');
  const [toast, setToast] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  const showToast = (type: 'success' | 'error', message: string) => {
    setToast({ type, message });
    setTimeout(() => setToast(null), 3000);
  };

  const resetForm = () => {
    setEmail('');
    setPassword('');
    setRole('underwriter');
    setShowForm(false);
  };

  const handleCreate = async () => {
    if (!email.trim() || !password.trim()) {
      showToast('error', 'Email and password are required.');
      return;
    }

    try {
      await createUser.mutateAsync({ email: email.trim(), password, role });
      showToast('success', `User ${email.trim()} created successfully.`);
      resetForm();
    } catch (err) {
      const message =
        err instanceof ApiClientError ? err.message : 'Failed to create user.';
      showToast('error', message);
    }
  };

  return (
    <div className="max-w-4xl mx-auto px-8 py-8">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 className="text-xl font-semibold text-gray-900">Users</h2>
          <p className="text-sm text-gray-500 mt-1">Manage user accounts and roles.</p>
        </div>
        <button
          onClick={() => setShowForm(!showForm)}
          className="inline-flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2.5 text-sm font-medium text-white shadow-sm hover:bg-blue-700 transition-colors"
        >
          {showForm ? 'Cancel' : 'Create User'}
        </button>
      </div>

      {toast && (
        <div
          className={`mb-6 rounded-md border px-4 py-3 text-sm ${
            toast.type === 'success'
              ? 'border-green-200 bg-green-50 text-green-700'
              : 'border-red-200 bg-red-50 text-red-700'
          }`}
        >
          {toast.message}
        </div>
      )}

      {showForm && (
        <div className="bg-white rounded-lg border border-gray-200 shadow-sm p-6 mb-6">
          <h3 className="text-base font-semibold text-gray-900 mb-4">New User</h3>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div>
              <label htmlFor="new-email" className={labelClass}>Email</label>
              <input
                id="new-email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="user@example.com"
                className={inputClass}
              />
            </div>
            <div>
              <label htmlFor="new-password" className={labelClass}>Password</label>
              <input
                id="new-password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Min 8 characters"
                className={inputClass}
              />
            </div>
            <div>
              <label htmlFor="new-role" className={labelClass}>Role</label>
              <select
                id="new-role"
                value={role}
                onChange={(e) => setRole(e.target.value as Role)}
                className={inputClass}
              >
                <option value="underwriter">Underwriter</option>
                <option value="applied_science">Applied Science</option>
                <option value="admin">Admin</option>
              </select>
            </div>
          </div>
          <div className="mt-4">
            <button
              onClick={handleCreate}
              disabled={createUser.isPending}
              className="px-5 py-2.5 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 shadow-sm transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {createUser.isPending ? 'Creating...' : 'Create User'}
            </button>
          </div>
        </div>
      )}

      <div className="overflow-hidden rounded-lg border border-gray-200 bg-white shadow-sm">
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th scope="col" className="px-6 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">
                  Email
                </th>
                <th scope="col" className="px-6 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">
                  Role
                </th>
                <th scope="col" className="px-6 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">
                  Created
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {isLoading && (
                <>
                  <SkeletonRow />
                  <SkeletonRow />
                  <SkeletonRow />
                </>
              )}

              {error && !isLoading && (
                <tr>
                  <td colSpan={3} className="px-6 py-12 text-center text-sm text-red-600">
                    Failed to load users. Please try again.
                  </td>
                </tr>
              )}

              {!isLoading && !error && users && users.length === 0 && (
                <tr>
                  <td colSpan={3} className="px-6 py-12 text-center text-sm text-gray-500">
                    No users found.
                  </td>
                </tr>
              )}

              {!isLoading &&
                !error &&
                users?.map((user, index) => {
                  const roleInfo = ROLE_LABELS[user.role] ?? { label: user.role, color: 'bg-gray-100 text-gray-700' };
                  return (
                    <tr
                      key={user.id}
                      className={`transition-colors hover:bg-gray-50 ${index % 2 === 1 ? 'bg-gray-50/50' : 'bg-white'}`}
                    >
                      <td className="px-6 py-4 text-sm text-gray-900">{user.email}</td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${roleInfo.color}`}>
                          {roleInfo.label}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-sm text-gray-600 whitespace-nowrap">
                        {user.createdAt ? formatDate(user.createdAt) : '-'}
                      </td>
                    </tr>
                  );
                })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

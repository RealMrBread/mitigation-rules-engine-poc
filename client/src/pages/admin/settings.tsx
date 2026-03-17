import { useState } from 'react';
import { useSettings, useUpdateSettings } from '@/hooks/useAdmin';
import { ApiClientError } from '@/lib/api';

const inputClass =
  'w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500';
const labelClass = 'block text-sm font-medium text-gray-700 mb-1';
const cardClass =
  'bg-white rounded-lg border border-gray-200 shadow-sm p-6 mb-6';

export function AdminSettingsPage() {
  const { data: settings, isLoading, error } = useSettings();
  const updateSettings = useUpdateSettings();
  const [limit, setLimit] = useState<string>('');
  const [initialized, setInitialized] = useState(false);
  const [toast, setToast] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  if (settings && !initialized) {
    setLimit(String(settings.bridge_mitigation_limit));
    setInitialized(true);
  }

  const showToast = (type: 'success' | 'error', message: string) => {
    setToast({ type, message });
    setTimeout(() => setToast(null), 3000);
  };

  const handleSave = async () => {
    const parsed = Number(limit);
    if (!Number.isInteger(parsed) || parsed < 1) {
      showToast('error', 'Limit must be a positive integer.');
      return;
    }

    try {
      await updateSettings.mutateAsync({ bridge_mitigation_limit: parsed });
      showToast('success', 'Settings saved successfully.');
    } catch (err) {
      const message =
        err instanceof ApiClientError ? err.message : 'Failed to save settings.';
      showToast('error', message);
    }
  };

  return (
    <div className="max-w-2xl mx-auto px-8 py-8">
      <div className="mb-6">
        <h2 className="text-xl font-semibold text-gray-900">Settings</h2>
        <p className="text-sm text-gray-500 mt-1">
          Configure global parameters for the rules engine.
        </p>
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

      {isLoading && (
        <div className={cardClass}>
          <div className="animate-pulse space-y-4">
            <div className="h-4 bg-gray-200 rounded w-48" />
            <div className="h-10 bg-gray-200 rounded w-32" />
          </div>
        </div>
      )}

      {error && !isLoading && (
        <div className="rounded-md border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          Failed to load settings. Please try again.
        </div>
      )}

      {settings && (
        <div className={cardClass}>
          <div className="max-w-xs">
            <label htmlFor="bridge_limit" className={labelClass}>
              Bridge Mitigation Limit
            </label>
            <p className="text-xs text-gray-400 mb-2">
              Maximum number of bridge mitigations allowed per evaluation.
            </p>
            <input
              id="bridge_limit"
              type="number"
              min="1"
              step="1"
              value={limit}
              onChange={(e) => setLimit(e.target.value)}
              className={inputClass}
            />
          </div>

          <div className="mt-6">
            <button
              onClick={handleSave}
              disabled={updateSettings.isPending}
              className="px-5 py-2.5 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 shadow-sm transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {updateSettings.isPending ? 'Saving...' : 'Save Settings'}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

import { useAuditLog, type AuditLogEntry } from '@/hooks/useAuditLog';

function formatDate(isoString: string): string {
  const date = new Date(isoString);
  return date.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function truncate(value: string | null, len = 8): string {
  if (!value) return '-';
  return value.length > len ? `${value.slice(0, len)}...` : value;
}

function formatDetails(details: unknown): string {
  if (details === null || details === undefined) return '-';
  try {
    return JSON.stringify(details);
  } catch {
    return String(details);
  }
}

const ACTION_COLORS: Record<string, string> = {
  'release.published': 'bg-green-100 text-green-700',
  'release.activated': 'bg-blue-100 text-blue-700',
  'settings.updated': 'bg-amber-100 text-amber-700',
  'user.created': 'bg-purple-100 text-purple-700',
};

function SkeletonRow() {
  return (
    <tr className="animate-pulse">
      <td className="px-6 py-4"><div className="h-4 bg-gray-200 rounded w-36" /></td>
      <td className="px-6 py-4"><div className="h-4 bg-gray-200 rounded w-28" /></td>
      <td className="px-6 py-4"><div className="h-4 bg-gray-200 rounded w-16" /></td>
      <td className="px-6 py-4"><div className="h-4 bg-gray-200 rounded w-16" /></td>
      <td className="px-6 py-4"><div className="h-4 bg-gray-200 rounded w-16" /></td>
      <td className="px-6 py-4"><div className="h-4 bg-gray-200 rounded w-40" /></td>
    </tr>
  );
}

export function AuditLogPage() {
  const { data: entries, isLoading, error } = useAuditLog();

  return (
    <div className="max-w-6xl mx-auto px-8 py-8">
      <div className="mb-6">
        <h2 className="text-xl font-semibold text-gray-900">Audit Log</h2>
        <p className="text-sm text-gray-500 mt-1">
          Recent system activity (last 100 entries).
        </p>
      </div>

      <div className="overflow-hidden rounded-lg border border-gray-200 bg-white shadow-sm">
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th scope="col" className="px-6 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">
                  Timestamp
                </th>
                <th scope="col" className="px-6 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">
                  Action
                </th>
                <th scope="col" className="px-6 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">
                  Entity Type
                </th>
                <th scope="col" className="px-6 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">
                  Entity ID
                </th>
                <th scope="col" className="px-6 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">
                  User ID
                </th>
                <th scope="col" className="px-6 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">
                  Details
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
                  <td colSpan={6} className="px-6 py-12 text-center text-sm text-red-600">
                    Failed to load audit log. Please try again.
                  </td>
                </tr>
              )}

              {!isLoading && !error && entries && entries.length === 0 && (
                <tr>
                  <td colSpan={6} className="px-6 py-16 text-center">
                    <p className="text-sm text-gray-500">No audit log entries yet.</p>
                  </td>
                </tr>
              )}

              {!isLoading &&
                !error &&
                entries?.map((entry: AuditLogEntry, index: number) => {
                  const actionColor = ACTION_COLORS[entry.action] ?? 'bg-gray-100 text-gray-700';
                  return (
                    <tr
                      key={entry.id}
                      className={`transition-colors hover:bg-gray-50 ${index % 2 === 1 ? 'bg-gray-50/50' : 'bg-white'}`}
                    >
                      <td className="px-6 py-4 text-sm text-gray-600 whitespace-nowrap">
                        {formatDate(entry.created_at)}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${actionColor}`}>
                          {entry.action}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-sm text-gray-600 whitespace-nowrap capitalize">
                        {entry.entity_type}
                      </td>
                      <td className="px-6 py-4 text-sm text-gray-600 whitespace-nowrap font-mono">
                        {truncate(entry.entity_id)}
                      </td>
                      <td className="px-6 py-4 text-sm text-gray-600 whitespace-nowrap font-mono">
                        {truncate(entry.user_id)}
                      </td>
                      <td className="px-6 py-4 text-sm text-gray-500 max-w-xs truncate font-mono">
                        {formatDetails(entry.details)}
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

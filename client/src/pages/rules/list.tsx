import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useRuleList, useDeleteRule, type RuleListItem } from '@/hooks/useRules';

// ---------------------------------------------------------------------------
// Icons
// ---------------------------------------------------------------------------

function PlusIcon() {
  return (
    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
    </svg>
  );
}

function PencilIcon() {
  return (
    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
    </svg>
  );
}

function TrashIcon() {
  return (
    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
    </svg>
  );
}

function SpinnerIcon() {
  return (
    <svg className="w-5 h-5 animate-spin" fill="none" viewBox="0 0 24 24">
      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
    </svg>
  );
}

function InboxIcon() {
  return (
    <svg className="w-12 h-12 text-gray-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M20 13V6a2 2 0 00-2-2H6a2 2 0 00-2 2v7m16 0v5a2 2 0 01-2 2H6a2 2 0 01-2-2v-5m16 0h-2.586a1 1 0 00-.707.293l-2.414 2.414a1 1 0 01-.707.293h-3.172a1 1 0 01-.707-.293l-2.414-2.414A1 1 0 006.586 13H4" />
    </svg>
  );
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const TYPE_LABELS: Record<string, { label: string; color: string }> = {
  simple_threshold: { label: 'Simple', color: 'bg-blue-100 text-blue-700' },
  conditional_threshold: { label: 'Conditional', color: 'bg-purple-100 text-purple-700' },
  computed_with_modifiers: { label: 'Computed', color: 'bg-amber-100 text-amber-700' },
};

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

// ---------------------------------------------------------------------------
// Delete confirmation dialog
// ---------------------------------------------------------------------------

function DeleteDialog({
  rule,
  onConfirm,
  onCancel,
  isDeleting,
}: {
  rule: RuleListItem;
  onConfirm: () => void;
  onCancel: () => void;
  isDeleting: boolean;
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
      <div className="bg-white rounded-lg shadow-xl max-w-md w-full mx-4 p-6">
        <h3 className="text-lg font-semibold text-gray-900">Delete Rule</h3>
        <p className="mt-2 text-sm text-gray-600">
          Are you sure you want to delete <strong>{rule.name}</strong>? This action cannot be undone.
        </p>
        <div className="mt-6 flex justify-end gap-3">
          <button
            onClick={onCancel}
            disabled={isDeleting}
            className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            onClick={onConfirm}
            disabled={isDeleting}
            className="px-4 py-2 text-sm font-medium text-white bg-red-600 rounded-lg hover:bg-red-700 transition-colors disabled:opacity-50 flex items-center gap-2"
          >
            {isDeleting && <SpinnerIcon />}
            Delete
          </button>
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Skeleton rows
// ---------------------------------------------------------------------------

function SkeletonRow() {
  return (
    <tr className="animate-pulse">
      <td className="px-6 py-4"><div className="h-4 bg-gray-200 rounded w-48" /></td>
      <td className="px-6 py-4"><div className="h-4 bg-gray-200 rounded w-20" /></td>
      <td className="px-6 py-4"><div className="h-4 bg-gray-200 rounded w-10" /></td>
      <td className="px-6 py-4"><div className="h-4 bg-gray-200 rounded w-36" /></td>
      <td className="px-6 py-4"><div className="h-4 bg-gray-200 rounded w-20" /></td>
    </tr>
  );
}

// ---------------------------------------------------------------------------
// RuleListPage
// ---------------------------------------------------------------------------

export function RuleListPage() {
  const navigate = useNavigate();
  const { data: rules, isLoading, error } = useRuleList();
  const deleteRule = useDeleteRule();
  const [ruleToDelete, setRuleToDelete] = useState<RuleListItem | null>(null);

  function handleDelete() {
    if (!ruleToDelete) return;
    deleteRule.mutate(ruleToDelete.id, {
      onSuccess: () => setRuleToDelete(null),
    });
  }

  return (
    <div className="max-w-6xl mx-auto px-8 py-8">
      {/* Page header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 className="text-xl font-semibold text-gray-900">Rules</h2>
          <p className="text-sm text-gray-500 mt-1">
            Manage draft underwriting rules. Publish them to a release to make them active.
          </p>
        </div>
        <button
          onClick={() => navigate('/rules/new')}
          className="inline-flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2.5 text-sm font-medium text-white shadow-sm hover:bg-blue-700 transition-colors"
        >
          <PlusIcon />
          New Rule
        </button>
      </div>

      {/* Table */}
      <div className="overflow-hidden rounded-lg border border-gray-200 bg-white shadow-sm">
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th scope="col" className="px-6 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">
                  Name
                </th>
                <th scope="col" className="px-6 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">
                  Type
                </th>
                <th scope="col" className="px-6 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">
                  Mitigations
                </th>
                <th scope="col" className="px-6 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">
                  Last Updated
                </th>
                <th scope="col" className="px-6 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {/* Loading */}
              {isLoading && (
                <>
                  <SkeletonRow />
                  <SkeletonRow />
                  <SkeletonRow />
                </>
              )}

              {/* Error */}
              {error && !isLoading && (
                <tr>
                  <td colSpan={5} className="px-6 py-12 text-center text-sm text-red-600">
                    Failed to load rules. Please try again.
                  </td>
                </tr>
              )}

              {/* Empty */}
              {!isLoading && !error && rules && rules.length === 0 && (
                <tr>
                  <td colSpan={5} className="px-6 py-16 text-center">
                    <div className="flex flex-col items-center">
                      <InboxIcon />
                      <p className="mt-3 text-sm font-medium text-gray-900">No rules yet</p>
                      <p className="mt-1 text-sm text-gray-500">Create your first underwriting rule to get started.</p>
                      <button
                        onClick={() => navigate('/rules/new')}
                        className="mt-4 inline-flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white shadow-sm hover:bg-blue-700 transition-colors"
                      >
                        <PlusIcon />
                        New Rule
                      </button>
                    </div>
                  </td>
                </tr>
              )}

              {/* Data rows */}
              {!isLoading &&
                !error &&
                rules?.map((rule, index) => {
                  const typeInfo = TYPE_LABELS[rule.type] ?? { label: rule.type, color: 'bg-gray-100 text-gray-700' };
                  const mitigationCount = Array.isArray(rule.mitigations) ? rule.mitigations.length : 0;

                  return (
                    <tr
                      key={rule.id}
                      className={`transition-colors hover:bg-gray-50 ${index % 2 === 1 ? 'bg-gray-50/50' : 'bg-white'}`}
                    >
                      <td className="px-6 py-4">
                        <div>
                          <Link
                            to={`/rules/${rule.id}`}
                            className="text-sm font-medium text-gray-900 hover:text-blue-600 transition-colors"
                          >
                            {rule.name}
                          </Link>
                          {rule.description && (
                            <p className="text-xs text-gray-500 mt-0.5 truncate max-w-xs">
                              {rule.description}
                            </p>
                          )}
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${typeInfo.color}`}>
                          {typeInfo.label}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-sm text-gray-600 whitespace-nowrap">
                        {mitigationCount}
                        {mitigationCount === 0 && (
                          <span className="ml-1.5 text-xs text-red-500 font-medium">(auto-decline)</span>
                        )}
                      </td>
                      <td className="px-6 py-4 text-sm text-gray-600 whitespace-nowrap">
                        {formatDate(rule.updatedAt)}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="flex items-center gap-2">
                          <Link
                            to={`/rules/${rule.id}`}
                            className="inline-flex items-center gap-1 text-sm font-medium text-blue-600 hover:text-blue-700 transition-colors"
                            aria-label={`Edit ${rule.name}`}
                          >
                            <PencilIcon />
                            Edit
                          </Link>
                          <button
                            onClick={() => setRuleToDelete(rule)}
                            className="inline-flex items-center gap-1 text-sm font-medium text-red-600 hover:text-red-700 transition-colors"
                            aria-label={`Delete ${rule.name}`}
                          >
                            <TrashIcon />
                            Delete
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
            </tbody>
          </table>
        </div>
      </div>

      {/* Delete confirmation */}
      {ruleToDelete && (
        <DeleteDialog
          rule={ruleToDelete}
          onConfirm={handleDelete}
          onCancel={() => setRuleToDelete(null)}
          isDeleting={deleteRule.isPending}
        />
      )}
    </div>
  );
}

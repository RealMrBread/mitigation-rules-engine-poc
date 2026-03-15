import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useEvaluationList } from '@/hooks/useEvaluation';

// ---------------------------------------------------------------------------
// Icons
// ---------------------------------------------------------------------------

function SearchIcon() {
  return (
    <svg
      className="w-4 h-4 text-gray-400"
      fill="none"
      stroke="currentColor"
      viewBox="0 0 24 24"
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={2}
        d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
      />
    </svg>
  );
}

function SpinnerIcon() {
  return (
    <svg className="w-5 h-5 animate-spin" fill="none" viewBox="0 0 24 24">
      <circle
        className="opacity-25"
        cx="12"
        cy="12"
        r="10"
        stroke="currentColor"
        strokeWidth="4"
      />
      <path
        className="opacity-75"
        fill="currentColor"
        d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
      />
    </svg>
  );
}

function EyeIcon() {
  return (
    <svg
      className="w-4 h-4"
      fill="none"
      stroke="currentColor"
      viewBox="0 0 24 24"
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={2}
        d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"
      />
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={2}
        d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z"
      />
    </svg>
  );
}

function InboxIcon() {
  return (
    <svg
      className="w-12 h-12 text-gray-300"
      fill="none"
      stroke="currentColor"
      viewBox="0 0 24 24"
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={1.5}
        d="M20 13V6a2 2 0 00-2-2H6a2 2 0 00-2 2v7m16 0v5a2 2 0 01-2 2H6a2 2 0 01-2-2v-5m16 0h-2.586a1 1 0 00-.707.293l-2.414 2.414a1 1 0 01-.707.293h-3.172a1 1 0 01-.707-.293l-2.414-2.414A1 1 0 006.586 13H4"
      />
    </svg>
  );
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

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
// Skeleton rows for loading state
// ---------------------------------------------------------------------------

function SkeletonRow() {
  return (
    <tr className="animate-pulse">
      <td className="px-6 py-4">
        <div className="h-4 bg-gray-200 rounded w-32" />
      </td>
      <td className="px-6 py-4">
        <div className="h-4 bg-gray-200 rounded w-36" />
      </td>
      <td className="px-6 py-4">
        <div className="h-4 bg-gray-200 rounded w-20" />
      </td>
      <td className="px-6 py-4">
        <div className="h-4 bg-gray-200 rounded w-10" />
      </td>
      <td className="px-6 py-4">
        <div className="h-4 bg-gray-200 rounded w-16" />
      </td>
      <td className="px-6 py-4">
        <div className="h-4 bg-gray-200 rounded w-14" />
      </td>
    </tr>
  );
}

// ---------------------------------------------------------------------------
// EvaluationHistoryPage
// ---------------------------------------------------------------------------

export function EvaluationHistoryPage() {
  const [filterValue, setFilterValue] = useState('');
  const propertyIdFilter = filterValue.trim() || undefined;
  const { data: evaluations, isLoading, error } = useEvaluationList(propertyIdFilter);

  return (
    <div className="max-w-6xl mx-auto px-8 py-8">
      {/* Page header */}
      <div className="mb-6">
        <h2 className="text-xl font-semibold text-gray-900">
          Evaluation History
        </h2>
        <p className="text-sm text-gray-500 mt-1">
          Browse past evaluations and view their results.
        </p>
      </div>

      {/* Filter bar */}
      <div className="mb-6">
        <div className="relative max-w-sm">
          <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3">
            <SearchIcon />
          </div>
          <input
            type="text"
            value={filterValue}
            onChange={(e) => setFilterValue(e.target.value)}
            placeholder="Filter by property ID..."
            className="block w-full rounded-lg border border-gray-300 bg-white py-2 pl-10 pr-3 text-sm text-gray-900 placeholder-gray-400 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 transition-colors"
            aria-label="Filter evaluations by property ID"
          />
        </div>
      </div>

      {/* Table */}
      <div className="overflow-hidden rounded-lg border border-gray-200 bg-white shadow-sm">
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th
                  scope="col"
                  className="px-6 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider"
                >
                  Property ID
                </th>
                <th
                  scope="col"
                  className="px-6 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider"
                >
                  Date
                </th>
                <th
                  scope="col"
                  className="px-6 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider"
                >
                  State
                </th>
                <th
                  scope="col"
                  className="px-6 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider"
                >
                  Vulnerabilities
                </th>
                <th
                  scope="col"
                  className="px-6 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider"
                >
                  Auto-Declined
                </th>
                <th
                  scope="col"
                  className="px-6 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider"
                >
                  Actions
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {/* Loading skeleton */}
              {isLoading && (
                <>
                  <SkeletonRow />
                  <SkeletonRow />
                  <SkeletonRow />
                  <SkeletonRow />
                  <SkeletonRow />
                </>
              )}

              {/* Error state */}
              {error && !isLoading && (
                <tr>
                  <td
                    colSpan={6}
                    className="px-6 py-12 text-center text-sm text-red-600"
                  >
                    Failed to load evaluations. Please try again.
                  </td>
                </tr>
              )}

              {/* Empty state */}
              {!isLoading && !error && evaluations && evaluations.length === 0 && (
                <tr>
                  <td colSpan={6} className="px-6 py-16 text-center">
                    <div className="flex flex-col items-center">
                      <InboxIcon />
                      <p className="mt-3 text-sm font-medium text-gray-900">
                        No evaluations found
                      </p>
                      <p className="mt-1 text-sm text-gray-500">
                        {filterValue
                          ? `No evaluations match "${filterValue}".`
                          : 'Run your first evaluation to see results here.'}
                      </p>
                      {!filterValue && (
                        <Link
                          to="/evaluation/new"
                          className="mt-4 inline-flex items-center rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white shadow-sm hover:bg-blue-700 transition-colors"
                        >
                          New Evaluation
                        </Link>
                      )}
                    </div>
                  </td>
                </tr>
              )}

              {/* Data rows */}
              {!isLoading &&
                !error &&
                evaluations?.map((evaluation, index) => (
                  <tr
                    key={evaluation.evaluation_id}
                    className={`transition-colors hover:bg-gray-50 ${
                      index % 2 === 1 ? 'bg-gray-50/50' : 'bg-white'
                    }`}
                  >
                    <td className="px-6 py-4 text-sm font-medium text-gray-900 whitespace-nowrap">
                      {evaluation.property_id}
                    </td>
                    <td className="px-6 py-4 text-sm text-gray-600 whitespace-nowrap">
                      {formatDate(evaluation.created_at)}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span
                        className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${
                          evaluation.state === 'completed'
                            ? 'bg-green-100 text-green-700'
                            : evaluation.state === 'pending'
                              ? 'bg-yellow-100 text-yellow-700'
                              : 'bg-gray-100 text-gray-700'
                        }`}
                      >
                        {evaluation.state}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-sm text-gray-600 whitespace-nowrap">
                      <span className="font-medium">
                        {evaluation.total_vulnerabilities}
                      </span>
                      <span className="text-gray-400 ml-1">
                        ({evaluation.mitigatable} mitigatable)
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      {evaluation.auto_declined ? (
                        <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold bg-red-100 text-red-700">
                          Auto-Declined
                        </span>
                      ) : (
                        <span className="text-sm text-gray-400">--</span>
                      )}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <Link
                        to={`/evaluations/${evaluation.evaluation_id}`}
                        className="inline-flex items-center gap-1.5 text-sm font-medium text-blue-600 hover:text-blue-700 transition-colors"
                        aria-label={`View evaluation for ${evaluation.property_id}`}
                      >
                        <EyeIcon />
                        View
                      </Link>
                    </td>
                  </tr>
                ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

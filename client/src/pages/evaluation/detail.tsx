import { useParams, Link } from 'react-router-dom';
import { useEvaluation } from '@/hooks/useEvaluation';
import { AutoDeclineBanner } from '@/components/evaluation/auto-decline-banner';
import { VulnerabilityCard } from '@/components/evaluation/vulnerability-card';
import type { EvaluationResult } from '@shared/types/evaluation.js';

// ---------------------------------------------------------------------------
// Icons
// ---------------------------------------------------------------------------

function ArrowLeftIcon() {
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
        d="M10 19l-7-7m0 0l7-7m-7 7h18"
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

// ---------------------------------------------------------------------------
// StatCard (read-only version)
// ---------------------------------------------------------------------------

function StatCard({
  value,
  label,
  borderColor = 'border-gray-200',
  textColor = 'text-gray-900',
}: {
  value: number;
  label: string;
  borderColor?: string;
  textColor?: string;
}) {
  return (
    <div
      className={`bg-white rounded-lg border ${borderColor} p-4 text-center`}
    >
      <p className={`text-2xl font-bold ${textColor}`}>{value}</p>
      <p className="text-xs text-gray-500 mt-1">{label}</p>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function formatDate(isoString: string): string {
  const date = new Date(isoString);
  return date.toLocaleDateString('en-US', {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

// ---------------------------------------------------------------------------
// EvaluationDetailPage
// ---------------------------------------------------------------------------

export function EvaluationDetailPage() {
  const { id } = useParams<{ id: string }>();
  const { data: evaluation, isLoading, error } = useEvaluation(id);

  // No-op handler for VulnerabilityCard (read-only mode)
  const noop = () => {};
  const emptySet = new Set<string>();

  // ---------------------------------------------------------------------------
  // Loading state
  // ---------------------------------------------------------------------------

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-24">
        <div className="flex items-center gap-3 text-gray-500">
          <SpinnerIcon />
          <span className="text-lg">Loading evaluation details...</span>
        </div>
      </div>
    );
  }

  // ---------------------------------------------------------------------------
  // Error state
  // ---------------------------------------------------------------------------

  if (error || !evaluation) {
    return (
      <div className="flex flex-col items-center justify-center py-24">
        <p className="text-lg text-red-600 mb-4">
          Failed to load evaluation details.
        </p>
        <Link
          to="/evaluations"
          className="text-sm text-blue-600 hover:text-blue-700 font-medium flex items-center gap-1"
        >
          <ArrowLeftIcon />
          Back to History
        </Link>
      </div>
    );
  }

  // Cast to the shared type
  const eval_ = evaluation as unknown as EvaluationResult;
  const { summary, vulnerabilities, auto_declined } = eval_;

  // Sort: unmitigatable first, then mitigatable
  const sortedVulnerabilities = [
    ...vulnerabilities.filter((v) => v.triggered),
  ].sort((a, b) => {
    const aUnmitigatable = a.mitigations.length === 0 ? 0 : 1;
    const bUnmitigatable = b.mitigations.length === 0 ? 0 : 1;
    return aUnmitigatable - bUnmitigatable;
  });

  return (
    <div className="max-w-5xl mx-auto px-8 py-8">
      {/* Back link */}
      <Link
        to="/evaluations"
        className="inline-flex items-center gap-1.5 text-sm text-blue-600 hover:text-blue-700 font-medium mb-6 transition-colors"
      >
        <ArrowLeftIcon />
        Back to History
      </Link>

      {/* Page header */}
      <div className="mb-6">
        <div className="flex items-start justify-between">
          <div>
            <h2 className="text-xl font-semibold text-gray-900">
              Evaluation Detail
            </h2>
            <p className="text-sm text-gray-500 mt-0.5">
              Evaluation #{id?.slice(0, 8)}
            </p>
          </div>
          <span className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium bg-gray-100 text-gray-600 border border-gray-200">
            Read-Only
          </span>
        </div>

        {/* Metadata row */}
        <div className="mt-4 flex flex-wrap items-center gap-x-6 gap-y-2 text-sm text-gray-600">
          {eval_.release && (
            <div className="flex items-center gap-2">
              <span className="text-gray-400">Release:</span>
              <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-blue-50 text-blue-700 border border-blue-200">
                {eval_.release.name}
              </span>
            </div>
          )}
          {(evaluation as any).created_at && (
            <div className="flex items-center gap-2">
              <span className="text-gray-400">Date:</span>
              <span className="font-medium">
                {formatDate((evaluation as any).created_at)}
              </span>
            </div>
          )}
          {(evaluation as any).property_id && (
            <div className="flex items-center gap-2">
              <span className="text-gray-400">Property:</span>
              <span className="font-medium">
                {(evaluation as any).property_id}
              </span>
            </div>
          )}
        </div>
      </div>

      {/* Summary stats */}
      <div className="grid grid-cols-2 lg:grid-cols-3 gap-4 mb-6">
        <StatCard
          value={summary.total_vulnerabilities}
          label="Total Vulnerabilities"
        />
        <StatCard
          value={summary.auto_decline_vulnerabilities}
          label="Auto-Decline"
          borderColor="border-red-200"
          textColor="text-red-600"
        />
        <StatCard
          value={summary.mitigatable}
          label="Mitigatable"
          borderColor="border-amber-200"
          textColor="text-amber-600"
        />
      </div>

      {/* Auto-decline banner */}
      {auto_declined && (
        <AutoDeclineBanner vulnerabilities={vulnerabilities} />
      )}

      {/* Observations summary -- skipped rules */}
      {eval_.skipped_rules.length > 0 && (
        <div className="mb-6 rounded-lg border border-gray-200 bg-white p-4">
          <h3 className="text-sm font-semibold text-gray-700 mb-2">
            Skipped Rules ({eval_.skipped_rules.length})
          </h3>
          <div className="space-y-2">
            {eval_.skipped_rules.map((rule) => (
              <div
                key={rule.rule_id}
                className="flex items-start gap-2 text-sm"
              >
                <span className="inline-flex items-center px-1.5 py-0.5 rounded text-xs font-medium bg-gray-100 text-gray-500 mt-0.5">
                  Skipped
                </span>
                <div>
                  <span className="font-medium text-gray-700">
                    {rule.rule_name}
                  </span>
                  <span className="text-gray-400 ml-2">{rule.reason}</span>
                  {rule.missingFields.length > 0 && (
                    <span className="text-gray-400 ml-1">
                      (missing: {rule.missingFields.join(', ')})
                    </span>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Vulnerability cards (read-only -- no mitigation toggling) */}
      <div className="space-y-4">
        {sortedVulnerabilities.length === 0 && (
          <div className="rounded-lg border border-gray-200 bg-white p-8 text-center">
            <p className="text-sm text-gray-500">
              No vulnerabilities were triggered in this evaluation.
            </p>
          </div>
        )}
        {sortedVulnerabilities.map((vuln) => (
          <VulnerabilityCard
            key={vuln.rule_id}
            vulnerability={vuln}
            selectedMitigations={emptySet}
            onToggleMitigation={noop}
            bridgeBudgetReached={false}
            isAutoDeclined={auto_declined}
          />
        ))}
      </div>

      {/* Bottom back link */}
      <div className="mt-8 pb-8">
        <Link
          to="/evaluations"
          className="inline-flex items-center gap-1.5 text-sm text-blue-600 hover:text-blue-700 font-medium transition-colors"
        >
          <ArrowLeftIcon />
          Back to History
        </Link>
      </div>
    </div>
  );
}

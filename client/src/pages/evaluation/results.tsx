import { useMemo, useState, useCallback } from 'react';
import { useParams, Link } from 'react-router-dom';
import { useEvaluation } from '@/hooks/useEvaluation';
import { useSelectMitigations } from '@/hooks/useMitigations';
import { AutoDeclineBanner } from '@/components/evaluation/auto-decline-banner';
import { VulnerabilityCard } from '@/components/evaluation/vulnerability-card';
import type { EvaluationResult } from '@shared/types/evaluation.js';
import type { SelectMitigationsRequest } from '@shared/types/api.js';

// ---------------------------------------------------------------------------
// Icons
// ---------------------------------------------------------------------------

function CheckIcon() {
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
        d="M5 13l4 4L19 7"
      />
    </svg>
  );
}

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
    <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
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

function InfoIcon() {
  return (
    <svg
      className="w-5 h-5 text-amber-500"
      fill="none"
      stroke="currentColor"
      viewBox="0 0 24 24"
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={2}
        d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
      />
    </svg>
  );
}

// ---------------------------------------------------------------------------
// StatCard sub-component
// ---------------------------------------------------------------------------

function StatCard({
  value,
  label,
  borderColor = 'border-gray-200',
  textColor = 'text-gray-900',
  suffix,
}: {
  value: number;
  label: string;
  borderColor?: string;
  textColor?: string;
  suffix?: string;
}) {
  return (
    <div
      className={`bg-white rounded-lg border ${borderColor} p-4 text-center`}
    >
      <p className={`text-2xl font-bold ${textColor}`}>{value}</p>
      <p className="text-xs text-gray-500 mt-1">
        {label}
        {suffix && (
          <>
            {' '}
            / <span className="font-semibold">{suffix}</span>
          </>
        )}
      </p>
    </div>
  );
}

// ---------------------------------------------------------------------------
// EvaluationResultsPage
// ---------------------------------------------------------------------------

export function EvaluationResultsPage() {
  const { id } = useParams<{ id: string }>();
  const { data: evaluation, isLoading, error } = useEvaluation(id);
  const submitMutation = useSelectMitigations(id ?? '');

  // Mitigation selections: Map<ruleId, Set<mitigationId>>
  const [selectedMitigations, setSelectedMitigations] = useState<
    Map<string, Set<string>>
  >(new Map());

  // Toast state
  const [toast, setToast] = useState<{
    type: 'success' | 'error';
    message: string;
  } | null>(null);

  // ---------------------------------------------------------------------------
  // Handlers
  // ---------------------------------------------------------------------------

  const handleToggleMitigation = useCallback(
    (ruleId: string, mitigationId: string) => {
      if (!evaluation) return;

      const vuln = evaluation.vulnerabilities.find(
        (v) => v.rule_id === ruleId,
      );
      if (!vuln) return;

      const mitigation = vuln.mitigations.find((m) => m.id === mitigationId);
      if (!mitigation) return;

      setSelectedMitigations((prev) => {
        const next = new Map(prev);
        const ruleSet = new Set(next.get(ruleId) ?? []);

        if (ruleSet.has(mitigationId)) {
          // Deselecting
          ruleSet.delete(mitigationId);
        } else {
          // Selecting a full mitigation: clear all bridges for this rule
          if (mitigation.category === 'full') {
            // Remove all bridge mitigations for this rule
            const bridgeIds = vuln.mitigations
              .filter((m) => m.category === 'bridge')
              .map((m) => m.id);
            for (const bid of bridgeIds) {
              ruleSet.delete(bid);
            }
          }
          ruleSet.add(mitigationId);
        }

        if (ruleSet.size === 0) {
          next.delete(ruleId);
        } else {
          next.set(ruleId, ruleSet);
        }
        return next;
      });
    },
    [evaluation],
  );

  // ---------------------------------------------------------------------------
  // Derived state
  // ---------------------------------------------------------------------------

  const bridgesUsed = useMemo(() => {
    if (!evaluation) return 0;
    let count = 0;
    for (const [ruleId, mitigationIds] of selectedMitigations) {
      const vuln = evaluation.vulnerabilities.find(
        (v) => v.rule_id === ruleId,
      );
      if (!vuln) continue;
      for (const mid of mitigationIds) {
        const mit = vuln.mitigations.find((m) => m.id === mid);
        if (mit?.category === 'bridge') count++;
      }
    }
    return count;
  }, [selectedMitigations, evaluation]);

  const bridgeLimit = evaluation?.summary.bridge_mitigation_limit ?? 3;
  const bridgeBudgetReached = bridgesUsed >= bridgeLimit;

  // ---------------------------------------------------------------------------
  // Submit handler
  // ---------------------------------------------------------------------------

  const handleSubmit = async () => {
    if (!evaluation) return;

    const selections: SelectMitigationsRequest['selections'] = [];
    for (const [ruleId, mitigationIds] of selectedMitigations) {
      const vuln = evaluation.vulnerabilities.find(
        (v) => v.rule_id === ruleId,
      );
      if (!vuln) continue;
      for (const mid of mitigationIds) {
        const mit = vuln.mitigations.find((m) => m.id === mid);
        if (mit) {
          selections.push({
            rule_id: ruleId,
            mitigation_id: mid,
            category: mit.category,
          });
        }
      }
    }

    try {
      await submitMutation.mutateAsync({ selections });
      setToast({
        type: 'success',
        message: 'Mitigation selections saved successfully.',
      });
      setTimeout(() => setToast(null), 4000);
    } catch {
      setToast({
        type: 'error',
        message: 'Failed to save mitigation selections. Please try again.',
      });
      setTimeout(() => setToast(null), 4000);
    }
  };

  // ---------------------------------------------------------------------------
  // Loading & Error states
  // ---------------------------------------------------------------------------

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-24">
        <div className="flex items-center gap-3 text-gray-500">
          <SpinnerIcon />
          <span className="text-lg">Loading evaluation results...</span>
        </div>
      </div>
    );
  }

  if (error || !evaluation) {
    return (
      <div className="flex flex-col items-center justify-center py-24">
        <p className="text-lg text-red-600 mb-4">
          Failed to load evaluation results.
        </p>
        <Link
          to="/evaluation/new"
          className="text-sm text-blue-600 hover:text-blue-700 font-medium flex items-center gap-1"
        >
          <ArrowLeftIcon />
          Back to Form
        </Link>
      </div>
    );
  }

  // Cast to the shared type (the hook's type is broader)
  const eval_ = evaluation as unknown as EvaluationResult;
  const { summary, vulnerabilities, auto_declined } = eval_;

  // Sort: unmitigatable first, then mitigatable
  const sortedVulnerabilities = [...vulnerabilities.filter((v) => v.triggered)].sort(
    (a, b) => {
      const aUnmitigatable = a.mitigations.length === 0 ? 0 : 1;
      const bUnmitigatable = b.mitigations.length === 0 ? 0 : 1;
      return aUnmitigatable - bUnmitigatable;
    },
  );

  const hasSelections = selectedMitigations.size > 0;

  return (
    <div className="max-w-5xl mx-auto px-8 py-8">
      {/* Toast notification */}
      {toast && (
        <div
          className={`fixed top-4 right-4 z-50 px-4 py-3 rounded-lg shadow-lg text-sm font-medium transition-all ${
            toast.type === 'success'
              ? 'bg-green-50 border border-green-200 text-green-800'
              : 'bg-red-50 border border-red-200 text-red-800'
          }`}
          role="alert"
        >
          {toast.message}
        </div>
      )}

      {/* Page header info */}
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h2 className="text-xl font-semibold text-gray-900">
            Evaluation Results
          </h2>
          {eval_.release && (
            <p className="text-sm text-gray-500 mt-0.5">
              Evaluation #{id?.slice(0, 8)}
            </p>
          )}
        </div>
        {eval_.release && (
          <div className="flex items-center gap-3">
            <span className="text-xs text-gray-400">Evaluated against:</span>
            <span className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium bg-blue-50 text-blue-700 border border-blue-200">
              {eval_.release.name}
            </span>
          </div>
        )}
      </div>

      {/* Summary bar -- 4 stat cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
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
        <StatCard
          value={bridgesUsed}
          label={`Bridge Used`}
          borderColor="border-blue-200"
          textColor="text-blue-600"
          suffix={`${bridgeLimit} Limit`}
        />
      </div>

      {/* Auto-decline banner */}
      {auto_declined && (
        <AutoDeclineBanner vulnerabilities={vulnerabilities} />
      )}

      {/* Vulnerability cards */}
      <div className="space-y-4">
        {sortedVulnerabilities.map((vuln) => (
          <VulnerabilityCard
            key={vuln.rule_id}
            vulnerability={vuln}
            selectedMitigations={
              selectedMitigations.get(vuln.rule_id) ?? new Set()
            }
            onToggleMitigation={(mitigationId) =>
              handleToggleMitigation(vuln.rule_id, mitigationId)
            }
            bridgeBudgetReached={bridgeBudgetReached}
            isAutoDeclined={auto_declined}
          />
        ))}
      </div>

      {/* Bridge budget banner */}
      {bridgesUsed > 0 && (
        <div
          className={`mt-6 p-4 rounded-lg flex items-center justify-between ${
            bridgeBudgetReached
              ? 'bg-red-50 border border-red-300'
              : 'bg-amber-50 border border-amber-200'
          }`}
          aria-live="polite"
        >
          <div className="flex items-center gap-2">
            <InfoIcon />
            <span
              className={`text-sm ${
                bridgeBudgetReached ? 'text-red-800' : 'text-amber-800'
              }`}
            >
              {bridgeBudgetReached
                ? `Bridge mitigation limit reached (${bridgeLimit}/${bridgeLimit}). No additional bridge mitigations can be selected.`
                : `${bridgesUsed} of ${bridgeLimit} bridge mitigations selected. ${
                    bridgeLimit - bridgesUsed
                  } remaining.`}
            </span>
          </div>
        </div>
      )}

      {/* Actions bar */}
      <div className="mt-8 flex items-center justify-between pb-8">
        <Link
          to="/evaluation/new"
          className="text-sm text-blue-600 hover:text-blue-700 font-medium flex items-center gap-1"
        >
          <ArrowLeftIcon />
          Back to Form
        </Link>

        {/* Hide submit button when auto-declined per UX recommendation */}
        {!auto_declined && (
          <button
            onClick={handleSubmit}
            disabled={submitMutation.isPending || !hasSelections}
            className="px-6 py-2.5 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 shadow-sm transition-colors flex items-center gap-2 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {submitMutation.isPending ? (
              <>
                <SpinnerIcon />
                Saving...
              </>
            ) : (
              <>
                <CheckIcon />
                Save Mitigation Selections
              </>
            )}
          </button>
        )}
      </div>
    </div>
  );
}

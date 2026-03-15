import type { VulnerabilityResult } from '@shared/types/evaluation.js';

// ---------------------------------------------------------------------------
// Icons
// ---------------------------------------------------------------------------

function WarningTriangleIcon() {
  return (
    <svg
      className="w-6 h-6 text-red-500 mt-0.5 flex-shrink-0"
      fill="none"
      stroke="currentColor"
      viewBox="0 0 24 24"
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={2}
        d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L4.082 16.5c-.77.833.192 2.5 1.732 2.5z"
      />
    </svg>
  );
}

// ---------------------------------------------------------------------------
// AutoDeclineBanner
// ---------------------------------------------------------------------------

interface AutoDeclineBannerProps {
  vulnerabilities: VulnerabilityResult[];
}

export function AutoDeclineBanner({ vulnerabilities }: AutoDeclineBannerProps) {
  // Find the unmitigatable vulnerabilities (triggered with no mitigations)
  const unmitigatable = vulnerabilities.filter(
    (v) => v.triggered && v.mitigations.length === 0,
  );

  if (unmitigatable.length === 0) return null;

  return (
    <div
      className="bg-red-50 border border-red-300 rounded-lg p-4 mb-6 flex items-start gap-3"
      role="alert"
    >
      <WarningTriangleIcon />
      <div>
        <p className="font-semibold text-red-800">Auto-Decline Triggered</p>
        {unmitigatable.map((v) => {
          const observed = v.details.observedValues
            ? Object.values(v.details.observedValues)[0]
            : 'N/A';
          const required = v.details.requiredValues;

          return (
            <p key={v.rule_id} className="text-sm text-red-700 mt-1">
              This property fails the <strong>{v.rule_name}</strong> rule
              {required != null && observed != null && (
                <>
                  {' '}
                  (minimum {String(required)} required, observed{' '}
                  {String(observed)})
                </>
              )}
              . This vulnerability has no available mitigations and the property
              cannot be insured under current rules.
            </p>
          );
        })}
        <p className="text-xs text-red-500 mt-2">
          Note: The remaining mitigatable vulnerabilities are shown below for
          informational purposes.
        </p>
      </div>
    </div>
  );
}

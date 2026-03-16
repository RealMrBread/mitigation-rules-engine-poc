import { useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useRuleList, useTestRule } from '@/hooks/useRules';

// ---------------------------------------------------------------------------
// Icons
// ---------------------------------------------------------------------------

function SpinnerIcon() {
  return (
    <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
    </svg>
  );
}

function PlayIcon() {
  return (
    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z" />
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
    </svg>
  );
}

// ---------------------------------------------------------------------------
// Default observation template
// ---------------------------------------------------------------------------

const DEFAULT_OBSERVATIONS = JSON.stringify(
  {
    property_id: 'TEST-001',
    state: 'CA',
    wildfire_risk_category: 'A',
    roof_type: 'Class A',
    attic_vent_screens: 'Ember Resistant',
    window_type: 'Single Pane',
    home_to_home_distance: 20,
    vegetation: [
      {
        type: 'Tree',
        distance_to_window: 25,
      },
    ],
    defensible_space: true,
    fire_station_distance: 5,
  },
  null,
  2,
);

// ---------------------------------------------------------------------------
// TestSandboxPage
// ---------------------------------------------------------------------------

export function TestSandboxPage() {
  const [searchParams] = useSearchParams();
  const preselectedRuleId = searchParams.get('ruleId') ?? '';

  const { data: rules, isLoading: isLoadingRules } = useRuleList();
  const testRule = useTestRule();

  const [selectedRuleId, setSelectedRuleId] = useState(preselectedRuleId);
  const [observationsText, setObservationsText] = useState(DEFAULT_OBSERVATIONS);
  const [parseError, setParseError] = useState<string | null>(null);
  const [result, setResult] = useState<unknown>(null);

  async function handleTest() {
    setParseError(null);
    setResult(null);

    if (!selectedRuleId) return;

    let observations: Record<string, unknown>;
    try {
      observations = JSON.parse(observationsText);
    } catch {
      setParseError('Invalid JSON — please fix the observation data.');
      return;
    }

    try {
      const data = await testRule.mutateAsync({ ruleId: selectedRuleId, observations });
      setResult(data);
    } catch (err: any) {
      setParseError(err.message ?? 'Test failed');
    }
  }

  return (
    <div className="max-w-5xl mx-auto px-8 py-8">
      {/* SANDBOX banner */}
      <div className="mb-6 rounded-lg border-2 border-dashed border-amber-300 bg-amber-50 px-4 py-3 flex items-center gap-3">
        <span className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-bold bg-amber-200 text-amber-800 uppercase tracking-wider">
          Sandbox
        </span>
        <p className="text-sm text-amber-700">
          Test results are not saved. Use this to validate rule behavior before publishing.
        </p>
      </div>

      {/* Page header */}
      <div className="mb-6">
        <h2 className="text-xl font-semibold text-gray-900">Test Sandbox</h2>
        <p className="text-sm text-gray-500 mt-1">
          Select a rule and provide test observations to see how it evaluates.
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Left: Input */}
        <div className="space-y-6">
          {/* Rule selector */}
          <div className="bg-white rounded-lg border border-gray-200 shadow-sm p-6">
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Select Rule <span className="text-red-500">*</span>
            </label>
            <select
              value={selectedRuleId}
              onChange={(e) => setSelectedRuleId(e.target.value)}
              disabled={isLoadingRules}
              className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            >
              <option value="">— Select a rule —</option>
              {rules?.map((rule) => (
                <option key={rule.id} value={rule.id}>
                  {rule.name} ({rule.type.replace(/_/g, ' ')})
                </option>
              ))}
            </select>
          </div>

          {/* Observations editor */}
          <div className="bg-white rounded-lg border border-gray-200 shadow-sm p-6">
            <div className="flex items-center justify-between mb-2">
              <label className="block text-sm font-medium text-gray-700">
                Test Observations (JSON)
              </label>
              <button
                type="button"
                onClick={() => {
                  try {
                    const parsed = JSON.parse(observationsText);
                    setObservationsText(JSON.stringify(parsed, null, 2));
                  } catch { /* ignore */ }
                }}
                className="px-2 py-1 text-xs font-medium text-gray-500 bg-gray-100 rounded hover:bg-gray-200 transition-colors"
              >
                Format
              </button>
            </div>
            <textarea
              value={observationsText}
              onChange={(e) => setObservationsText(e.target.value)}
              rows={20}
              spellCheck={false}
              className="w-full font-mono text-sm rounded-md border border-gray-300 px-4 py-3 focus:outline-none focus:ring-2 focus:ring-blue-500 bg-gray-50 resize-y"
            />
          </div>

          {/* Run button */}
          <button
            onClick={handleTest}
            disabled={!selectedRuleId || testRule.isPending}
            className="w-full px-5 py-3 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
          >
            {testRule.isPending ? <SpinnerIcon /> : <PlayIcon />}
            {testRule.isPending ? 'Running...' : 'Run Test'}
          </button>

          {parseError && (
            <div className="rounded-lg border border-red-300 bg-red-50 p-4">
              <p className="text-sm text-red-700">{parseError}</p>
            </div>
          )}
        </div>

        {/* Right: Results */}
        <div>
          <div className="bg-white rounded-lg border border-gray-200 shadow-sm p-6 sticky top-8">
            <h3 className="text-sm font-semibold text-gray-900 mb-4">Test Results</h3>
            {!result && !testRule.isPending && (
              <div className="text-center py-12 text-sm text-gray-400">
                Run a test to see results here.
              </div>
            )}
            {testRule.isPending && (
              <div className="flex items-center justify-center py-12 gap-2">
                <SpinnerIcon />
                <span className="text-sm text-gray-500">Evaluating...</span>
              </div>
            )}
            {result !== null && (
              <pre className="text-xs font-mono bg-gray-50 border border-gray-200 rounded-md p-4 overflow-auto max-h-[600px] whitespace-pre-wrap">
                {JSON.stringify(result, null, 2)}
              </pre>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

import type { ConditionalConfig, ThresholdCheck, ConditionalBranch } from '@shared/types/rule.js';

const OPERATORS = [
  { value: 'eq', label: 'equals (=)' },
  { value: 'neq', label: 'not equals (!=)' },
  { value: 'in', label: 'in list' },
  { value: 'gte', label: 'greater or equal (>=)' },
  { value: 'lte', label: 'less or equal (<=)' },
  { value: 'gt', label: 'greater than (>)' },
  { value: 'lt', label: 'less than (<)' },
] as const;

interface RuleFormConditionalProps {
  config: ConditionalConfig;
  onChange: (config: ConditionalConfig) => void;
}

// ---------------------------------------------------------------------------
// Threshold check row (reused for when, then, default)
// ---------------------------------------------------------------------------

function ThresholdRow({
  check,
  onChange,
}: {
  check: ThresholdCheck;
  onChange: (check: ThresholdCheck) => void;
}) {
  return (
    <div className="grid grid-cols-3 gap-3">
      <div>
        <label className="block text-xs text-gray-500 mb-1">Field</label>
        <input
          type="text"
          value={check.field}
          onChange={(e) => onChange({ ...check, field: e.target.value })}
          placeholder="e.g., roof_type"
          className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
      </div>
      <div>
        <label className="block text-xs text-gray-500 mb-1">Operator</label>
        <select
          value={check.operator}
          onChange={(e) => onChange({ ...check, operator: e.target.value as ThresholdCheck['operator'] })}
          className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
        >
          {OPERATORS.map((op) => (
            <option key={op.value} value={op.value}>
              {op.label}
            </option>
          ))}
        </select>
      </div>
      <div>
        <label className="block text-xs text-gray-500 mb-1">Value</label>
        <input
          type="text"
          value={Array.isArray(check.value) ? check.value.join(', ') : String(check.value)}
          onChange={(e) => {
            const raw = e.target.value;
            if (check.operator === 'in') {
              onChange({ ...check, value: raw.split(',').map((s) => s.trim()) });
            } else {
              const num = Number(raw);
              onChange({ ...check, value: raw === '' ? '' : isNaN(num) ? raw : num });
            }
          }}
          placeholder={check.operator === 'in' ? 'A, B, C' : 'value'}
          className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
      </div>
    </div>
  );
}

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

function CloseIcon() {
  return (
    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
    </svg>
  );
}

// ---------------------------------------------------------------------------
// Defaults
// ---------------------------------------------------------------------------

function emptyCheck(): ThresholdCheck {
  return { field: '', operator: 'eq', value: '' };
}

function emptyBranch(): ConditionalBranch {
  return { when: emptyCheck(), then: emptyCheck() };
}

// ---------------------------------------------------------------------------
// RuleFormConditional
// ---------------------------------------------------------------------------

export function RuleFormConditional({ config, onChange }: RuleFormConditionalProps) {
  function updateCondition(index: number, branch: ConditionalBranch) {
    const conditions = [...config.conditions];
    conditions[index] = branch;
    onChange({ ...config, conditions });
  }

  function addCondition() {
    onChange({ ...config, conditions: [...config.conditions, emptyBranch()] });
  }

  function removeCondition(index: number) {
    const conditions = config.conditions.filter((_, i) => i !== index);
    onChange({ ...config, conditions: conditions.length > 0 ? conditions : [emptyBranch()] });
  }

  return (
    <div className="bg-white rounded-lg border border-gray-200 shadow-sm p-6 mb-6">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-base font-semibold text-gray-900">Conditional Branches</h3>
        <button
          type="button"
          onClick={addCondition}
          className="inline-flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium text-blue-700 bg-blue-50 border border-blue-200 rounded-md hover:bg-blue-100 transition-colors"
        >
          <PlusIcon />
          Add Condition
        </button>
      </div>

      <div className="space-y-3">
        {config.conditions.map((branch, index) => (
          <div key={index} className="p-4 bg-purple-50 rounded-lg border border-purple-100">
            <div className="flex items-center justify-between mb-2">
              <p className="text-xs font-semibold text-purple-600 uppercase">WHEN</p>
              {config.conditions.length > 1 && (
                <button
                  type="button"
                  onClick={() => removeCondition(index)}
                  className="p-1 text-gray-400 hover:text-red-500 rounded"
                >
                  <CloseIcon />
                </button>
              )}
            </div>
            <ThresholdRow
              check={branch.when}
              onChange={(when) => updateCondition(index, { ...branch, when })}
            />
            <p className="text-xs font-semibold text-purple-600 uppercase mt-3 mb-2">THEN</p>
            <ThresholdRow
              check={branch.then}
              onChange={(then) => updateCondition(index, { ...branch, then })}
            />
          </div>
        ))}

        {/* Default */}
        <div className="p-4 bg-gray-50 rounded-lg border border-gray-200">
          <p className="text-xs font-semibold text-gray-500 uppercase mb-2">DEFAULT (no condition match)</p>
          <ThresholdRow
            check={config.default}
            onChange={(def) => onChange({ ...config, default: def })}
          />
        </div>
      </div>
    </div>
  );
}

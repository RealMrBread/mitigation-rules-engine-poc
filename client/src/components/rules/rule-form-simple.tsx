import type { SimpleConfig } from '@shared/types/rule.js';

const OPERATORS = [
  { value: 'eq', label: 'equals (=)' },
  { value: 'neq', label: 'not equals (!=)' },
  { value: 'in', label: 'in list' },
  { value: 'gte', label: 'greater or equal (>=)' },
  { value: 'lte', label: 'less or equal (<=)' },
  { value: 'gt', label: 'greater than (>)' },
  { value: 'lt', label: 'less than (<)' },
] as const;

interface RuleFormSimpleProps {
  config: SimpleConfig;
  onChange: (config: SimpleConfig) => void;
}

export function RuleFormSimple({ config, onChange }: RuleFormSimpleProps) {
  return (
    <div className="bg-white rounded-lg border border-gray-200 shadow-sm p-6 mb-6">
      <h3 className="text-base font-semibold text-gray-900 mb-4">Simple Threshold Configuration</h3>
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Field <span className="text-red-500">*</span>
          </label>
          <input
            type="text"
            value={config.field}
            onChange={(e) => onChange({ ...config, field: e.target.value })}
            placeholder="e.g., attic_vent_screens"
            className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Operator <span className="text-red-500">*</span>
          </label>
          <select
            value={config.operator}
            onChange={(e) => onChange({ ...config, operator: e.target.value as SimpleConfig['operator'] })}
            className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
          >
            {OPERATORS.map((op) => (
              <option key={op.value} value={op.value}>
                {op.label}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Value <span className="text-red-500">*</span>
          </label>
          <input
            type="text"
            value={
              Array.isArray(config.value) ? config.value.join(', ') : String(config.value)
            }
            onChange={(e) => {
              const raw = e.target.value;
              // If operator is "in", treat as comma-separated list
              if (config.operator === 'in') {
                onChange({ ...config, value: raw.split(',').map((s) => s.trim()) });
              } else {
                // Try to parse as number
                const num = Number(raw);
                onChange({ ...config, value: raw === '' ? '' : isNaN(num) ? raw : num });
              }
            }}
            placeholder={config.operator === 'in' ? 'e.g., Class A, Class B' : 'e.g., Ember Resistant'}
            className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
          />
          {config.operator === 'in' && (
            <p className="text-xs text-gray-400 mt-1">Comma-separated values</p>
          )}
        </div>
      </div>
    </div>
  );
}

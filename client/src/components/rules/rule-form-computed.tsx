import type { ComputedConfig, Modifier } from '@shared/types/rule.js';

interface RuleFormComputedProps {
  config: ComputedConfig;
  onChange: (config: ComputedConfig) => void;
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
// Mapping editor for a single modifier
// ---------------------------------------------------------------------------

function MappingEditor({
  mapping,
  onChange,
}: {
  mapping: Record<string, number>;
  onChange: (mapping: Record<string, number>) => void;
}) {
  const entries = Object.entries(mapping);

  function updateEntry(oldKey: string, newKey: string, value: number) {
    const updated: Record<string, number> = {};
    for (const [k, v] of entries) {
      if (k === oldKey) {
        updated[newKey] = value;
      } else {
        updated[k] = v;
      }
    }
    onChange(updated);
  }

  function addEntry() {
    onChange({ ...mapping, '': 0 });
  }

  function removeEntry(key: string) {
    const { [key]: _, ...rest } = mapping;
    onChange(rest);
  }

  return (
    <div>
      <label className="block text-xs text-gray-500 mb-1">Value Mapping</label>
      <div className="space-y-1.5">
        {entries.map(([key, value], index) => (
          <div key={index} className="flex gap-2 items-center">
            <input
              type="text"
              value={key}
              onChange={(e) => updateEntry(key, e.target.value, value)}
              placeholder="Value"
              className="flex-1 rounded-md border border-gray-300 px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
            <span className="text-gray-400 text-sm">=</span>
            <input
              type="number"
              value={value}
              onChange={(e) => updateEntry(key, key, Number(e.target.value) || 0)}
              className="w-20 rounded-md border border-gray-300 px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
            <button
              type="button"
              onClick={() => removeEntry(key)}
              className="p-1 text-gray-400 hover:text-red-500 rounded"
            >
              <CloseIcon />
            </button>
          </div>
        ))}
      </div>
      <button
        type="button"
        onClick={addEntry}
        className="mt-2 inline-flex items-center gap-1 text-xs font-medium text-blue-600 hover:text-blue-700"
      >
        <PlusIcon />
        Add mapping
      </button>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Default modifier
// ---------------------------------------------------------------------------

function emptyModifier(): Modifier {
  return { field: '', mapping: {}, operation: 'multiply' };
}

// ---------------------------------------------------------------------------
// RuleFormComputed
// ---------------------------------------------------------------------------

export function RuleFormComputed({ config, onChange }: RuleFormComputedProps) {
  function updateModifier(index: number, modifier: Modifier) {
    const modifiers = [...config.modifiers];
    modifiers[index] = modifier;
    onChange({ ...config, modifiers });
  }

  function addModifier() {
    onChange({ ...config, modifiers: [...config.modifiers, emptyModifier()] });
  }

  function removeModifier(index: number) {
    const modifiers = config.modifiers.filter((_, i) => i !== index);
    onChange({ ...config, modifiers: modifiers.length > 0 ? modifiers : [emptyModifier()] });
  }

  return (
    <div className="bg-white rounded-lg border border-gray-200 shadow-sm p-6 mb-6">
      <h3 className="text-base font-semibold text-gray-900 mb-4">Computed Configuration</h3>

      {/* Top-level fields */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-5 mb-6">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Base Value <span className="text-red-500">*</span>
          </label>
          <input
            type="number"
            value={config.baseValue}
            onChange={(e) => onChange({ ...config, baseValue: Number(e.target.value) || 0 })}
            className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Unit <span className="text-red-500">*</span>
          </label>
          <input
            type="text"
            value={config.unit}
            onChange={(e) => onChange({ ...config, unit: e.target.value })}
            placeholder="e.g., feet"
            className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Comparison Field <span className="text-red-500">*</span>
          </label>
          <input
            type="text"
            value={config.comparisonField}
            onChange={(e) => onChange({ ...config, comparisonField: e.target.value })}
            placeholder="e.g., vegetation[].distance_to_window"
            className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-5 mb-6">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Comparison Operator</label>
          <select
            value={config.comparisonOperator}
            onChange={(e) =>
              onChange({ ...config, comparisonOperator: e.target.value as 'gte' | 'gt' })
            }
            className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            <option value="gte">Pass if actual &gt;= threshold</option>
            <option value="gt">Pass if actual &gt; threshold</option>
          </select>
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Array Field (optional)</label>
          <input
            type="text"
            value={config.arrayField ?? ''}
            onChange={(e) =>
              onChange({ ...config, arrayField: e.target.value || undefined })
            }
            placeholder="e.g., vegetation"
            className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
          <p className="text-xs text-gray-400 mt-1">If set, each item in the array is evaluated independently</p>
        </div>
      </div>

      {/* Modifiers */}
      <div className="border-t border-gray-200 pt-5">
        <div className="flex items-center justify-between mb-3">
          <h4 className="text-sm font-semibold text-gray-900">Modifiers</h4>
          <button
            type="button"
            onClick={addModifier}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium text-blue-700 bg-blue-50 border border-blue-200 rounded-md hover:bg-blue-100 transition-colors"
          >
            <PlusIcon />
            Add Modifier
          </button>
        </div>
        <div className="space-y-3">
          {config.modifiers.map((modifier, index) => (
            <div key={index} className="p-4 bg-gray-50 rounded-lg border border-gray-200">
              <div className="flex items-center justify-between mb-3">
                <span className="text-xs font-semibold text-gray-500 uppercase">
                  Modifier {index + 1}
                </span>
                {config.modifiers.length > 1 && (
                  <button
                    type="button"
                    onClick={() => removeModifier(index)}
                    className="p-1 text-gray-400 hover:text-red-500 rounded"
                  >
                    <CloseIcon />
                  </button>
                )}
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-3">
                <div>
                  <label className="block text-xs text-gray-500 mb-1">Field</label>
                  <input
                    type="text"
                    value={modifier.field}
                    onChange={(e) =>
                      updateModifier(index, { ...modifier, field: e.target.value })
                    }
                    placeholder="e.g., window_type"
                    className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
                <div>
                  <label className="block text-xs text-gray-500 mb-1">Operation</label>
                  <select
                    value={modifier.operation}
                    onChange={(e) =>
                      updateModifier(index, {
                        ...modifier,
                        operation: e.target.value as 'multiply' | 'divide',
                      })
                    }
                    className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="multiply">Multiply (x)</option>
                    <option value="divide">Divide (/)</option>
                  </select>
                </div>
              </div>
              <MappingEditor
                mapping={modifier.mapping}
                onChange={(mapping) => updateModifier(index, { ...modifier, mapping })}
              />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

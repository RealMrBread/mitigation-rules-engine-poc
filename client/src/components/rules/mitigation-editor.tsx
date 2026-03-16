import type { Mitigation, BridgeEffect } from '@shared/types/rule.js';

interface MitigationEditorProps {
  mitigations: Mitigation[];
  onChange: (mitigations: Mitigation[]) => void;
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
// Helpers
// ---------------------------------------------------------------------------

function createMitigation(category: 'full' | 'bridge'): Mitigation {
  const base = { id: crypto.randomUUID(), name: '', description: '', category };
  if (category === 'bridge') {
    return { ...base, effect: { type: 'multiplier' as const, value: 1 } };
  }
  return base as Mitigation;
}

const CATEGORY_STYLES = {
  full: { bg: 'bg-green-50', border: 'border-green-200', badge: 'bg-green-100 text-green-700', label: 'Full Mitigation' },
  bridge: { bg: 'bg-amber-50', border: 'border-amber-200', badge: 'bg-amber-100 text-amber-700', label: 'Bridge Mitigation' },
};

// ---------------------------------------------------------------------------
// Single mitigation card
// ---------------------------------------------------------------------------

function MitigationCard({
  mitigation,
  onChange,
  onRemove,
}: {
  mitigation: Mitigation;
  onChange: (m: Mitigation) => void;
  onRemove: () => void;
}) {
  const style = CATEGORY_STYLES[mitigation.category];

  function handleCategoryChange(category: 'full' | 'bridge') {
    if (category === 'full') {
      // Remove effect for full mitigations
      const { effect: _, ...rest } = mitigation as any;
      onChange({ ...rest, category: 'full' } as Mitigation);
    } else {
      // Add default effect for bridge
      onChange({
        ...mitigation,
        category: 'bridge',
        effect: { type: 'multiplier', value: 1 },
      } as Mitigation);
    }
  }

  function handleEffectTypeChange(effectType: 'multiplier' | 'override') {
    if (effectType === 'multiplier') {
      onChange({ ...mitigation, effect: { type: 'multiplier', value: 1 } } as Mitigation);
    } else {
      onChange({ ...mitigation, effect: { type: 'override', value: '' } } as Mitigation);
    }
  }

  const effect = (mitigation as any).effect as BridgeEffect | undefined;

  return (
    <div className={`p-4 ${style.bg} rounded-lg border ${style.border}`}>
      <div className="flex items-center justify-between mb-3">
        <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${style.badge}`}>
          {style.label}
        </span>
        <button type="button" onClick={onRemove} className="p-1 text-gray-400 hover:text-red-500 rounded">
          <CloseIcon />
        </button>
      </div>

      <div className={`grid grid-cols-1 ${mitigation.category === 'bridge' ? 'sm:grid-cols-3' : 'sm:grid-cols-2'} gap-3`}>
        <div>
          <label className="block text-xs text-gray-500 mb-1">Name <span className="text-red-500">*</span></label>
          <input
            type="text"
            value={mitigation.name}
            onChange={(e) => onChange({ ...mitigation, name: e.target.value })}
            placeholder="e.g., Replace with Tempered Glass"
            className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>
        <div>
          <label className="block text-xs text-gray-500 mb-1">Category</label>
          <select
            value={mitigation.category}
            onChange={(e) => handleCategoryChange(e.target.value as 'full' | 'bridge')}
            className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            <option value="full">Full Mitigation</option>
            <option value="bridge">Bridge Mitigation</option>
          </select>
        </div>

        {/* Bridge effect config */}
        {mitigation.category === 'bridge' && effect && (
          <div>
            <label className="block text-xs text-gray-500 mb-1">Bridge Effect</label>
            <div className="flex gap-2">
              <select
                value={effect.type}
                onChange={(e) => handleEffectTypeChange(e.target.value as 'multiplier' | 'override')}
                className="rounded-md border border-gray-300 px-2 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="multiplier">Multiplier</option>
                <option value="override">Override</option>
              </select>
              <input
                type={effect.type === 'multiplier' ? 'number' : 'text'}
                step={effect.type === 'multiplier' ? '0.1' : undefined}
                value={effect.value}
                onChange={(e) => {
                  const val = effect.type === 'multiplier' ? Number(e.target.value) || 0 : e.target.value;
                  onChange({ ...mitigation, effect: { ...effect, value: val } } as Mitigation);
                }}
                placeholder={effect.type === 'multiplier' ? '0.8' : 'override value'}
                className="flex-1 rounded-md border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
          </div>
        )}

        {/* Description spans full row */}
        <div className={mitigation.category === 'bridge' ? 'sm:col-span-3' : 'sm:col-span-2'}>
          <label className="block text-xs text-gray-500 mb-1">Description <span className="text-red-500">*</span></label>
          <input
            type="text"
            value={mitigation.description}
            onChange={(e) => onChange({ ...mitigation, description: e.target.value })}
            placeholder="Describe what this mitigation involves"
            className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// MitigationEditor
// ---------------------------------------------------------------------------

export function MitigationEditor({ mitigations, onChange }: MitigationEditorProps) {
  function updateMitigation(index: number, m: Mitigation) {
    const updated = [...mitigations];
    updated[index] = m;
    onChange(updated);
  }

  function removeMitigation(index: number) {
    onChange(mitigations.filter((_, i) => i !== index));
  }

  return (
    <div className="bg-white rounded-lg border border-gray-200 shadow-sm p-6 mb-6">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-base font-semibold text-gray-900">Mitigations</h3>
        <button
          type="button"
          onClick={() => onChange([...mitigations, createMitigation('full')])}
          className="inline-flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium text-blue-700 bg-blue-50 border border-blue-200 rounded-md hover:bg-blue-100 transition-colors"
        >
          <PlusIcon />
          Add Mitigation
        </button>
      </div>
      <p className="text-xs text-gray-400 mb-4">
        If no mitigations are defined, the rule will be unmitigatable (auto-decline on failure).
      </p>

      {mitigations.length === 0 ? (
        <div className="text-center py-8 text-sm text-gray-500 border border-dashed border-gray-300 rounded-lg">
          No mitigations defined. This rule will auto-decline on failure.
        </div>
      ) : (
        <div className="space-y-3">
          {mitigations.map((m, index) => (
            <MitigationCard
              key={m.id}
              mitigation={m}
              onChange={(updated) => updateMitigation(index, updated)}
              onRemove={() => removeMitigation(index)}
            />
          ))}
        </div>
      )}
    </div>
  );
}

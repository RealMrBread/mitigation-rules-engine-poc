import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useRule, useCreateRule, useUpdateRule } from '@/hooks/useRules';
import { ApiClientError } from '@/lib/api';
import { RuleFormSimple } from '@/components/rules/rule-form-simple';
import { RuleFormConditional } from '@/components/rules/rule-form-conditional';
import { RuleFormComputed } from '@/components/rules/rule-form-computed';
import { MitigationEditor } from '@/components/rules/mitigation-editor';
import type { RuleType, SimpleConfig, ConditionalConfig, ComputedConfig, Mitigation } from '@shared/types/rule.js';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type RuleConfig = SimpleConfig | ConditionalConfig | ComputedConfig;

interface RuleFormState {
  name: string;
  description: string;
  type: RuleType;
  config: RuleConfig;
  mitigations: Mitigation[];
  version: number;
}

// ---------------------------------------------------------------------------
// Defaults per type
// ---------------------------------------------------------------------------

const DEFAULT_CONFIGS: Record<RuleType, RuleConfig> = {
  simple_threshold: { field: '', operator: 'eq', value: '' } as SimpleConfig,
  conditional_threshold: {
    conditions: [{ when: { field: '', operator: 'eq', value: '' }, then: { field: '', operator: 'eq', value: '' } }],
    default: { field: '', operator: 'eq', value: '' },
  } as ConditionalConfig,
  computed_with_modifiers: {
    baseValue: 0,
    unit: '',
    modifiers: [{ field: '', mapping: {}, operation: 'multiply' }],
    comparisonField: '',
    comparisonOperator: 'gte',
  } as ComputedConfig,
};

function defaultFormState(): RuleFormState {
  return {
    name: '',
    description: '',
    type: 'simple_threshold',
    config: { ...DEFAULT_CONFIGS.simple_threshold },
    mitigations: [],
    version: 0,
  };
}

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

function CheckIcon() {
  return (
    <svg className="w-5 h-5 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4" />
    </svg>
  );
}

// ---------------------------------------------------------------------------
// Type selector card
// ---------------------------------------------------------------------------

const TYPE_OPTIONS: { value: RuleType; label: string; desc: string; color: string; iconColor: string }[] = [
  {
    value: 'simple_threshold',
    label: 'Simple Threshold',
    desc: 'Single field comparison',
    color: 'blue',
    iconColor: 'bg-blue-50 text-blue-600',
  },
  {
    value: 'conditional_threshold',
    label: 'Conditional Threshold',
    desc: 'When/then branches',
    color: 'purple',
    iconColor: 'bg-purple-50 text-purple-600',
  },
  {
    value: 'computed_with_modifiers',
    label: 'Computed with Modifiers',
    desc: 'Base value + modifiers',
    color: 'amber',
    iconColor: 'bg-amber-50 text-amber-600',
  },
];

// ---------------------------------------------------------------------------
// Version conflict banner
// ---------------------------------------------------------------------------

function ConflictBanner({ onReload }: { onReload: () => void }) {
  return (
    <div className="mb-6 rounded-lg border border-amber-300 bg-amber-50 p-4 flex items-center justify-between">
      <div>
        <p className="text-sm font-medium text-amber-800">Version conflict</p>
        <p className="text-sm text-amber-700">
          This rule was modified by another user. Reload to get the latest version.
        </p>
      </div>
      <button
        onClick={onReload}
        className="px-4 py-2 text-sm font-medium text-amber-700 bg-white border border-amber-300 rounded-lg hover:bg-amber-50 transition-colors"
      >
        Reload
      </button>
    </div>
  );
}

// ---------------------------------------------------------------------------
// RuleEditorPage
// ---------------------------------------------------------------------------

export function RuleEditorPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const isNew = !id || id === 'new';

  const { data: existingRule, isLoading: isLoadingRule, refetch } = useRule(isNew ? undefined : id);
  const createRule = useCreateRule();
  const updateRule = useUpdateRule();

  const [form, setForm] = useState<RuleFormState>(defaultFormState);
  const [hasConflict, setHasConflict] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [viewMode, setViewMode] = useState<'form' | 'json'>('form');

  // Populate form from loaded rule
  useEffect(() => {
    if (existingRule && !isNew) {
      setForm({
        name: existingRule.name,
        description: existingRule.description ?? '',
        type: existingRule.type as RuleType,
        config: existingRule.config as RuleConfig,
        mitigations: existingRule.mitigations as Mitigation[],
        version: existingRule.version,
      });
      setHasConflict(false);
      setSaveError(null);
    }
  }, [existingRule, isNew]);

  function handleTypeChange(type: RuleType) {
    setForm((prev) => ({
      ...prev,
      type,
      config: { ...DEFAULT_CONFIGS[type] },
    }));
  }

  function handleReload() {
    refetch();
    setHasConflict(false);
    setSaveError(null);
  }

  async function handleSave() {
    setSaveError(null);
    setHasConflict(false);

    try {
      if (isNew) {
        const created = await createRule.mutateAsync({
          name: form.name,
          description: form.description,
          type: form.type,
          config: form.config,
          mitigations: form.mitigations,
        });
        navigate(`/rules/${created.id}`, { replace: true });
      } else {
        await updateRule.mutateAsync({
          id: id!,
          version: form.version,
          name: form.name,
          description: form.description,
          type: form.type,
          config: form.config,
          mitigations: form.mitigations,
        });
        // Refetch to get updated version
        refetch();
      }
    } catch (err) {
      if (err instanceof ApiClientError && err.code === 'CONFLICT') {
        setHasConflict(true);
      } else if (err instanceof ApiClientError) {
        setSaveError(err.message);
      } else {
        setSaveError('An unexpected error occurred.');
      }
    }
  }

  const isSaving = createRule.isPending || updateRule.isPending;

  // Loading state for editing existing rule
  if (!isNew && isLoadingRule) {
    return (
      <div className="flex h-64 items-center justify-center">
        <SpinnerIcon />
        <span className="ml-2 text-sm text-gray-500">Loading rule...</span>
      </div>
    );
  }

  return (
    <div className="max-w-5xl mx-auto px-8 py-8">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 className="text-xl font-semibold text-gray-900">
            {isNew ? 'New Rule' : `Edit Rule: ${form.name || 'Untitled'}`}
          </h2>
          <p className="text-sm text-gray-500 mt-0.5">
            {isNew ? 'Create a new underwriting rule' : `Draft — v${form.version}`}
          </p>
        </div>
        <div className="flex items-center gap-3">
          {/* View toggle */}
          <div className="inline-flex rounded-lg border border-gray-300 overflow-hidden">
            <button
              onClick={() => setViewMode('form')}
              className={`px-3 py-1.5 text-xs font-medium ${
                viewMode === 'form' ? 'bg-blue-50 text-blue-700' : 'text-gray-500 hover:bg-gray-50'
              } border-r border-gray-300`}
            >
              Form View
            </button>
            <button
              onClick={() => setViewMode('json')}
              className={`px-3 py-1.5 text-xs font-medium ${
                viewMode === 'json' ? 'bg-blue-50 text-blue-700' : 'text-gray-500 hover:bg-gray-50'
              }`}
            >
              JSON Editor
            </button>
          </div>
        </div>
      </div>

      {/* Conflict banner */}
      {hasConflict && <ConflictBanner onReload={handleReload} />}

      {/* Save error */}
      {saveError && (
        <div className="mb-6 rounded-lg border border-red-300 bg-red-50 p-4">
          <p className="text-sm text-red-700">{saveError}</p>
        </div>
      )}

      {/* Form View */}
      {viewMode === 'form' && (
        <>
          {/* Basic Information */}
          <div className="bg-white rounded-lg border border-gray-200 shadow-sm p-6 mb-6">
            <h3 className="text-base font-semibold text-gray-900 mb-4">Basic Information</h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Rule Name <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  value={form.name}
                  onChange={(e) => setForm((prev) => ({ ...prev, name: e.target.value }))}
                  placeholder="e.g., Window Safety Distance"
                  className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                />
              </div>
              {!isNew && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Rule ID</label>
                  <input
                    type="text"
                    value={id}
                    disabled
                    className="w-full rounded-md border border-gray-200 bg-gray-50 px-3 py-2 text-sm text-gray-500"
                  />
                </div>
              )}
              <div className={isNew ? '' : 'sm:col-span-2'}>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Description <span className="text-red-500">*</span>
                </label>
                <textarea
                  rows={2}
                  value={form.description}
                  onChange={(e) => setForm((prev) => ({ ...prev, description: e.target.value }))}
                  placeholder="Describe what this rule checks"
                  className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                />
              </div>
            </div>
          </div>

          {/* Rule Type Selector */}
          <div className="bg-white rounded-lg border border-gray-200 shadow-sm p-6 mb-6">
            <h3 className="text-base font-semibold text-gray-900 mb-4">
              Rule Type <span className="text-red-500">*</span>
            </h3>
            <div className="grid grid-cols-3 gap-4">
              {TYPE_OPTIONS.map((opt) => {
                const isSelected = form.type === opt.value;
                return (
                  <button
                    key={opt.value}
                    type="button"
                    onClick={() => handleTypeChange(opt.value)}
                    className={`rounded-lg border-2 p-4 text-center transition-all ${
                      isSelected
                        ? 'border-blue-500 bg-blue-50'
                        : 'border-gray-200 hover:border-gray-300'
                    }`}
                  >
                    <div className={`w-10 h-10 mx-auto rounded-full ${opt.iconColor} flex items-center justify-center mb-2`}>
                      {isSelected ? <CheckIcon /> : (
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4" />
                        </svg>
                      )}
                    </div>
                    <p className="text-sm font-medium text-gray-900">{opt.label}</p>
                    <p className="text-xs text-gray-500 mt-1">{opt.desc}</p>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Type-specific config form */}
          {form.type === 'simple_threshold' && (
            <RuleFormSimple
              config={form.config as SimpleConfig}
              onChange={(config) => setForm((prev) => ({ ...prev, config }))}
            />
          )}
          {form.type === 'conditional_threshold' && (
            <RuleFormConditional
              config={form.config as ConditionalConfig}
              onChange={(config) => setForm((prev) => ({ ...prev, config }))}
            />
          )}
          {form.type === 'computed_with_modifiers' && (
            <RuleFormComputed
              config={form.config as ComputedConfig}
              onChange={(config) => setForm((prev) => ({ ...prev, config }))}
            />
          )}

          {/* Mitigations */}
          <MitigationEditor
            mitigations={form.mitigations}
            onChange={(mitigations) => setForm((prev) => ({ ...prev, mitigations }))}
          />
        </>
      )}

      {/* JSON View — placeholder for 6.3 */}
      {viewMode === 'json' && (
        <div className="bg-white rounded-lg border border-gray-200 shadow-sm p-6 mb-6">
          <div className="text-center py-12 text-sm text-gray-500">
            JSON Editor — coming in iteration 6.3
          </div>
        </div>
      )}

      {/* Actions */}
      <div className="flex items-center justify-between pb-8">
        <button
          type="button"
          onClick={() => navigate('/rules')}
          className="px-4 py-2 text-sm text-gray-500 hover:text-gray-700 transition-colors"
        >
          Cancel
        </button>
        <div className="flex gap-3">
          <button
            type="button"
            onClick={handleSave}
            disabled={isSaving || !form.name || !form.description}
            className="px-5 py-2.5 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
          >
            {isSaving && <SpinnerIcon />}
            {isNew ? 'Create Rule' : 'Save Changes'}
          </button>
          {!isNew && (
            <button
              type="button"
              onClick={() => navigate(`/rules/test?ruleId=${id}`)}
              className="px-5 py-2.5 text-sm font-medium text-amber-700 bg-amber-50 border border-amber-200 rounded-lg hover:bg-amber-100 transition-colors flex items-center gap-2"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.75 17L9 20l-1 1h8l-1-1-.75-3M3 13h18M5 17h14a2 2 0 002-2V5a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
              </svg>
              Test Rule
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

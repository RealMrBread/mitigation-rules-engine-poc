import { useState, useMemo } from 'react';
import {
  useActiveReleaseRules,
  type RuleSnapshot,
  type RuleSnapshotType,
  type RuleSnapshotMitigation,
} from '@/hooks/useRuleReference';

const TYPE_LABELS: Record<RuleSnapshotType, string> = {
  simple_threshold: 'Simple Threshold',
  conditional_threshold: 'Conditional Threshold',
  computed_with_modifiers: 'Computed with Modifiers',
};

const TYPE_BADGE_STYLES: Record<RuleSnapshotType, string> = {
  simple_threshold: 'bg-blue-50 text-blue-700 border-blue-200',
  conditional_threshold: 'bg-purple-50 text-purple-700 border-purple-200',
  computed_with_modifiers: 'bg-amber-50 text-amber-700 border-amber-200',
};

const TYPE_FILTER_OPTIONS: { value: string; label: string }[] = [
  { value: '', label: 'All Types' },
  { value: 'simple_threshold', label: 'Simple Threshold' },
  { value: 'conditional_threshold', label: 'Conditional Threshold' },
  { value: 'computed_with_modifiers', label: 'Computed with Modifiers' },
];

function SearchIcon() {
  return (
    <svg className="w-5 h-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
    </svg>
  );
}

function ChevronIcon({ open }: { open: boolean }) {
  return (
    <svg
      className={`w-5 h-5 text-gray-400 transition-transform duration-200 ${open ? 'rotate-180' : ''}`}
      fill="none"
      stroke="currentColor"
      viewBox="0 0 24 24"
    >
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
    </svg>
  );
}

function SpinnerIcon() {
  return (
    <svg className="w-5 h-5 animate-spin" fill="none" viewBox="0 0 24 24">
      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
    </svg>
  );
}

function BookIcon() {
  return (
    <svg className="w-12 h-12 text-gray-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
    </svg>
  );
}

function SimpleThresholdLogic({ config }: { config: Record<string, unknown> }) {
  const field = String(config.field ?? '');
  const operator = String(config.operator ?? '=');
  const value = String(config.value ?? '');
  return <p className="text-sm font-mono text-gray-700">{field} {operator} {value}</p>;
}

function ConditionalThresholdLogic({ config }: { config: Record<string, unknown> }) {
  const branches = (config.branches ?? []) as Array<Record<string, unknown>>;
  const defaultBranch = config.default as Record<string, unknown> | undefined;

  return (
    <div className="text-sm font-mono text-gray-700 space-y-1">
      {branches.map((branch, i) => (
        <div key={i}>
          <p>
            <span className="text-purple-600">WHEN</span>{' '}
            {String(branch.condition_field ?? '')} {String(branch.condition_operator ?? '=')} {String(branch.condition_value ?? '')}:
          </p>
          <p className="pl-4">
            {String(branch.field ?? '')} {String(branch.operator ?? '')} {String(branch.value ?? '')}
          </p>
        </div>
      ))}
      {defaultBranch && (
        <>
          <p><span className="text-purple-600">DEFAULT</span>:</p>
          <p className="pl-4">
            {String(defaultBranch.field ?? '')} {String(defaultBranch.operator ?? '=')} {String(defaultBranch.value ?? '')}
          </p>
        </>
      )}
    </div>
  );
}

function ComputedWithModifiersLogic({ config }: { config: Record<string, unknown> }) {
  const base = config.base_value ?? config.base;
  const unit = config.unit ? ` ${String(config.unit)}` : '';
  const modifiers = (config.modifiers ?? []) as Array<Record<string, unknown>>;
  const comparison = config.comparison as string | undefined;

  return (
    <div className="text-sm font-mono text-gray-700 space-y-1">
      <p>base = {String(base)}{unit}</p>
      {modifiers.length > 0 && (
        <p>required = base {modifiers.map((m) => `x ${String(m.field ?? m.name ?? 'modifier')}`).join(' x ')}</p>
      )}
      {modifiers.map((m, i) => {
        const values = (m.values ?? m.levels) as Record<string, unknown> | undefined;
        if (!values) return null;
        return (
          <p key={i} className="text-xs text-gray-500">
            {String(m.field ?? m.name ?? 'modifier')}: {Object.entries(values).map(([k, v]) => `${k}=${String(v)}`).join(', ')}
          </p>
        );
      })}
      {comparison && <p className="mt-1">FAIL if {comparison}</p>}
    </div>
  );
}

function RuleLogic({ rule }: { rule: RuleSnapshot }) {
  const config = rule.config;
  switch (rule.type) {
    case 'simple_threshold':
      return <SimpleThresholdLogic config={config} />;
    case 'conditional_threshold':
      return <ConditionalThresholdLogic config={config} />;
    case 'computed_with_modifiers':
      return <ComputedWithModifiersLogic config={config} />;
    default:
      return <pre className="text-xs text-gray-500">{JSON.stringify(config, null, 2)}</pre>;
  }
}

function MitigationItem({ mitigation }: { mitigation: RuleSnapshotMitigation }) {
  const isFull = mitigation.category === 'full';
  const bgClass = isFull ? 'bg-green-50 border-green-100' : 'bg-amber-50 border-amber-100';
  const badgeClass = isFull ? 'bg-green-100 text-green-700' : 'bg-amber-100 text-amber-700';
  const badgeLabel = isFull ? 'Full' : 'Bridge';

  return (
    <div className={`flex items-start gap-2 p-2.5 rounded-md border ${bgClass}`}>
      <span className={`inline-flex items-center px-1.5 py-0.5 rounded text-xs font-medium ${badgeClass}`}>
        {badgeLabel}
      </span>
      <div>
        <p className="text-sm font-medium text-gray-900">
          {mitigation.name}
          {mitigation.effect && (
            <span className="text-xs text-gray-400 font-normal ml-1">({mitigation.effect})</span>
          )}
        </p>
        <p className="text-xs text-gray-500">{mitigation.description}</p>
      </div>
    </div>
  );
}

function RuleCard({ rule }: { rule: RuleSnapshot }) {
  const [open, setOpen] = useState(false);
  const isUnmitigatable = rule.mitigations.length === 0;

  return (
    <div className="bg-white rounded-lg border border-gray-200 shadow-sm transition-shadow hover:shadow-md">
      <button
        onClick={() => setOpen(!open)}
        className="w-full px-5 py-4 flex items-center justify-between text-left"
      >
        <div className="flex items-center gap-3 flex-wrap">
          <h3 className="font-semibold text-gray-900">{rule.name}</h3>
          <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium border ${TYPE_BADGE_STYLES[rule.type]}`}>
            {TYPE_LABELS[rule.type]}
          </span>
          {isUnmitigatable && (
            <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-red-50 text-red-700 border border-red-200">
              Unmitigatable
            </span>
          )}
        </div>
        <ChevronIcon open={open} />
      </button>

      {open && (
        <div className="border-t border-gray-100 px-5 py-4">
          {rule.description && (
            <p className="text-sm text-gray-600 mb-4">{rule.description}</p>
          )}

          <div className="mb-4 p-3 bg-gray-50 rounded-md">
            <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">Rule Logic</p>
            <RuleLogic rule={rule} />
          </div>

          {isUnmitigatable ? (
            <div className="p-3 bg-red-50 rounded-md border border-red-100">
              <p className="text-sm text-red-700 font-medium">No mitigations available</p>
              <p className="text-xs text-red-600 mt-1">
                If this rule is triggered, the property is automatically declined (uninsurable).
              </p>
            </div>
          ) : (
            <div>
              <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">
                Available Mitigations
              </p>
              <div className="space-y-2">
                {rule.mitigations.map((m) => (
                  <MitigationItem key={m.id} mitigation={m} />
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function SkeletonCards() {
  return (
    <div className="space-y-3">
      {[1, 2, 3].map((i) => (
        <div key={i} className="bg-white rounded-lg border border-gray-200 shadow-sm animate-pulse px-5 py-4">
          <div className="flex items-center gap-3">
            <div className="h-5 bg-gray-200 rounded w-48" />
            <div className="h-5 bg-gray-200 rounded w-28" />
          </div>
        </div>
      ))}
    </div>
  );
}

export function RuleReferencePage() {
  const { data, isLoading, error } = useActiveReleaseRules();
  const [search, setSearch] = useState('');
  const [typeFilter, setTypeFilter] = useState('');

  const rules = useMemo(() => {
    if (!data?.rules) return [];
    const term = search.toLowerCase();
    return data.rules.filter((rule) => {
      const matchesSearch =
        !term ||
        rule.name.toLowerCase().includes(term) ||
        (rule.description ?? '').toLowerCase().includes(term);
      const matchesType = !typeFilter || rule.type === typeFilter;
      return matchesSearch && matchesType;
    });
  }, [data?.rules, search, typeFilter]);

  const totalCount = data?.rules?.length ?? 0;
  const releaseName = data?.release_name;

  return (
    <div>
      <header className="bg-white border-b border-gray-200 px-8 py-4 flex items-center justify-between">
        <div>
          <h2 className="text-xl font-semibold text-gray-900">Rule Reference</h2>
          <p className="text-sm text-gray-500 mt-0.5">
            Browse all rules from the active release (read-only)
          </p>
        </div>
        {releaseName && (
          <div className="flex items-center gap-3">
            <span className="text-xs text-gray-400">Active Release:</span>
            <span className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium bg-green-50 text-green-700 border border-green-200">
              {releaseName} (Active)
            </span>
          </div>
        )}
      </header>

      <div className="max-w-4xl mx-auto px-8 py-8">
        <div className="flex gap-3 mb-6">
          <div className="flex-1 relative">
            <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3">
              <SearchIcon />
            </div>
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search rules by name or description..."
              className="w-full pl-10 pr-4 py-2.5 rounded-lg border border-gray-300 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors"
            />
          </div>
          <select
            value={typeFilter}
            onChange={(e) => setTypeFilter(e.target.value)}
            className="rounded-lg border border-gray-300 px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            {TYPE_FILTER_OPTIONS.map((opt) => (
              <option key={opt.value} value={opt.value}>{opt.label}</option>
            ))}
          </select>
        </div>

        {isLoading && (
          <>
            <p className="text-sm text-gray-500 mb-4">Loading rules...</p>
            <SkeletonCards />
          </>
        )}

        {error && !isLoading && (
          <div className="text-center py-12">
            <p className="text-sm text-red-600">Failed to load rules. Please try again.</p>
          </div>
        )}

        {!isLoading && !error && data && (
          <>
            <p className="text-sm text-gray-500 mb-4">
              {rules.length === totalCount
                ? `${totalCount} rule${totalCount !== 1 ? 's' : ''} in this release`
                : `${rules.length} of ${totalCount} rule${totalCount !== 1 ? 's' : ''} shown`}
            </p>

            {rules.length === 0 ? (
              <div className="flex flex-col items-center py-16">
                <BookIcon />
                <p className="mt-3 text-sm font-medium text-gray-900">No rules found</p>
                <p className="mt-1 text-sm text-gray-500">
                  {search || typeFilter
                    ? 'Try adjusting your search or filter.'
                    : 'The active release has no rules.'}
                </p>
              </div>
            ) : (
              <div className="space-y-3">
                {rules.map((rule) => (
                  <RuleCard key={rule.id} rule={rule} />
                ))}
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}

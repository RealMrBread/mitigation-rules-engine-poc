import { useState } from 'react';
import {
  useReleaseList,
  useReleaseRules,
  usePublishRelease,
  useActivateRelease,
  type ReleaseListItem,
} from '@/hooks/useReleases';
import { useRuleList } from '@/hooks/useRules';

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

function ChevronIcon({ open }: { open: boolean }) {
  return (
    <svg
      className={`w-5 h-5 text-gray-400 transition-transform ${open ? 'rotate-180' : ''}`}
      fill="none"
      stroke="currentColor"
      viewBox="0 0 24 24"
    >
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
    </svg>
  );
}

function CheckCircleIcon() {
  return (
    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
    </svg>
  );
}

function TagIcon() {
  return (
    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 7h.01M7 3h5c.512 0 1.024.195 1.414.586l7 7a2 2 0 010 2.828l-7 7a2 2 0 01-2.828 0l-7-7A1.994 1.994 0 013 12V7a4 4 0 014-4z" />
    </svg>
  );
}

function SpinnerIcon() {
  return (
    <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
    </svg>
  );
}

function CloseIcon() {
  return (
    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
    </svg>
  );
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const TYPE_BADGES: Record<string, { label: string; color: string }> = {
  simple_threshold: { label: 'Simple', color: 'bg-blue-50 text-blue-700' },
  conditional_threshold: { label: 'Conditional', color: 'bg-purple-50 text-purple-700' },
  computed_with_modifiers: { label: 'Computed', color: 'bg-amber-50 text-amber-700' },
};

function formatDate(isoString: string): string {
  const date = new Date(isoString);
  return date.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
}

// ---------------------------------------------------------------------------
// Expandable release card
// ---------------------------------------------------------------------------

function ReleaseCard({
  release,
  isExpanded,
  onToggle,
  onActivate,
  isActivating,
}: {
  release: ReleaseListItem;
  isExpanded: boolean;
  onToggle: () => void;
  onActivate: () => void;
  isActivating: boolean;
}) {
  const { data: releaseRules, isLoading: isLoadingRules } = useReleaseRules(
    isExpanded ? release.id : undefined,
  );

  const borderClass = release.is_active ? 'border-2 border-green-200' : 'border border-gray-200';
  const iconBg = release.is_active
    ? 'bg-green-100 text-green-600'
    : 'bg-blue-100 text-blue-600';

  return (
    <div className={`bg-white rounded-lg ${borderClass} shadow-sm overflow-hidden`}>
      <button
        onClick={onToggle}
        className="w-full px-5 py-4 flex items-center justify-between text-left"
      >
        <div className="flex items-center gap-3">
          <span className={`inline-flex items-center justify-center w-8 h-8 rounded-full ${iconBg}`}>
            {release.is_active ? <CheckCircleIcon /> : <TagIcon />}
          </span>
          <div>
            <h3 className="font-semibold text-gray-900">{release.name}</h3>
            <p className="text-xs text-gray-500">
              Published {formatDate(release.published_at)}
            </p>
          </div>
          <span
            className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-semibold ${
              release.is_active
                ? 'bg-green-100 text-green-700'
                : 'bg-blue-100 text-blue-700'
            }`}
          >
            {release.is_active ? 'Active' : 'Published'}
          </span>
        </div>
        <div className="flex items-center gap-3">
          <ChevronIcon open={isExpanded} />
        </div>
      </button>

      {isExpanded && (
        <div className="border-t border-gray-100 px-5 py-4">
          <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-3">
            Rules in this release
          </p>

          {isLoadingRules && (
            <div className="flex items-center gap-2 py-4 text-sm text-gray-500">
              <SpinnerIcon /> Loading rules...
            </div>
          )}

          {releaseRules && (
            <div className="space-y-2">
              {releaseRules.map((rr) => {
                const snap = rr.rule_snapshot as any;
                const typeInfo = TYPE_BADGES[snap?.type] ?? { label: snap?.type ?? 'Unknown', color: 'bg-gray-50 text-gray-700' };
                const mitigationCount = Array.isArray(snap?.mitigations) ? snap.mitigations.length : 0;

                return (
                  <div key={rr.id} className="flex items-center justify-between p-3 bg-gray-50 rounded-md">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-medium text-gray-900">{snap?.name ?? 'Untitled'}</span>
                      <span className={`inline-flex items-center px-1.5 py-0.5 rounded text-xs ${typeInfo.color}`}>
                        {typeInfo.label}
                      </span>
                      {mitigationCount === 0 && (
                        <span className="inline-flex items-center px-1.5 py-0.5 rounded text-xs bg-red-50 text-red-700">
                          Unmitigatable
                        </span>
                      )}
                    </div>
                    <span className="text-xs text-gray-400">
                      {mitigationCount} mitigation{mitigationCount !== 1 ? 's' : ''}
                    </span>
                  </div>
                );
              })}
            </div>
          )}

          <div className="mt-4 pt-3 border-t border-gray-200 flex items-center justify-between">
            {release.is_active ? (
              <p className="text-xs text-green-600 font-medium">
                This is the currently active release used for new evaluations.
              </p>
            ) : (
              <div />
            )}
            {!release.is_active && (
              <button
                onClick={onActivate}
                disabled={isActivating}
                className="px-4 py-2 text-sm font-medium text-blue-700 bg-blue-50 border border-blue-200 rounded-lg hover:bg-blue-100 transition-colors disabled:opacity-50 flex items-center gap-2"
              >
                {isActivating && <SpinnerIcon />}
                Activate This Release
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Publish modal
// ---------------------------------------------------------------------------

function PublishModal({
  draftRules,
  onPublish,
  onCancel,
  isPublishing,
}: {
  draftRules: { name: string }[];
  onPublish: (name: string) => void;
  onCancel: () => void;
  isPublishing: boolean;
}) {
  const [name, setName] = useState('');

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="absolute inset-0 bg-black/40" onClick={onCancel} />
      <div className="relative bg-white rounded-xl shadow-2xl w-full max-w-md mx-4 p-6">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold text-gray-900">Publish New Release</h3>
          <button onClick={onCancel} className="p-1.5 text-gray-400 hover:text-gray-600 rounded-lg hover:bg-gray-100">
            <CloseIcon />
          </button>
        </div>
        <p className="text-sm text-gray-500 mb-4">
          This will create an immutable snapshot of all {draftRules.length} current draft rules. The snapshot cannot be modified after publishing.
        </p>
        <div className="mb-4">
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Release Name <span className="text-red-500">*</span>
          </label>
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="e.g., 2026-Q2-v1.0"
            className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
          />
          <p className="text-xs text-gray-400 mt-1">Use a descriptive version name</p>
        </div>
        <div className="mb-6 p-3 bg-gray-50 rounded-md border border-gray-200">
          <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">Rules to be snapshotted</p>
          <ul className="text-sm text-gray-700 space-y-1">
            {draftRules.map((rule, i) => (
              <li key={i} className="flex items-center gap-2">
                <svg className="w-4 h-4 text-green-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
                {rule.name}
              </li>
            ))}
          </ul>
        </div>
        <div className="flex gap-3 justify-end">
          <button
            onClick={onCancel}
            disabled={isPublishing}
            className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            onClick={() => onPublish(name)}
            disabled={!name.trim() || isPublishing}
            className="px-5 py-2 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 shadow-sm disabled:opacity-50 flex items-center gap-2"
          >
            {isPublishing && <SpinnerIcon />}
            Publish Release
          </button>
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// ReleaseManagerPage
// ---------------------------------------------------------------------------

export function ReleaseManagerPage() {
  const { data: releases, isLoading: isLoadingReleases } = useReleaseList();
  const { data: draftRules } = useRuleList();
  const publishRelease = usePublishRelease();
  const activateRelease = useActivateRelease();

  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [showPublishModal, setShowPublishModal] = useState(false);
  const [activatingId, setActivatingId] = useState<string | null>(null);

  function handleToggle(id: string) {
    setExpandedId((prev) => (prev === id ? null : id));
  }

  async function handlePublish(name: string) {
    await publishRelease.mutateAsync(name);
    setShowPublishModal(false);
  }

  async function handleActivate(id: string) {
    setActivatingId(id);
    try {
      await activateRelease.mutateAsync(id);
    } finally {
      setActivatingId(null);
    }
  }

  const totalReleases = releases?.length ?? 0;
  const activeCount = releases?.filter((r) => r.is_active).length ?? 0;
  const draftCount = draftRules?.length ?? 0;

  return (
    <div className="max-w-4xl mx-auto px-8 py-8">
      {/* Header */}
      <div className="flex items-center justify-between mb-8">
        <div>
          <h2 className="text-xl font-semibold text-gray-900">Release Manager</h2>
          <p className="text-sm text-gray-500 mt-0.5">Publish and manage rule releases</p>
        </div>
        <button
          onClick={() => setShowPublishModal(true)}
          disabled={!draftRules || draftRules.length === 0}
          className="inline-flex items-center gap-2 px-5 py-2.5 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 shadow-sm transition-colors disabled:opacity-50"
        >
          <PlusIcon />
          Publish New Release
        </button>
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-3 gap-4 mb-8">
        <div className="bg-white rounded-lg border border-gray-200 p-4 text-center">
          <p className="text-2xl font-bold text-gray-900">{totalReleases}</p>
          <p className="text-xs text-gray-500 mt-1">Total Releases</p>
        </div>
        <div className="bg-white rounded-lg border border-green-200 p-4 text-center">
          <p className="text-2xl font-bold text-green-600">{activeCount}</p>
          <p className="text-xs text-gray-500 mt-1">Active Release</p>
        </div>
        <div className="bg-white rounded-lg border border-gray-200 p-4 text-center">
          <p className="text-2xl font-bold text-gray-900">{draftCount}</p>
          <p className="text-xs text-gray-500 mt-1">Rules in Draft</p>
        </div>
      </div>

      {/* Release list */}
      {isLoadingReleases && (
        <div className="flex items-center justify-center py-12 gap-2">
          <SpinnerIcon />
          <span className="text-sm text-gray-500">Loading releases...</span>
        </div>
      )}

      {releases && (
        <div className="space-y-3">
          {releases.map((release) => (
            <ReleaseCard
              key={release.id}
              release={release}
              isExpanded={expandedId === release.id}
              onToggle={() => handleToggle(release.id)}
              onActivate={() => handleActivate(release.id)}
              isActivating={activatingId === release.id}
            />
          ))}

          {/* Draft workspace indicator */}
          <div className="bg-white rounded-lg border border-dashed border-gray-300 shadow-sm overflow-hidden">
            <div className="px-5 py-4 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <span className="inline-flex items-center justify-center w-8 h-8 rounded-full bg-gray-100 text-gray-400">
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                  </svg>
                </span>
                <div>
                  <h3 className="font-semibold text-gray-500">Draft Workspace</h3>
                  <p className="text-xs text-gray-400">
                    {draftCount} rule{draftCount !== 1 ? 's' : ''} currently in draft (not yet published)
                  </p>
                </div>
                <span className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-semibold bg-gray-100 text-gray-500">
                  Draft
                </span>
              </div>
              <span className="text-sm text-gray-400">{draftCount} rules</span>
            </div>
          </div>

          {/* Empty state */}
          {releases.length === 0 && (
            <div className="text-center py-12 text-sm text-gray-500">
              No releases yet. Publish your first release to get started.
            </div>
          )}
        </div>
      )}

      {/* Publish modal */}
      {showPublishModal && draftRules && (
        <PublishModal
          draftRules={draftRules.map((r) => ({ name: r.name }))}
          onPublish={handlePublish}
          onCancel={() => setShowPublishModal(false)}
          isPublishing={publishRelease.isPending}
        />
      )}
    </div>
  );
}

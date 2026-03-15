import type { BridgeStackBreakdown } from '@shared/types/evaluation.js';

// ---------------------------------------------------------------------------
// Computation logic
// ---------------------------------------------------------------------------

function computeStackBreakdown(
  baseThreshold: number,
  selectedBridges: Array<{ name: string; modifier: number }>,
  actualValue: number,
): BridgeStackBreakdown {
  let runningThreshold = baseThreshold;
  const breakdown: BridgeStackBreakdown['breakdown'] = [];

  for (const bridge of selectedBridges) {
    runningThreshold = runningThreshold * bridge.modifier;
    breakdown.push({
      bridge: bridge.name,
      modifier: bridge.modifier,
      running_threshold: Math.round(runningThreshold * 100) / 100,
    });
  }

  const bridgeModifierProduct = selectedBridges.reduce(
    (acc, b) => acc * b.modifier,
    1,
  );

  return {
    base_threshold: baseThreshold,
    bridge_modifier_product: bridgeModifierProduct,
    final_threshold: Math.round(runningThreshold * 100) / 100,
    actual_value: actualValue,
    passes: actualValue >= Math.round(runningThreshold * 100) / 100,
    breakdown,
  };
}

// ---------------------------------------------------------------------------
// BridgeStacker component
// ---------------------------------------------------------------------------

interface BridgeStackerProps {
  baseThreshold: number;
  selectedBridges: Array<{ name: string; modifier: number }>;
  actualValue: number;
  unit: string;
}

export function BridgeStacker({
  baseThreshold,
  selectedBridges,
  actualValue,
  unit,
}: BridgeStackerProps) {
  if (selectedBridges.length === 0) return null;

  const result = computeStackBreakdown(baseThreshold, selectedBridges, actualValue);
  const maxScale = Math.max(baseThreshold, actualValue) * 1.1;

  return (
    <div
      className="mt-3 p-3 bg-blue-50 rounded-md border border-blue-200"
      aria-live="polite"
    >
      <p className="text-xs font-semibold text-blue-700 mb-2">
        Stacked Bridge Effect
      </p>

      {/* Step calculation table */}
      <div className="text-sm font-mono text-gray-700 space-y-1">
        {/* Base threshold row */}
        <div className="flex items-center gap-2">
          <span className="text-gray-400 w-4 text-right" />
          <span>Base threshold</span>
          <span className="ml-auto font-semibold">
            {baseThreshold} {unit}
          </span>
        </div>

        {/* Each bridge modifier */}
        {result.breakdown.map((step, i) => (
          <div key={i} className="flex items-center gap-2">
            <span className="text-gray-400 w-4 text-right">x</span>
            <span>
              {step.bridge} (x{step.modifier})
            </span>
            <span className="ml-auto font-semibold">
              {step.running_threshold} {unit}
            </span>
          </div>
        ))}

        {/* Divider and final */}
        <div className="border-t border-gray-300 pt-1 flex items-center gap-2">
          <span className="text-gray-400 w-4 text-right">=</span>
          <span className="font-semibold">Final required threshold</span>
          <span
            className={`ml-auto font-bold ${
              result.passes ? 'text-green-600' : 'text-red-600'
            }`}
          >
            {result.final_threshold} {unit}
          </span>
        </div>

        {/* Actual vs threshold comparison */}
        <div
          className={`flex items-center gap-2 ${
            result.passes ? 'text-green-600' : 'text-red-600'
          }`}
        >
          <span className="w-4" />
          <span>
            Actual: {actualValue} {unit}{' '}
            {result.passes ? '>=' : '<'} {result.final_threshold} {unit}
          </span>
          <span className="ml-auto font-bold">
            {result.passes ? 'PASS' : 'FAIL'}
          </span>
        </div>
      </div>

      {/* Threshold bar visualization */}
      <div className="relative h-6 bg-gray-200 rounded-full overflow-hidden mt-3">
        {/* Base threshold marker */}
        <div
          className="absolute top-0 h-full border-r-2 border-dashed border-gray-400"
          style={{ left: `${(baseThreshold / maxScale) * 100}%` }}
        />

        {/* Final threshold zone */}
        <div
          className={`absolute top-0 h-full rounded-l-full transition-all duration-300 ${
            result.passes ? 'bg-green-200' : 'bg-red-200'
          }`}
          style={{
            width: `${(result.final_threshold / maxScale) * 100}%`,
          }}
        />

        {/* Actual value marker */}
        <div
          className={`absolute top-0 h-full w-1 transition-colors duration-300 ${
            result.passes ? 'bg-green-600' : 'bg-red-600'
          }`}
          style={{ left: `${(actualValue / maxScale) * 100}%` }}
        />
      </div>

      {/* Legend beneath bar */}
      <div className="flex justify-between text-xs text-gray-500 mt-1">
        <span>0</span>
        <span>
          {result.final_threshold} {unit} (final)
        </span>
        <span>
          {actualValue} {unit} (actual)
        </span>
        <span>
          {baseThreshold} {unit} (base)
        </span>
      </div>
    </div>
  );
}

import { useState } from 'react';
import { useForm, useFieldArray, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useNavigate } from 'react-router-dom';
import { useSubmitEvaluation } from '@/hooks/useEvaluation';
import { ApiClientError } from '@/lib/api';
import type { EvaluateRequest } from '@shared/types/api.js';

// ---------------------------------------------------------------------------
// Form validation schema (client-side, stricter than server ObservationSchema)
// ---------------------------------------------------------------------------

const observationFormSchema = z.object({
  property_id: z.string().min(1, 'Property ID is required'),
  state: z.string().min(1, 'State is required'),
  wildfire_risk_category: z.enum(['A', 'B', 'C', 'D'], {
    error: 'Risk category is required',
  }),
  home_to_home_distance: z.coerce
    .number({ error: 'Must be a number' })
    .positive('Must be greater than 0'),
  roof_type: z.enum(['Class A', 'Class B', 'Class C'], {
    error: 'Roof type is required',
  }),
  attic_vent_screens: z.enum(['None', 'Standard', 'Ember Resistant'], {
    error: 'Vent screen type is required',
  }),
  window_type: z.enum(['Single Pane', 'Double Pane', 'Tempered Glass'], {
    error: 'Window type is required',
  }),
  vegetation: z.array(
    z.object({
      type: z.enum(['Tree', 'Shrub', 'Grass'], {
        error: 'Vegetation type is required',
      }),
      distance_to_window: z.coerce
        .number({ error: 'Must be a number' })
        .positive('Must be greater than 0'),
    }),
  ),
  defensible_space: z.enum(['yes', 'no', '']).optional(),
  fire_station_distance: z.coerce
    .number()
    .positive('Must be greater than 0')
    .optional()
    .or(z.literal('')),
});

type ObservationFormValues = z.infer<typeof observationFormSchema>;

// ---------------------------------------------------------------------------
// Reusable style constants
// ---------------------------------------------------------------------------

const inputClass =
  'w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500';
const selectClass = inputClass;
const labelClass = 'block text-sm font-medium text-gray-700 mb-1';
const errorClass = 'text-sm text-red-500 mt-1';
const cardClass =
  'bg-white rounded-lg border border-gray-200 shadow-sm p-6 mb-6';

// ---------------------------------------------------------------------------
// Section Header component
// ---------------------------------------------------------------------------

function SectionHeader({
  icon,
  title,
  subtitle,
  action,
}: {
  icon: React.ReactNode;
  title: string;
  subtitle?: string;
  action?: React.ReactNode;
}) {
  return (
    <div className="flex items-center justify-between mb-4">
      <div className="flex items-center gap-2">
        {icon}
        <h3 className="text-base font-semibold text-gray-900">{title}</h3>
        {subtitle && (
          <span className="text-xs text-gray-400 ml-1">{subtitle}</span>
        )}
      </div>
      {action}
    </div>
  );
}

// ---------------------------------------------------------------------------
// SVG Icons
// ---------------------------------------------------------------------------

function LocationIcon() {
  return (
    <svg
      className="w-5 h-5 text-blue-600"
      fill="none"
      stroke="currentColor"
      viewBox="0 0 24 24"
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={2}
        d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z"
      />
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={2}
        d="M15 11a3 3 0 11-6 0 3 3 0 016 0z"
      />
    </svg>
  );
}

function HomeIcon() {
  return (
    <svg
      className="w-5 h-5 text-blue-600"
      fill="none"
      stroke="currentColor"
      viewBox="0 0 24 24"
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={2}
        d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-4 0h4"
      />
    </svg>
  );
}

function BuildingIcon() {
  return (
    <svg
      className="w-5 h-5 text-blue-600"
      fill="none"
      stroke="currentColor"
      viewBox="0 0 24 24"
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={2}
        d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4"
      />
    </svg>
  );
}

function WindowIcon() {
  return (
    <svg
      className="w-5 h-5 text-blue-600"
      fill="none"
      stroke="currentColor"
      viewBox="0 0 24 24"
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={2}
        d="M4 5a1 1 0 011-1h14a1 1 0 011 1v2a1 1 0 01-1 1H5a1 1 0 01-1-1V5zm0 8a1 1 0 011-1h6a1 1 0 011 1v6a1 1 0 01-1 1H5a1 1 0 01-1-1v-6zm12 0a1 1 0 011-1h2a1 1 0 011 1v6a1 1 0 01-1 1h-2a1 1 0 01-1-1v-6z"
      />
    </svg>
  );
}

function VegetationIcon() {
  return (
    <svg
      className="w-5 h-5 text-blue-600"
      fill="none"
      stroke="currentColor"
      viewBox="0 0 24 24"
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={2}
        d="M5 3v4M3 5h4M6 17v4m-2-2h4m5-16l2.286 6.857L21 12l-5.714 2.143L13 21l-2.286-6.857L5 12l5.714-2.143L13 3z"
      />
    </svg>
  );
}

function ProximityIcon() {
  return (
    <svg
      className="w-5 h-5 text-blue-600"
      fill="none"
      stroke="currentColor"
      viewBox="0 0 24 24"
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={2}
        d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6"
      />
    </svg>
  );
}

function PlusIcon() {
  return (
    <svg
      className="w-4 h-4"
      fill="none"
      stroke="currentColor"
      viewBox="0 0 24 24"
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={2}
        d="M12 6v6m0 0v6m0-6h6m-6 0H6"
      />
    </svg>
  );
}

function TrashIcon() {
  return (
    <svg
      className="w-5 h-5"
      fill="none"
      stroke="currentColor"
      viewBox="0 0 24 24"
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={2}
        d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"
      />
    </svg>
  );
}

function CheckCircleIcon() {
  return (
    <svg
      className="w-4 h-4"
      fill="none"
      stroke="currentColor"
      viewBox="0 0 24 24"
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={2}
        d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"
      />
    </svg>
  );
}

function SpinnerIcon() {
  return (
    <svg
      className="w-4 h-4 animate-spin"
      fill="none"
      viewBox="0 0 24 24"
    >
      <circle
        className="opacity-25"
        cx="12"
        cy="12"
        r="10"
        stroke="currentColor"
        strokeWidth="4"
      />
      <path
        className="opacity-75"
        fill="currentColor"
        d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
      />
    </svg>
  );
}

// ---------------------------------------------------------------------------
// Main form component
// ---------------------------------------------------------------------------

export function EvaluationFormPage() {
  const navigate = useNavigate();
  const evaluateMutation = useSubmitEvaluation();
  const [serverError, setServerError] = useState<string | null>(null);
  const [removingIndex, setRemovingIndex] = useState<number | null>(null);

  const {
    register,
    handleSubmit,
    control,
    reset,
    formState: { errors },
  } = useForm<ObservationFormValues>({
    resolver: zodResolver(observationFormSchema) as any,
    defaultValues: {
      property_id: '',
      state: '',
      wildfire_risk_category: undefined,
      home_to_home_distance: undefined as unknown as number,
      roof_type: undefined,
      attic_vent_screens: undefined,
      window_type: undefined,
      vegetation: [],
      defensible_space: '',
      fire_station_distance: undefined as unknown as number,
    },
    mode: 'onBlur',
  });

  const { fields, append, remove } = useFieldArray({
    control,
    name: 'vegetation',
  });

  const handleAddVegetation = () => {
    append({ type: '' as 'Tree', distance_to_window: 0 });
  };

  const handleRemoveVegetation = (index: number) => {
    setRemovingIndex(index);
    setTimeout(() => {
      remove(index);
      setRemovingIndex(null);
    }, 150);
  };

  const onSubmit = async (values: ObservationFormValues) => {
    setServerError(null);

    const request: EvaluateRequest = {
      observations: {
        property_id: values.property_id,
        state: values.state,
        wildfire_risk_category: values.wildfire_risk_category,
        home_to_home_distance: values.home_to_home_distance,
        roof_type: values.roof_type,
        attic_vent_screens: values.attic_vent_screens,
        window_type: values.window_type,
        vegetation:
          values.vegetation.length > 0 ? values.vegetation : undefined,
        ...(values.defensible_space && {
          defensible_space: values.defensible_space,
        }),
        ...(values.fire_station_distance != null &&
          values.fire_station_distance !== ('' as unknown as number) && {
            fire_station_distance: values.fire_station_distance,
          }),
      },
      release_id: null,
    };

    try {
      const result = await evaluateMutation.mutateAsync(request);
      navigate(`/evaluation/${result.evaluation_id}/results`);
    } catch (err) {
      if (err instanceof ApiClientError) {
        setServerError(err.message);
      } else {
        setServerError('An unexpected error occurred. Please try again.');
      }
    }
  };

  const handleClear = () => {
    reset();
    setServerError(null);
  };

  const isSubmitting = evaluateMutation.isPending;

  return (
    <div className="max-w-4xl mx-auto px-8 py-8">
      {/* Server error banner */}
      {serverError && (
        <div className="mb-6 rounded-md border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {serverError}
        </div>
      )}

      <form onSubmit={handleSubmit(onSubmit)}>
        {/* ---------------------------------------------------------------- */}
        {/* Property Information                                             */}
        {/* ---------------------------------------------------------------- */}
        <div className={cardClass}>
          <SectionHeader icon={<HomeIcon />} title="Property Information" />
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
            <div>
              <label htmlFor="property_id" className={labelClass}>
                Property ID <span className="text-red-500">*</span>
              </label>
              <input
                id="property_id"
                type="text"
                placeholder="e.g., PROP-001"
                {...register('property_id')}
                className={inputClass}
              />
              {errors.property_id && (
                <p className={errorClass}>{errors.property_id.message}</p>
              )}
            </div>
            <div>
              <label htmlFor="state" className={labelClass}>
                State <span className="text-red-500">*</span>
              </label>
              <Controller
                control={control}
                name="state"
                render={({ field }) => (
                  <select
                    id="state"
                    className={selectClass}
                    value={field.value}
                    onChange={field.onChange}
                    onBlur={field.onBlur}
                  >
                    <option value="">Select state...</option>
                    <option value="CA">California</option>
                    <option value="CO">Colorado</option>
                    <option value="OR">Oregon</option>
                    <option value="AZ">Arizona</option>
                    <option value="NV">Nevada</option>
                  </select>
                )}
              />
              {errors.state && (
                <p className={errorClass}>{errors.state.message}</p>
              )}
            </div>
          </div>
        </div>

        {/* ---------------------------------------------------------------- */}
        {/* Roof & Structure                                                 */}
        {/* ---------------------------------------------------------------- */}
        <div className={cardClass}>
          <SectionHeader icon={<BuildingIcon />} title="Roof & Structure" />
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
            <div>
              <label htmlFor="roof_type" className={labelClass}>
                Roof Type <span className="text-red-500">*</span>
              </label>
              <Controller
                control={control}
                name="roof_type"
                render={({ field }) => (
                  <select
                    id="roof_type"
                    className={selectClass}
                    value={field.value ?? ''}
                    onChange={field.onChange}
                    onBlur={field.onBlur}
                  >
                    <option value="">Select...</option>
                    <option value="Class A">Class A (Fire Resistant)</option>
                    <option value="Class B">Class B (Moderate)</option>
                    <option value="Class C">Class C (Light)</option>
                  </select>
                )}
              />
              {errors.roof_type && (
                <p className={errorClass}>{errors.roof_type.message}</p>
              )}
            </div>
            <div>
              <label htmlFor="attic_vent_screens" className={labelClass}>
                Attic Vent Screens <span className="text-red-500">*</span>
              </label>
              <Controller
                control={control}
                name="attic_vent_screens"
                render={({ field }) => (
                  <select
                    id="attic_vent_screens"
                    className={selectClass}
                    value={field.value ?? ''}
                    onChange={field.onChange}
                    onBlur={field.onBlur}
                  >
                    <option value="">Select...</option>
                    <option value="None">None</option>
                    <option value="Standard">Standard</option>
                    <option value="Ember Resistant">Ember Resistant</option>
                  </select>
                )}
              />
              {errors.attic_vent_screens && (
                <p className={errorClass}>
                  {errors.attic_vent_screens.message}
                </p>
              )}
            </div>
            <div>
              <label htmlFor="wildfire_risk_category" className={labelClass}>
                Wildfire Risk Category <span className="text-red-500">*</span>
              </label>
              <Controller
                control={control}
                name="wildfire_risk_category"
                render={({ field }) => (
                  <select
                    id="wildfire_risk_category"
                    className={selectClass}
                    value={field.value ?? ''}
                    onChange={field.onChange}
                    onBlur={field.onBlur}
                  >
                    <option value="">Select...</option>
                    <option value="A">A - Low</option>
                    <option value="B">B - Moderate</option>
                    <option value="C">C - High</option>
                    <option value="D">D - Very High</option>
                  </select>
                )}
              />
              {errors.wildfire_risk_category && (
                <p className={errorClass}>
                  {errors.wildfire_risk_category.message}
                </p>
              )}
            </div>
          </div>
        </div>

        {/* ---------------------------------------------------------------- */}
        {/* Windows                                                          */}
        {/* ---------------------------------------------------------------- */}
        <div className={cardClass}>
          <SectionHeader icon={<WindowIcon />} title="Windows & Openings" />
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
            <div>
              <label htmlFor="window_type" className={labelClass}>
                Window Type <span className="text-red-500">*</span>
              </label>
              <Controller
                control={control}
                name="window_type"
                render={({ field }) => (
                  <select
                    id="window_type"
                    className={selectClass}
                    value={field.value ?? ''}
                    onChange={field.onChange}
                    onBlur={field.onBlur}
                  >
                    <option value="">Select...</option>
                    <option value="Single Pane">Single Pane</option>
                    <option value="Double Pane">Double Pane</option>
                    <option value="Tempered Glass">Tempered Glass</option>
                  </select>
                )}
              />
              {errors.window_type && (
                <p className={errorClass}>{errors.window_type.message}</p>
              )}
            </div>
          </div>
        </div>

        {/* ---------------------------------------------------------------- */}
        {/* Vegetation (Dynamic Array)                                       */}
        {/* ---------------------------------------------------------------- */}
        <div className={cardClass}>
          <SectionHeader
            icon={<VegetationIcon />}
            title="Vegetation"
            subtitle="(surrounding property)"
            action={
              <button
                type="button"
                onClick={handleAddVegetation}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium text-blue-700 bg-blue-50 border border-blue-200 rounded-md hover:bg-blue-100 transition-colors"
              >
                <PlusIcon />
                Add Vegetation
              </button>
            }
          />

          {fields.length === 0 ? (
            <p className="text-sm text-gray-400 text-center py-6">
              No vegetation items added. Click &quot;Add Vegetation&quot; to
              begin.
            </p>
          ) : (
            <div className="space-y-3">
              {fields.map((field, index) => (
                <div
                  key={field.id}
                  className={`flex items-start gap-3 p-4 bg-gray-50 rounded-lg border border-gray-100 transition-all duration-150 ${
                    removingIndex === index
                      ? 'opacity-0 -translate-x-2'
                      : 'opacity-100 translate-x-0'
                  }`}
                >
                  <div className="flex-1 grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <label className={labelClass}>
                        Type <span className="text-red-500">*</span>
                      </label>
                      <Controller
                        control={control}
                        name={`vegetation.${index}.type`}
                        render={({ field: selectField }) => (
                          <select
                            className={selectClass}
                            value={selectField.value ?? ''}
                            onChange={selectField.onChange}
                            onBlur={selectField.onBlur}
                          >
                            <option value="">Select...</option>
                            <option value="Tree">Tree</option>
                            <option value="Shrub">Shrub</option>
                            <option value="Grass">Grass</option>
                          </select>
                        )}
                      />
                      {errors.vegetation?.[index]?.type && (
                        <p className={errorClass}>
                          {errors.vegetation[index].type?.message}
                        </p>
                      )}
                    </div>
                    <div>
                      <label className={labelClass}>
                        Distance to Window (ft){' '}
                        <span className="text-red-500">*</span>
                      </label>
                      <input
                        type="number"
                        step="0.1"
                        min="0"
                        placeholder="e.g., 30"
                        {...register(
                          `vegetation.${index}.distance_to_window`,
                          { valueAsNumber: true },
                        )}
                        className={inputClass}
                      />
                      {errors.vegetation?.[index]?.distance_to_window && (
                        <p className={errorClass}>
                          {
                            errors.vegetation[index].distance_to_window
                              ?.message
                          }
                        </p>
                      )}
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => handleRemoveVegetation(index)}
                    className="mt-6 p-1.5 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded transition-colors"
                    aria-label={`Remove vegetation item ${index + 1}`}
                  >
                    <TrashIcon />
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* ---------------------------------------------------------------- */}
        {/* Home Distance                                                    */}
        {/* ---------------------------------------------------------------- */}
        <div className={cardClass}>
          <SectionHeader
            icon={<LocationIcon />}
            title="Home Distance"
          />
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
            <div>
              <label htmlFor="home_to_home_distance" className={labelClass}>
                Home-to-Home Distance (ft){' '}
                <span className="text-red-500">*</span>
              </label>
              <input
                id="home_to_home_distance"
                type="number"
                step="0.1"
                min="0"
                placeholder="e.g., 25.0"
                {...register('home_to_home_distance', {
                  valueAsNumber: true,
                })}
                className={inputClass}
              />
              <p className="text-xs text-gray-400 mt-1">
                Minimum edge-to-edge between building footprints
              </p>
              {errors.home_to_home_distance && (
                <p className={errorClass}>
                  {errors.home_to_home_distance.message}
                </p>
              )}
            </div>
          </div>
        </div>

        {/* ---------------------------------------------------------------- */}
        {/* Proximity & Additional                                           */}
        {/* ---------------------------------------------------------------- */}
        <div className="bg-white rounded-lg border border-gray-200 shadow-sm p-6 mb-8">
          <SectionHeader
            icon={<ProximityIcon />}
            title="Proximity & Additional"
          />
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
            <div>
              <label htmlFor="defensible_space" className={labelClass}>
                Defensible Space Maintained
              </label>
              <Controller
                control={control}
                name="defensible_space"
                render={({ field }) => (
                  <select
                    id="defensible_space"
                    className={selectClass}
                    value={field.value ?? ''}
                    onChange={field.onChange}
                    onBlur={field.onBlur}
                  >
                    <option value="">Select...</option>
                    <option value="yes">Yes</option>
                    <option value="no">No</option>
                  </select>
                )}
              />
            </div>
            <div>
              <label htmlFor="fire_station_distance" className={labelClass}>
                Fire Station Distance (miles)
              </label>
              <input
                id="fire_station_distance"
                type="number"
                step="0.1"
                min="0"
                placeholder="e.g., 5.0"
                {...register('fire_station_distance', {
                  valueAsNumber: true,
                })}
                className={inputClass}
              />
            </div>
          </div>
        </div>

        {/* ---------------------------------------------------------------- */}
        {/* Form Actions                                                     */}
        {/* ---------------------------------------------------------------- */}
        <div className="flex items-center justify-between pb-8">
          <p className="text-xs text-gray-400">
            <span className="text-red-500">*</span> Required fields
          </p>
          <div className="flex gap-3">
            <button
              type="button"
              onClick={handleClear}
              className="px-5 py-2.5 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
            >
              Clear Form
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className="px-6 py-2.5 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 shadow-sm transition-colors flex items-center gap-2 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {isSubmitting ? (
                <>
                  <SpinnerIcon />
                  Evaluating...
                </>
              ) : (
                <>
                  <CheckCircleIcon />
                  Evaluate Property
                </>
              )}
            </button>
          </div>
        </div>
      </form>
    </div>
  );
}

# Frontend Component Specification

> Mitigation Rules Engine -- React + shadcn/ui + React Hook Form + Zod + TanStack Query

---

## 1. Component Tree

```
App
 ├── AuthProvider                        (React Context -- token, user)
 ├── QueryClientProvider                 (TanStack Query)
 └── RouterProvider                      (react-router v6)
      │
      ├── LoginPage
      │
      ├── AppShell                       (sidebar + header + outlet)
      │    ├── Sidebar
      │    │    ├── SidebarNav
      │    │    └── SidebarUserInfo
      │    ├── PageHeader
      │    └── <Outlet />
      │
      ├── EvaluationFormPage
      │    └── ObservationForm
      │         ├── StateSelector
      │         ├── PropertyInfoSection
      │         │    ├── WildfireRiskCategoryField
      │         │    └── HomeToHomeDistanceField
      │         ├── RoofStructureSection
      │         │    ├── RoofTypeField
      │         │    └── AtticVentScreensField
      │         ├── WindowsSection
      │         │    └── WindowTypeField
      │         ├── VegetationSection           (dynamic array)
      │         │    └── VegetationItem[]
      │         │         ├── VegetationTypeField
      │         │         └── DistanceToWindowField
      │         ├── ProximitySection
      │         │    ├── DefensibleSpaceField
      │         │    └── FireStationDistanceField
      │         └── FormActions
      │              ├── ClearFormButton
      │              └── SubmitButton
      │
      ├── EvaluationResultsPage
      │    ├── SummaryBar
      │    │    ├── StatCard (total)
      │    │    ├── StatCard (auto-decline)
      │    │    ├── StatCard (mitigatable)
      │    │    └── StatCard (bridge used / limit)
      │    ├── AutoDeclineBanner
      │    ├── VulnerabilityCard[]
      │    │    ├── VulnerabilityHeader
      │    │    ├── RuleDetails
      │    │    │    └── ComputationBreakdown   (computed rules only)
      │    │    ├── MitigationList              (collapsible)
      │    │    │    ├── FullMitigationItem[]
      │    │    │    └── BridgeMitigationItem[]
      │    │    └── BridgeStackerUI             (when bridges exist)
      │    ├── BridgeBudgetBanner
      │    └── ResultsActions
      │         ├── BackToFormLink
      │         └── SubmitMitigationsButton
      │
      ├── EvaluationHistoryPage
      │    └── EvaluationTable
      │         └── EvaluationRow[]
      │
      └── EvaluationDetailPage
           └── (reuses EvaluationResultsPage in read-only mode)
```

---

## 2. Component Specifications

### 2.1 AppShell

```ts
// No external props -- renders layout chrome around <Outlet />
interface AppShellProps {}
```

| Aspect | Details |
|---|---|
| **State** | `currentPath` derived from `useLocation()` for active sidebar link |
| **API calls** | None |
| **Key interactions** | Sidebar nav links via `<Link>` |
| **shadcn/ui** | None (custom layout divs matching the mock sidebar) |

---

### 2.2 Sidebar

```ts
interface SidebarProps {
  currentPath: string;
}
```

| Aspect | Details |
|---|---|
| **State** | None |
| **API calls** | None |
| **Key interactions** | Navigation links; logout button calls `useAuth().logout()` |
| **shadcn/ui** | `Avatar`, `Button` (for logout) |

---

### 2.3 SidebarUserInfo

```ts
interface SidebarUserInfoProps {
  user: {
    email: string;
    role: Role;
    initials: string;
  };
}
```

| Aspect | Details |
|---|---|
| **shadcn/ui** | `Avatar`, `AvatarFallback` |

---

### 2.4 PageHeader

```ts
interface PageHeaderProps {
  title: string;
  subtitle?: string;
  releaseTag?: { id: string; name: string };
}
```

| Aspect | Details |
|---|---|
| **shadcn/ui** | `Badge` (for the release tag, variant `outline`) |

---

### 2.5 LoginPage

```ts
interface LoginFormValues {
  email: string;
  password: string;
}
```

| Aspect | Details |
|---|---|
| **State** | Form state via React Hook Form; `isSubmitting` loading flag |
| **API calls** | `useLoginMutation()` -- POST `/api/auth/login` returning `LoginResponse` |
| **Key interactions** | Submit calls mutation; on success stores token in AuthContext and redirects to `/evaluations/new` |
| **Validation** | Zod schema: email required + valid format, password required + min 8 chars |
| **shadcn/ui** | `Card`, `CardHeader`, `CardContent`, `Input`, `Button`, `Label`, `Alert` (for errors) |

---

### 2.6 ObservationForm

This is the main form component. It owns the React Hook Form instance and renders all sections.

```ts
interface ObservationFormProps {
  onSubmitSuccess: (evaluationId: string) => void;
}

// Form values shape (mirrors ObservationHash but UI-friendly)
interface ObservationFormValues {
  state: string;                                        // required
  property_id: string;                                  // auto-generated or entered
  wildfire_risk_category: "A" | "B" | "C" | "D";       // required
  home_to_home_distance: number;                        // required
  roof_type: "Class A" | "Class B" | "Class C";        // required
  attic_vent_screens: "None" | "Standard" | "Ember Resistant"; // required
  window_type: "Single Pane" | "Double Pane" | "Tempered Glass"; // required
  vegetation: Array<{
    type: "Tree" | "Shrub" | "Grass";
    distance_to_window: number;
  }>;
  defensible_space: "yes" | "no" | "";                  // optional
  fire_station_distance: number | null;                 // optional
}
```

| Aspect | Details |
|---|---|
| **State** | `useForm<ObservationFormValues>()` with Zod resolver; `useFieldArray` for vegetation |
| **API calls** | `useEvaluateMutation()` -- POST `/api/evaluations` with `EvaluateRequest` body |
| **Key interactions** | Submit transforms `ObservationFormValues` into `EvaluateRequest`, calls mutation, navigates to results on success |
| **shadcn/ui** | `Card`, `CardContent`, `Button`, `Select`, `SelectTrigger`, `SelectContent`, `SelectItem`, `Input`, `Label` |

---

### 2.7 StateSelector

```ts
interface StateSelectorProps {
  control: Control<ObservationFormValues>;
  error?: FieldError;
}
```

Available states: `CA`, `CO`, `OR`, `MT`, `WA`.

| Aspect | Details |
|---|---|
| **shadcn/ui** | `Select`, `SelectTrigger`, `SelectContent`, `SelectItem` wrapped with `FormField` from `react-hook-form` |

---

### 2.8 PropertyInfoSection

```ts
interface PropertyInfoSectionProps {
  control: Control<ObservationFormValues>;
  errors: FieldErrors<ObservationFormValues>;
}
```

Contains `WildfireRiskCategoryField` (select with A/B/C/D options) and `HomeToHomeDistanceField` (numeric input with step 0.1, min 0, helper text below).

| Aspect | Details |
|---|---|
| **shadcn/ui** | `Card`, `CardContent`, `Select`, `Input`, `Label`, plus inline error text from `FormMessage` |

---

### 2.9 RoofStructureSection

```ts
interface RoofStructureSectionProps {
  control: Control<ObservationFormValues>;
  errors: FieldErrors<ObservationFormValues>;
}
```

Two selects: `roof_type` (Class A/B/C) and `attic_vent_screens` (None/Standard/Ember Resistant).

| **shadcn/ui** | `Card`, `CardContent`, `Select`, `Label` |

---

### 2.10 WindowsSection

```ts
interface WindowsSectionProps {
  control: Control<ObservationFormValues>;
  errors: FieldErrors<ObservationFormValues>;
}
```

Single select: `window_type`.

| **shadcn/ui** | `Card`, `CardContent`, `Select`, `Label` |

---

### 2.11 VegetationSection

```ts
interface VegetationSectionProps {
  control: Control<ObservationFormValues>;
  errors: FieldErrors<ObservationFormValues>;
}
```

| Aspect | Details |
|---|---|
| **State** | `useFieldArray({ control, name: "vegetation" })` returning `{ fields, append, remove }` |
| **Key interactions** | "Add Vegetation" calls `append({ type: "", distance_to_window: 0 })`; trash icon calls `remove(index)` with a slide-out animation (150ms CSS transition before removal) |
| **Empty state** | When `fields.length === 0`, render a centered placeholder: "No vegetation items added." |
| **shadcn/ui** | `Card`, `CardContent`, `Button` (outline variant for "Add Vegetation"), `Select`, `Input`, `Label` |

---

### 2.12 VegetationItem

```ts
interface VegetationItemProps {
  index: number;
  control: Control<ObservationFormValues>;
  onRemove: () => void;
  error?: FieldErrors<VegetationItem>;
}
```

Renders a row with type select and distance input. Trash icon button at the right. Wrapped in a `bg-gray-50` rounded container with border.

| **shadcn/ui** | `Select`, `Input`, `Button` (ghost variant, icon-only for delete) |

---

### 2.13 ProximitySection

```ts
interface ProximitySectionProps {
  control: Control<ObservationFormValues>;
  errors: FieldErrors<ObservationFormValues>;
}
```

Two optional fields: `defensible_space` (yes/no select) and `fire_station_distance` (numeric input).

| **shadcn/ui** | `Card`, `CardContent`, `Select`, `Input`, `Label` |

---

### 2.14 FormActions

```ts
interface FormActionsProps {
  isSubmitting: boolean;
  onClear: () => void;
}
```

| Aspect | Details |
|---|---|
| **Key interactions** | "Clear Form" calls `form.reset()` via `onClear`; "Evaluate Property" triggers form submit |
| **shadcn/ui** | `Button` (outline for clear, default for submit with loading spinner) |

---

### 2.15 SummaryBar

```ts
interface SummaryBarProps {
  summary: EvaluationSummary;
  bridgesUsed: number;
}
```

| Aspect | Details |
|---|---|
| **shadcn/ui** | `Card`, `CardContent` (four cards in a `grid-cols-4` layout) |

Color coding per card:
- Total: default gray border
- Auto-decline: `border-red-200`, text `text-red-600`
- Mitigatable: `border-amber-200`, text `text-amber-600`
- Bridge used: `border-blue-200`, text `text-blue-600`

---

### 2.16 AutoDeclineBanner

```ts
interface AutoDeclineBannerProps {
  vulnerabilities: VulnerabilityResult[];  // only the unmitigatable ones
}
```

Renders only when at least one vulnerability has `triggered === true` and `mitigations.length === 0`. Shows the rule name, observed vs required values, and a note that remaining mitigatable vulnerabilities are shown for information.

| Aspect | Details |
|---|---|
| **Conditionally rendered** | `autoDeclineVulns.length > 0` |
| **shadcn/ui** | `Alert`, `AlertTitle`, `AlertDescription` (destructive variant) |

---

### 2.17 VulnerabilityCard

```ts
interface VulnerabilityCardProps {
  vulnerability: VulnerabilityResult;
  bridgesUsed: number;
  bridgeLimit: number;
  selectedMitigations: Map<string, Set<string>>;  // rule_id -> set of mitigation_ids
  onToggleMitigation: (ruleId: string, mitigationId: string, category: "full" | "bridge") => void;
}
```

| Aspect | Details |
|---|---|
| **State** | `isExpanded` (boolean) for mitigation section collapse/expand |
| **Key interactions** | Chevron button toggles `isExpanded`; mitigation checkboxes call `onToggleMitigation` |
| **Border color** | Unmitigatable: `border-red-300`; Mitigatable: `border-amber-200` |
| **shadcn/ui** | `Card`, `CardContent`, `Badge` ("Unmitigatable" red or "Mitigatable" amber), `Button` (ghost for chevron), `Collapsible`, `CollapsibleTrigger`, `CollapsibleContent` |

---

### 2.18 VulnerabilityHeader

```ts
interface VulnerabilityHeaderProps {
  ruleName: string;
  description: string;
  isUnmitigatable: boolean;
  isExpanded: boolean;
  onToggleExpand: () => void;
}
```

Icon: red slash-circle for unmitigatable, amber warning triangle for mitigatable.

| **shadcn/ui** | `Badge` |

---

### 2.19 RuleDetails

```ts
interface RuleDetailsProps {
  details: EvalResult["details"];
  ruleType: RuleType;
}
```

Renders the "Why flagged" explanation box. For `computed_with_modifiers` rules, also renders `ComputationBreakdown`.

| Aspect | Details |
|---|---|
| **Background** | Unmitigatable: `bg-red-50`; Mitigatable: `bg-amber-50` |
| **shadcn/ui** | None (custom styled div) |

---

### 2.20 ComputationBreakdown

```ts
interface ComputationBreakdownProps {
  baseValue: number;
  unit: string;
  modifiers: Array<{
    label: string;      // e.g., "Window modifier (Single Pane)"
    value: number;      // e.g., 3
    operation: string;  // "multiply" | "divide"
  }>;
  computedThreshold: number;
  actualValue: number;
  passes: boolean;
}
```

Renders the step-by-step monospace computation table from the mock (base value, then each modifier with x or / symbol, then = result, then actual vs required with PASS/FAIL).

| Aspect | Details |
|---|---|
| **shadcn/ui** | None (custom `font-mono` div) |

---

### 2.21 MitigationList

```ts
interface MitigationListProps {
  mitigations: Mitigation[];
  ruleId: string;
  selectedMitigationIds: Set<string>;
  bridgesUsed: number;
  bridgeLimit: number;
  onToggle: (mitigationId: string, category: "full" | "bridge") => void;
}
```

Renders full mitigations first, then bridge mitigations under a separate sub-heading.

| **shadcn/ui** | `Separator` between full and bridge sections |

---

### 2.22 FullMitigationItem

```ts
interface FullMitigationItemProps {
  mitigation: Mitigation;   // category === "full"
  isSelected: boolean;
  onToggle: () => void;
}
```

| Aspect | Details |
|---|---|
| **Key interactions** | Click anywhere on the card toggles `isSelected` |
| **Visual states** | Unselected: `border-gray-200`; Selected: `bg-green-50 border-green-500` |
| **shadcn/ui** | `Badge` (green, text "Full"), `Checkbox` (hidden, controls visual state) |

---

### 2.23 BridgeMitigationItem

```ts
interface BridgeMitigationItemProps {
  mitigation: Mitigation;   // category === "bridge"
  isSelected: boolean;
  isDisabled: boolean;       // true when bridge budget exhausted and this one is not selected
  onToggle: () => void;
  effectLabel: string;       // e.g., "Modifier: x0.8"
  impactPreview?: {
    newThreshold: number;
    actualValue: number;
    passes: boolean;
  };
}
```

| Aspect | Details |
|---|---|
| **Key interactions** | Click toggles unless `isDisabled`; disabled state grays out the card |
| **Visual states** | Unselected: `border-gray-200`; Selected: `bg-amber-50 border-amber-500`; Disabled: `opacity-50 cursor-not-allowed` |
| **shadcn/ui** | `Badge` (amber, text "Bridge"), `Checkbox` (hidden) |

---

### 2.24 BridgeStackerUI

This is the most complex interactive component. See Section 4 for detailed specification.

```ts
interface BridgeStackerUIProps {
  baseThreshold: number;
  unit: string;
  actualValue: number;
  bridges: Array<{
    id: string;
    name: string;
    modifier: number;       // e.g., 0.8
    isSelected: boolean;
  }>;
  onToggleBridge: (bridgeId: string) => void;
  bridgesUsed: number;      // global count across all vulnerabilities
  bridgeLimit: number;
}
```

| Aspect | Details |
|---|---|
| **State** | Computed locally: `breakdown: BridgeStackBreakdown` derived from selected bridges |
| **shadcn/ui** | `Card`, `Badge`, `Progress` (custom styled for threshold bar) |

---

### 2.25 BridgeBudgetBanner

```ts
interface BridgeBudgetBannerProps {
  bridgesUsed: number;
  bridgeLimit: number;
}
```

| Aspect | Details |
|---|---|
| **Conditionally rendered** | Only when `bridgesUsed > 0` |
| **Visual states** | Under limit: amber background/border; At limit: red background/border with warning text |
| **shadcn/ui** | `Alert`, `AlertDescription` |

---

### 2.26 ResultsActions

```ts
interface ResultsActionsProps {
  evaluationId: string;
  selections: SelectMitigationsRequest["selections"];
  hasSelections: boolean;
  isSubmitting: boolean;
  onSubmit: () => void;
}
```

| Aspect | Details |
|---|---|
| **Key interactions** | "Back to Form" navigates via `<Link>` to `/evaluations/new`; "Submit Mitigation Selections" calls `onSubmit` |
| **shadcn/ui** | `Button` (default for submit, `Link` for back) |

---

### 2.27 StatCard

```ts
interface StatCardProps {
  value: number;
  label: string;
  borderColor?: string;    // Tailwind border class
  textColor?: string;      // Tailwind text class
  suffix?: string;         // e.g., "/ 3 Limit"
}
```

| **shadcn/ui** | `Card`, `CardContent` |

---

### 2.28 EvaluationHistoryPage / EvaluationTable

```ts
interface EvaluationHistoryEntry {
  evaluation_id: string;
  created_at: string;
  state: string;
  property_id: string;
  auto_declined: boolean;
  total_vulnerabilities: number;
  mitigatable: number;
}
```

| Aspect | Details |
|---|---|
| **API calls** | `useEvaluationHistory()` -- GET `/api/evaluations` |
| **Key interactions** | Row click navigates to `/evaluations/:id` |
| **shadcn/ui** | `Table`, `TableHeader`, `TableBody`, `TableRow`, `TableCell`, `Badge` |

---

## 3. Form Design

### 3.1 React Hook Form Setup

```tsx
import { useForm, useFieldArray } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";

// Client-side form schema (stricter than the server ObservationSchema
// because we require all fields the UI presents)
const observationFormSchema = z.object({
  state: z.string().min(1, "State is required"),
  property_id: z.string().min(1, "Property ID is required"),
  wildfire_risk_category: z.enum(["A", "B", "C", "D"], {
    required_error: "Risk category is required",
  }),
  home_to_home_distance: z.coerce
    .number({ invalid_type_error: "Must be a number" })
    .positive("Must be greater than 0"),
  roof_type: z.enum(["Class A", "Class B", "Class C"], {
    required_error: "Roof type is required",
  }),
  attic_vent_screens: z.enum(["None", "Standard", "Ember Resistant"], {
    required_error: "Vent screen type is required",
  }),
  window_type: z.enum(["Single Pane", "Double Pane", "Tempered Glass"], {
    required_error: "Window type is required",
  }),
  vegetation: z.array(
    z.object({
      type: z.enum(["Tree", "Shrub", "Grass"], {
        required_error: "Vegetation type is required",
      }),
      distance_to_window: z.coerce
        .number({ invalid_type_error: "Must be a number" })
        .positive("Must be greater than 0"),
    })
  ),
  defensible_space: z.enum(["yes", "no", ""]).optional(),
  fire_station_distance: z.coerce.number().positive().nullable().optional(),
});

type ObservationFormValues = z.infer<typeof observationFormSchema>;

// Inside ObservationForm component:
const form = useForm<ObservationFormValues>({
  resolver: zodResolver(observationFormSchema),
  defaultValues: {
    state: "",
    property_id: "",
    wildfire_risk_category: undefined,
    home_to_home_distance: undefined,
    roof_type: undefined,
    attic_vent_screens: undefined,
    window_type: undefined,
    vegetation: [],
    defensible_space: "",
    fire_station_distance: null,
  },
  mode: "onBlur",            // validate on blur for top-level fields
});

const vegetationArray = useFieldArray({
  control: form.control,
  name: "vegetation",
});
```

### 3.2 Field-by-Field Specification

| Field | Type | Required | Input | Validation |
|---|---|---|---|---|
| `state` | `string` | Yes | `Select` with 5 state options | Non-empty |
| `property_id` | `string` | Yes | `Input` text (or auto-generated UUID) | Non-empty string |
| `wildfire_risk_category` | `enum` | Yes | `Select` with A/B/C/D | Must be valid enum value |
| `home_to_home_distance` | `number` | Yes | `Input` type=number, step=0.1, min=0 | Positive number |
| `roof_type` | `enum` | Yes | `Select` with Class A/B/C | Must be valid enum value |
| `attic_vent_screens` | `enum` | Yes | `Select` with None/Standard/Ember Resistant | Must be valid enum value |
| `window_type` | `enum` | Yes | `Select` with Single/Double/Tempered | Must be valid enum value |
| `vegetation[n].type` | `enum` | Yes (per item) | `Select` with Tree/Shrub/Grass | Must be valid enum value |
| `vegetation[n].distance_to_window` | `number` | Yes (per item) | `Input` type=number, step=0.1, min=0 | Positive number |
| `defensible_space` | `enum` | No | `Select` with yes/no | Optional |
| `fire_station_distance` | `number` | No | `Input` type=number, step=0.1, min=0 | Positive number when provided |

### 3.3 Dynamic Vegetation Array

```tsx
// Add item
const handleAddVegetation = () => {
  vegetationArray.append({
    type: "" as any,             // forces user to select
    distance_to_window: 0,
  });
};

// Remove item with exit animation
const handleRemoveVegetation = (index: number) => {
  // Set a CSS class to trigger slide-out, then remove after 150ms
  setRemovingIndex(index);
  setTimeout(() => {
    vegetationArray.remove(index);
    setRemovingIndex(null);
  }, 150);
};
```

Local state `removingIndex: number | null` drives the exit animation class `.opacity-0 .-translate-x-2 transition-all duration-150`.

### 3.4 Validation Timing

| Trigger | Scope | Behavior |
|---|---|---|
| `onBlur` | Individual field | Validates the blurred field and shows inline error beneath it |
| `onSubmit` | Entire form | Validates all fields; scrolls to first error field via `form.setFocus(firstErrorField)` |
| `onChange` (vegetation only) | Array items | After first blur, subsequent changes revalidate immediately so the user sees errors clear in real time |

### 3.5 Error Display Pattern

Each field error renders as a `<p className="text-sm text-red-500 mt-1">` below the input. Uses the `FormMessage` pattern from shadcn/ui `Form` component:

```tsx
<FormField
  control={form.control}
  name="state"
  render={({ field }) => (
    <FormItem>
      <FormLabel>
        State <span className="text-red-500">*</span>
      </FormLabel>
      <FormControl>
        <Select onValueChange={field.onChange} value={field.value}>
          {/* ... options ... */}
        </Select>
      </FormControl>
      <FormMessage />   {/* auto-renders error from Zod */}
    </FormItem>
  )}
/>
```

Server-side validation errors from the API (`ApiError`) are displayed in an `Alert` (destructive variant) at the top of the form.

### 3.6 Form Submission Transform

```tsx
const onSubmit = async (values: ObservationFormValues) => {
  const request: EvaluateRequest = {
    observations: {
      property_id: values.property_id,
      state: values.state,
      wildfire_risk_category: values.wildfire_risk_category,
      home_to_home_distance: values.home_to_home_distance,
      roof_type: values.roof_type,
      attic_vent_screens: values.attic_vent_screens,
      window_type: values.window_type,
      vegetation: values.vegetation.length > 0 ? values.vegetation : undefined,
      // Optional fields: only include if provided
      ...(values.defensible_space && { defensible_space: values.defensible_space }),
      ...(values.fire_station_distance != null && {
        fire_station_distance: values.fire_station_distance,
      }),
    },
    release_id: null,           // uses active release
  };
  const result = await evaluateMutation.mutateAsync(request);
  navigate(`/evaluations/${result.data.evaluation_id}`);
};
```

---

## 4. Bridge Stacking UI Component

### 4.1 Overview

The `BridgeStackerUI` is the most complex interactive piece in the application. It lets the underwriter toggle bridge mitigations on/off and see in real time how the required threshold changes, whether the property now passes, and how the global bridge budget is affected.

### 4.2 Inputs

```ts
interface BridgeStackerUIProps {
  /** The unmodified required threshold computed by the rule engine (e.g., 90 ft). */
  baseThreshold: number;
  /** Unit label (e.g., "ft"). */
  unit: string;
  /** The observed value from the property (e.g., 50 ft). */
  actualValue: number;
  /** All available bridge mitigations for this vulnerability. */
  bridges: Array<{
    id: string;
    name: string;
    modifier: number;         // multiplier, e.g. 0.8 means "reduce by 20%"
    isSelected: boolean;
  }>;
  /** Callback when a bridge checkbox is toggled. */
  onToggleBridge: (bridgeId: string) => void;
  /** Current total bridge count across ALL vulnerabilities. */
  bridgesUsed: number;
  /** Global limit from Settings.bridge_mitigation_limit. */
  bridgeLimit: number;
}
```

### 4.3 Computation Logic (Local)

The component computes a `BridgeStackBreakdown` on every render:

```ts
function computeStackBreakdown(
  baseThreshold: number,
  selectedBridges: Array<{ name: string; modifier: number }>,
  actualValue: number
): BridgeStackBreakdown {
  let runningThreshold = baseThreshold;
  const breakdown: BridgeStackBreakdownItem[] = [];

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
    1
  );

  return {
    base_threshold: baseThreshold,
    bridge_modifier_product: bridgeModifierProduct,
    final_threshold: runningThreshold,
    actual_value: actualValue,
    passes: actualValue >= runningThreshold,
    breakdown,
  };
}
```

### 4.4 Visual Representation

The stacking visualization renders inside a `bg-blue-50 border-blue-200 rounded-md p-3` container (shown only when at least one bridge is selected). It has two parts:

#### 4.4.1 Step Calculation Table (Monospace)

```
  Base threshold                           90 ft
  x Apply Protective Film (x0.8)          72 ft
  x Prune Nearby Trees (x0.5)             36 ft
  ----------------------------------------
  = Final required threshold               36 ft
    Actual: 50 ft >= 36 ft                 PASS
```

Each row is a flex div with monospace font. The running threshold updates per step.

#### 4.4.2 Threshold Bar (Visual)

A horizontal bar showing the relationship between `actualValue` and `finalThreshold`:

```
[==================|========>            ]
0                 36ft      50ft         90ft
                  final     actual       base
```

Implementation using two overlaid divs:

```tsx
<div className="relative h-6 bg-gray-200 rounded-full overflow-hidden mt-3">
  {/* Base threshold marker */}
  <div
    className="absolute top-0 h-full border-r-2 border-dashed border-gray-400"
    style={{ left: `${(baseThreshold / maxScale) * 100}%` }}
  />
  {/* Final threshold zone (red if fail, green if pass) */}
  <div
    className={cn(
      "absolute top-0 h-full rounded-l-full transition-all duration-300",
      passes ? "bg-green-200" : "bg-red-200"
    )}
    style={{ width: `${(finalThreshold / maxScale) * 100}%` }}
  />
  {/* Actual value marker */}
  <div
    className={cn(
      "absolute top-0 h-full w-1 transition-colors duration-300",
      passes ? "bg-green-600" : "bg-red-600"
    )}
    style={{ left: `${(actualValue / maxScale) * 100}%` }}
  />
</div>
```

Where `maxScale = Math.max(baseThreshold, actualValue) * 1.1` for 10% padding.

### 4.5 Interaction Flow

1. **User toggles a bridge checkbox** on `BridgeMitigationItem`.
2. `onToggleMitigation` fires in `EvaluationResultsPage`, updating `selectedMitigations` state.
3. `BridgeStackerUI` receives updated `bridges[].isSelected` and recomputes `BridgeStackBreakdown`.
4. The threshold bar animates from old position to new (CSS `transition-all duration-300`).
5. The step calculation table updates instantly.
6. Pass/fail text and colors transition: `text-red-500` becomes `text-green-600` (or vice versa).
7. The global `bridgesUsed` count increments/decrements, and `BridgeBudgetBanner` updates.

### 4.6 Color Coding

| State | Threshold bar | Badge | Text |
|---|---|---|---|
| **Fail** (actual < final) | `bg-red-200` zone, `bg-red-600` marker | n/a | `text-red-600 font-bold` "FAIL" |
| **Pass** (actual >= final) | `bg-green-200` zone, `bg-green-600` marker | n/a | `text-green-600 font-bold` "PASS" |
| **Transition** | 300ms CSS transition on background-color and width | n/a | 300ms CSS transition on color |

### 4.7 Bridge Budget Enforcement

When `bridgesUsed >= bridgeLimit`:
- All unselected bridge checkboxes across all vulnerability cards become disabled (`opacity-50 cursor-not-allowed pointer-events-none`).
- `BridgeBudgetBanner` switches to red: "Bridge mitigation limit reached (3/3). No additional bridge mitigations can be selected."
- Already-selected bridges remain toggleable (deselecting frees a slot).

---

## 5. State Management

### 5.1 Server State (TanStack Query Cache)

| Query Key | Endpoint | Stale Time | Notes |
|---|---|---|---|
| `["evaluation", evaluationId]` | `GET /api/evaluations/:id` | `Infinity` | Evaluation results are immutable once created |
| `["evaluations"]` | `GET /api/evaluations` | 30s | History list, refetches on window focus |
| `["settings"]` | `GET /api/settings` | 5 min | For `bridge_mitigation_limit` |
| `["releases", "active"]` | `GET /api/releases/active` | 5 min | Active release tag displayed in header |

| Mutation Key | Endpoint | On Success |
|---|---|---|
| `["evaluate"]` | `POST /api/evaluations` | Sets query data for `["evaluation", newId]`; navigates to results page |
| `["submitMitigations"]` | `POST /api/evaluations/:id/mitigations` | Invalidates `["evaluation", id]` |
| `["login"]` | `POST /api/auth/login` | Stores token in AuthContext |

### 5.2 Local Component State

| Component | State | Type | Purpose |
|---|---|---|---|
| `ObservationForm` | form values | `UseFormReturn` | Controlled form state managed by React Hook Form |
| `ObservationForm` | `removingIndex` | `number \| null` | Drives vegetation item exit animation |
| `VulnerabilityCard` | `isExpanded` | `boolean` | Controls mitigation section collapse |
| `EvaluationResultsPage` | `selectedMitigations` | `Map<string, Set<string>>` | Tracks which mitigations are toggled on, keyed by rule_id |
| `EvaluationResultsPage` | `bridgesUsed` | `number` | Computed from `selectedMitigations` -- count of all bridge-category selections |

### 5.3 Context (React Context)

#### AuthContext

```ts
interface AuthContextValue {
  token: string | null;
  user: User | null;
  isAuthenticated: boolean;
  login: (token: string, user: User) => void;
  logout: () => void;
}
```

- Token persisted to `localStorage` under key `mre_auth_token`.
- On app mount, reads token from storage and validates with a lightweight `GET /api/auth/me` call.
- `logout()` clears token, clears React Query cache, redirects to `/login`.

### 5.4 Data Flow: Form Submission to Results Page

The data flows through navigation + React Query cache, not through React Context or prop drilling:

```
1. User fills ObservationForm and clicks "Evaluate Property"
        |
2. onSubmit transforms form values into EvaluateRequest
        |
3. useEvaluateMutation calls POST /api/evaluations
        |
4. Server returns EvaluationResult with evaluation_id
        |
5. Mutation onSuccess:
   a. queryClient.setQueryData(["evaluation", result.evaluation_id], result)
   b. navigate(`/evaluations/${result.evaluation_id}`)
        |
6. EvaluationResultsPage mounts, reads evaluationId from URL params
        |
7. useQuery(["evaluation", evaluationId]) returns cached data immediately
   (no loading spinner -- data was pre-seeded in step 5a)
        |
8. If user refreshes the page or navigates directly:
   useQuery fetches GET /api/evaluations/:id from server
```

This pattern ensures:
- No loading flash after form submission (data is pre-cached).
- Deep-linking to results works (falls back to server fetch).
- Browser back/forward works naturally.
- No global state pollution -- evaluation data lives in the query cache with a unique key.

### 5.5 Mitigation Selection State

Mitigation selections are **local state** on `EvaluationResultsPage` until the user clicks "Submit Mitigation Selections":

```ts
// EvaluationResultsPage
const [selectedMitigations, setSelectedMitigations] = useState<
  Map<string, Set<string>>
>(new Map());

const handleToggleMitigation = (
  ruleId: string,
  mitigationId: string,
  category: "full" | "bridge"
) => {
  setSelectedMitigations((prev) => {
    const next = new Map(prev);
    const ruleSet = new Set(next.get(ruleId) ?? []);

    if (ruleSet.has(mitigationId)) {
      ruleSet.delete(mitigationId);
    } else {
      // For full mitigations: selecting a full clears all bridges for that rule
      if (category === "full") {
        ruleSet.clear();
      }
      ruleSet.add(mitigationId);
    }

    if (ruleSet.size === 0) {
      next.delete(ruleId);
    } else {
      next.set(ruleId, ruleSet);
    }
    return next;
  });
};

// Derive bridge count
const bridgesUsed = useMemo(() => {
  let count = 0;
  for (const [ruleId, mitigationIds] of selectedMitigations) {
    const vuln = evaluation.vulnerabilities.find((v) => v.rule_id === ruleId);
    if (!vuln) continue;
    for (const mid of mitigationIds) {
      const mit = vuln.mitigations.find((m) => m.id === mid);
      if (mit?.category === "bridge") count++;
    }
  }
  return count;
}, [selectedMitigations, evaluation]);
```

On "Submit Mitigation Selections":

```ts
const selections: SelectMitigationsRequest["selections"] = [];
for (const [ruleId, mitigationIds] of selectedMitigations) {
  const vuln = evaluation.vulnerabilities.find((v) => v.rule_id === ruleId);
  if (!vuln) continue;
  for (const mid of mitigationIds) {
    const mit = vuln.mitigations.find((m) => m.id === mid);
    if (mit) {
      selections.push({
        rule_id: ruleId,
        mitigation_id: mid,
        category: mit.category,
      });
    }
  }
}
submitMitigationsMutation.mutate({ selections });
```

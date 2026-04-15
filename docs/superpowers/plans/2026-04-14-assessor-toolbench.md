# Assessor Toolbench Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a floating action button (FAB) that expands into a tabbed card panel consolidating all assessor/developer aids — scenario launchers, draggable test assets, and quick actions — replacing the scattered fixture controls currently in the AppShell header.

**Architecture:** A `<AssessorToolbench>` component rendered at the root level in `App.tsx`. It owns its own open/close and tab state (persisted to `sessionStorage`). It receives callbacks from the existing `single` and `batch` workflow hooks for scenario loading, mode switching, and state reset. The Assets tab constructs real `File` objects from static assets and injects them through the existing `DropZone` file-handling pipeline.

**Tech Stack:** React 19, TypeScript, Tailwind CSS (existing theme tokens), HTML5 Drag API, Vite static asset serving

**Spec:** `docs/superpowers/specs/2026-04-14-assessor-toolbench-design.md`

---

## File Structure

| File | Responsibility |
|------|----------------|
| `src/client/toolbench/toolbench-manifest.ts` | Static data: all label image and CSV asset metadata |
| `src/client/toolbench/useToolbenchState.ts` | Hook: open/close, active tab, sessionStorage persistence |
| `src/client/toolbench/useToolbenchDrag.ts` | Hook: fetch asset URL → Blob → File, drag data transfer |
| `src/client/toolbench/ToolbenchAssetThumbnail.tsx` | Single draggable/clickable asset card |
| `src/client/toolbench/ToolbenchScenarios.tsx` | Tab 1: single + batch scenario launcher buttons |
| `src/client/toolbench/ToolbenchAssets.tsx` | Tab 2: image grid + CSV section |
| `src/client/toolbench/ToolbenchActions.tsx` | Tab 3: quick action buttons |
| `src/client/toolbench/AssessorToolbench.tsx` | FAB + expanding card shell with tab switching |
| `public/toolbench/csv/clean-six.csv` | Sample clean 6-row batch CSV |
| `public/toolbench/csv/malformed.csv` | Sample CSV that triggers parse error |
| `src/client/App.tsx` (modify) | Mount `<AssessorToolbench>`, wire callbacks, remove `fixtureControlsEnabled` gating |
| `src/client/AppShell.tsx` (modify) | Remove ScenarioPicker, fixture controls, and related imports from header |

---

### Task 1: Asset manifest

**Files:**
- Create: `src/client/toolbench/toolbench-manifest.ts`

The static data layer. Lists every available test asset with metadata. No logic, just data.

- [ ] **Step 1: Create the manifest file**

```typescript
// src/client/toolbench/toolbench-manifest.ts

export interface ToolbenchImageAsset {
  id: string;
  name: string;
  description: string;
  filename: string;
  /** URL path served by Vite — evals assets are in the repo root, so we use absolute import paths resolved at build time */
  url: string;
}

export interface ToolbenchCsvAsset {
  id: string;
  name: string;
  description: string;
  filename: string;
  url: string;
}

/**
 * All 20 eval label images from evals/labels/assets/.
 * URLs point to /toolbench/labels/<filename> served from public/.
 */
export const LABEL_IMAGE_ASSETS: ToolbenchImageAsset[] = [
  { id: 'perfect-spirit-label', name: 'Perfect Spirit', description: 'Baseline happy path (distilled spirits)', filename: 'perfect-spirit-label.png', url: '/toolbench/labels/perfect-spirit-label.png' },
  { id: 'perfect-beer-label', name: 'Perfect Beer', description: 'Baseline happy path (malt beverage)', filename: 'perfect-beer-label.png', url: '/toolbench/labels/perfect-beer-label.png' },
  { id: 'spirit-warning-errors', name: 'Warning Errors', description: 'Government warning text defects', filename: 'spirit-warning-errors.png', url: '/toolbench/labels/spirit-warning-errors.png' },
  { id: 'spirit-brand-case-mismatch', name: 'Brand Mismatch', description: 'Applicant vs label casing difference', filename: 'spirit-brand-case-mismatch.png', url: '/toolbench/labels/spirit-brand-case-mismatch.png' },
  { id: 'wine-missing-appellation', name: 'Missing Appellation', description: 'Wine with blank appellation field', filename: 'wine-missing-appellation.png', url: '/toolbench/labels/wine-missing-appellation.png' },
  { id: 'beer-forbidden-abv-format', name: 'Forbidden ABV', description: 'Beer labeled "ABV" instead of "Alc./Vol."', filename: 'beer-forbidden-abv-format.png', url: '/toolbench/labels/beer-forbidden-abv-format.png' },
  { id: 'low-quality-image', name: 'Low Quality', description: 'Blurry / low-confidence extraction', filename: 'low-quality-image.png', url: '/toolbench/labels/low-quality-image.png' },
  { id: 'warning-completely-missing', name: 'Warning Missing', description: 'No government warning at all', filename: 'warning-completely-missing.png', url: '/toolbench/labels/warning-completely-missing.png' },
  { id: 'imported-without-country-of-origin', name: 'No Origin', description: 'Imported product without country of origin', filename: 'imported-without-country-of-origin.png', url: '/toolbench/labels/imported-without-country-of-origin.png' },
  { id: 'spirits-proof-not-parenthesized', name: 'Proof Format', description: 'Proof not in parentheses', filename: 'spirits-proof-not-parenthesized.png', url: '/toolbench/labels/spirits-proof-not-parenthesized.png' },
  { id: 'whisky-age-ambiguity', name: 'Age Ambiguity', description: 'Ambiguous age statement', filename: 'whisky-age-ambiguity.png', url: '/toolbench/labels/whisky-age-ambiguity.png' },
  { id: 'wine-multiple-varietals-invalid-total', name: 'Invalid Varietals', description: 'Varietal percentages don\'t total correctly', filename: 'wine-multiple-varietals-invalid-total.png', url: '/toolbench/labels/wine-multiple-varietals-invalid-total.png' },
  { id: 'wine-multiple-varietals-valid', name: 'Valid Varietals', description: 'Multiple varietals with correct totals', filename: 'wine-multiple-varietals-valid.png', url: '/toolbench/labels/wine-multiple-varietals-valid.png' },
  { id: 'wine-varietal-without-appellation', name: 'Varietal No Appellation', description: 'Varietal wine without required appellation', filename: 'wine-varietal-without-appellation.png', url: '/toolbench/labels/wine-varietal-without-appellation.png' },
  { id: 'wine-vintage-with-appellation', name: 'Vintage + Appellation', description: 'Vintage wine with appellation present', filename: 'wine-vintage-with-appellation.png', url: '/toolbench/labels/wine-vintage-with-appellation.png' },
  { id: 'wine-table-wine-exemption', name: 'Table Wine', description: 'Table wine exemption scenario', filename: 'wine-table-wine-exemption.png', url: '/toolbench/labels/wine-table-wine-exemption.png' },
  { id: 'spirits-abv-abbreviation', name: 'ABV Abbreviation', description: 'Spirits ABV abbreviation format', filename: 'spirits-abv-abbreviation.png', url: '/toolbench/labels/spirits-abv-abbreviation.png' },
  { id: 'spirits-net-contents-us-measures', name: 'Net Contents US', description: 'US measurement format for net contents', filename: 'spirits-net-contents-us-measures.png', url: '/toolbench/labels/spirits-net-contents-us-measures.png' },
  { id: 'beer-net-contents-metric-primary', name: 'Net Contents Metric', description: 'Metric-primary net contents format', filename: 'beer-net-contents-metric-primary.png', url: '/toolbench/labels/beer-net-contents-metric-primary.png' },
  { id: 'beer-unqualified-geographic-style', name: 'Geographic Style', description: 'Unqualified geographic style name', filename: 'beer-unqualified-geographic-style.png', url: '/toolbench/labels/beer-unqualified-geographic-style.png' },
];

export const CSV_ASSETS: ToolbenchCsvAsset[] = [
  { id: 'clean-six', name: 'Clean 6-Row', description: 'Valid CSV with 6 matching rows', filename: 'clean-six.csv', url: '/toolbench/csv/clean-six.csv' },
  { id: 'malformed', name: 'Malformed CSV', description: 'CSV that triggers a parse error', filename: 'malformed.csv', url: '/toolbench/csv/malformed.csv' },
];
```

- [ ] **Step 2: Commit**

```bash
git add src/client/toolbench/toolbench-manifest.ts
git commit -m "feat(TTB-000): add toolbench asset manifest"
```

---

### Task 2: Static test CSV files

**Files:**
- Create: `public/toolbench/csv/clean-six.csv`
- Create: `public/toolbench/csv/malformed.csv`

- [ ] **Step 1: Create the clean CSV**

```csv
filename,brand_name,class_type
perfect-spirit-label.png,Stone's Throw,Bourbon Whiskey
spirit-warning-errors.png,Stone's Throw,Bourbon Whiskey
spirit-brand-case-mismatch.png,Stone's Throw,Bourbon Whiskey
wine-missing-appellation.png,Chateau Margaux,Red Wine
beer-forbidden-abv-format.png,Golden Harvest,Lager
low-quality-image.png,Unknown Brand,Unknown
```

- [ ] **Step 2: Create the malformed CSV**

```csv
filename,brand_name,class_type
perfect-spirit-label.png,"Stone's Throw,Bourbon Whiskey
this line has no closing quote and wrong column count,extra,extra,extra
```

- [ ] **Step 3: Copy the 20 eval label images into public/toolbench/labels/**

```bash
mkdir -p public/toolbench/labels
cp evals/labels/assets/*.png public/toolbench/labels/
```

Note: These are ~13MB of PNGs. They must be in `public/` so Vite serves them as static assets at runtime. Add `public/toolbench/labels/` to `.gitignore` and add a build/bootstrap script step to copy them, OR commit them if the repo already tracks binary assets of this size. Check `evals/labels/assets/` — if those PNGs are already tracked in git, duplicating to `public/` is wasteful. In that case, use a Vite plugin or dev middleware to serve `evals/labels/assets/` at `/toolbench/labels/` instead. The simpler approach: add a `vite.config.ts` alias.

**Preferred approach — Vite server config:**

In `vite.config.ts`, add a dev server static middleware to serve `evals/labels/assets/` at `/toolbench/labels/`:

```typescript
// Add to vite.config.ts plugins or server config:
server: {
  proxy: {
    // ... existing proxy config
  },
  fs: {
    allow: ['..'] // allow serving files outside root if needed
  }
}
```

Or simpler — use a Vite plugin:

```typescript
// In vite.config.ts, add to plugins array:
{
  name: 'toolbench-labels',
  configureServer(server) {
    const { resolve } = require('path');
    const sirv = require('sirv');
    server.middlewares.use(
      '/toolbench/labels',
      sirv(resolve(__dirname, 'evals/labels/assets'), { dev: true })
    );
  }
}
```

Check the existing `vite.config.ts` to determine the cleanest integration. The CSV files in `public/toolbench/csv/` are tiny and should be committed directly.

- [ ] **Step 4: Commit**

```bash
git add public/toolbench/csv/ vite.config.ts
git commit -m "feat(TTB-000): add toolbench static CSV assets and label serving"
```

---

### Task 3: Toolbench state hook

**Files:**
- Create: `src/client/toolbench/useToolbenchState.ts`

Manages panel open/close and active tab with sessionStorage persistence.

- [ ] **Step 1: Create the hook**

```typescript
// src/client/toolbench/useToolbenchState.ts
import { useCallback, useEffect, useState } from 'react';

export type ToolbenchTab = 'scenarios' | 'assets' | 'actions';

const STORAGE_KEY = 'toolbench-state';

interface PersistedState {
  open: boolean;
  tab: ToolbenchTab;
}

function readPersistedState(): PersistedState {
  try {
    const raw = sessionStorage.getItem(STORAGE_KEY);
    if (!raw) return { open: false, tab: 'scenarios' };
    const parsed = JSON.parse(raw) as Partial<PersistedState>;
    return {
      open: typeof parsed.open === 'boolean' ? parsed.open : false,
      tab: parsed.tab === 'scenarios' || parsed.tab === 'assets' || parsed.tab === 'actions'
        ? parsed.tab
        : 'scenarios',
    };
  } catch {
    return { open: false, tab: 'scenarios' };
  }
}

export function useToolbenchState() {
  const [open, setOpen] = useState(() => readPersistedState().open);
  const [tab, setTab] = useState<ToolbenchTab>(() => readPersistedState().tab);

  useEffect(() => {
    sessionStorage.setItem(STORAGE_KEY, JSON.stringify({ open, tab }));
  }, [open, tab]);

  const toggle = useCallback(() => setOpen((prev) => !prev), []);
  const close = useCallback(() => setOpen(false), []);

  return { open, tab, setTab, toggle, close };
}
```

- [ ] **Step 2: Commit**

```bash
git add src/client/toolbench/useToolbenchState.ts
git commit -m "feat(TTB-000): add useToolbenchState hook"
```

---

### Task 4: Toolbench drag hook

**Files:**
- Create: `src/client/toolbench/useToolbenchDrag.ts`

Handles fetching static asset URLs, constructing File objects, and setting up drag transfer data.

- [ ] **Step 1: Create the hook**

```typescript
// src/client/toolbench/useToolbenchDrag.ts
import { useCallback, useRef } from 'react';
import type { DragEvent } from 'react';

/** MIME type used to identify toolbench drags vs regular file drops. */
export const TOOLBENCH_DRAG_MIME = 'application/x-toolbench-asset';

/**
 * Fetch a static asset URL and construct a File object from it.
 * Used by both drag-and-drop and click-to-load flows.
 */
export async function fetchAsFile(url: string, filename: string): Promise<File> {
  const response = await fetch(url);
  const blob = await response.blob();
  return new File([blob], filename, { type: blob.type });
}

export function useToolbenchDrag(assetUrl: string, filename: string) {
  const dragImageRef = useRef<HTMLElement | null>(null);

  const onDragStart = useCallback(
    (event: DragEvent<HTMLElement>) => {
      event.dataTransfer.setData(TOOLBENCH_DRAG_MIME, JSON.stringify({ url: assetUrl, filename }));
      event.dataTransfer.effectAllowed = 'copy';

      // Use the thumbnail element as the drag ghost if available
      if (dragImageRef.current) {
        event.dataTransfer.setDragImage(dragImageRef.current, 40, 40);
      }
    },
    [assetUrl, filename]
  );

  return { onDragStart, dragImageRef };
}
```

- [ ] **Step 2: Commit**

```bash
git add src/client/toolbench/useToolbenchDrag.ts
git commit -m "feat(TTB-000): add useToolbenchDrag hook"
```

---

### Task 5: Asset thumbnail component

**Files:**
- Create: `src/client/toolbench/ToolbenchAssetThumbnail.tsx`

Individual draggable/clickable asset card used in the Assets tab.

- [ ] **Step 1: Create the component**

```tsx
// src/client/toolbench/ToolbenchAssetThumbnail.tsx
import { useState } from 'react';
import { useToolbenchDrag, fetchAsFile } from './useToolbenchDrag';

interface ToolbenchAssetThumbnailProps {
  name: string;
  description: string;
  url: string;
  filename: string;
  /** Called with the constructed File when the user clicks the load button. */
  onLoad: (file: File) => void;
  kind: 'image' | 'csv';
}

export function ToolbenchAssetThumbnail({
  name,
  description,
  url,
  filename,
  onLoad,
  kind,
}: ToolbenchAssetThumbnailProps) {
  const { onDragStart, dragImageRef } = useToolbenchDrag(url, filename);
  const [loading, setLoading] = useState(false);

  const handleClick = async () => {
    setLoading(true);
    try {
      const file = await fetchAsFile(url, filename);
      onLoad(file);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div
      draggable
      onDragStart={onDragStart}
      className="group relative flex flex-col items-center gap-1 rounded border border-outline-variant/30 bg-surface-container-lowest p-1.5 cursor-grab active:cursor-grabbing hover:border-primary/40 transition-colors"
      title={description}
      aria-label={`${name} — drag to upload or click to load`}
    >
      {kind === 'image' ? (
        <img
          ref={dragImageRef as React.Ref<HTMLImageElement>}
          src={url}
          alt={name}
          className="h-16 w-full rounded-sm object-cover bg-surface-dim"
          loading="lazy"
        />
      ) : (
        <div
          ref={dragImageRef as React.Ref<HTMLDivElement>}
          className="flex h-16 w-full items-center justify-center rounded-sm bg-surface-dim"
        >
          <span className="material-symbols-outlined text-2xl text-on-surface-variant/50">
            csv
          </span>
        </div>
      )}

      <span className="text-[10px] font-label font-semibold text-on-surface leading-tight text-center line-clamp-1">
        {name}
      </span>

      <button
        type="button"
        onClick={handleClick}
        disabled={loading}
        className="absolute top-0.5 right-0.5 flex h-5 w-5 items-center justify-center rounded-full bg-primary/80 text-on-primary opacity-0 group-hover:opacity-100 transition-opacity focus-visible:opacity-100"
        aria-label={`Load ${name}`}
        title="Click to load"
      >
        <span className="material-symbols-outlined text-[12px]">
          {loading ? 'hourglass_empty' : 'download'}
        </span>
      </button>
    </div>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add src/client/toolbench/ToolbenchAssetThumbnail.tsx
git commit -m "feat(TTB-000): add ToolbenchAssetThumbnail component"
```

---

### Task 6: Scenarios tab

**Files:**
- Create: `src/client/toolbench/ToolbenchScenarios.tsx`

Tab 1: single review + batch scenario launcher buttons.

- [ ] **Step 1: Create the component**

```tsx
// src/client/toolbench/ToolbenchScenarios.tsx
import { seedScenarios, type SeedScenario } from '../scenarios';
import { SEED_BATCHES } from '../batchScenarios';

interface ToolbenchScenariosProps {
  activeScenarioId: string;
  activeBatchSeedId: string;
  onSelectScenario: (scenario: SeedScenario) => void;
  onSelectBatchSeed: (id: string) => void;
}

export function ToolbenchScenarios({
  activeScenarioId,
  activeBatchSeedId,
  onSelectScenario,
  onSelectBatchSeed,
}: ToolbenchScenariosProps) {
  return (
    <div className="flex flex-col gap-4 overflow-y-auto p-3">
      <section>
        <h3 className="font-label text-[10px] font-bold uppercase tracking-widest text-on-surface-variant mb-2">
          Single Review
        </h3>
        <div className="flex flex-col gap-1">
          {seedScenarios.map((scenario) => (
            <button
              key={scenario.id}
              type="button"
              onClick={() => onSelectScenario(scenario)}
              className={`flex flex-col items-start rounded px-2.5 py-1.5 text-left transition-colors ${
                activeScenarioId === scenario.id
                  ? 'bg-primary/10 text-primary'
                  : 'hover:bg-surface-container-high text-on-surface'
              }`}
            >
              <span className="text-xs font-body font-semibold leading-tight">
                {scenario.title}
              </span>
              <span className="text-[10px] font-body text-on-surface-variant leading-tight">
                {scenario.description}
              </span>
            </button>
          ))}
        </div>
      </section>

      <section>
        <h3 className="font-label text-[10px] font-bold uppercase tracking-widest text-on-surface-variant mb-2">
          Batch
        </h3>
        <div className="flex flex-col gap-1">
          {SEED_BATCHES.map((seed) => (
            <button
              key={seed.id}
              type="button"
              onClick={() => onSelectBatchSeed(seed.id)}
              className={`flex flex-col items-start rounded px-2.5 py-1.5 text-left transition-colors ${
                activeBatchSeedId === seed.id
                  ? 'bg-primary/10 text-primary'
                  : 'hover:bg-surface-container-high text-on-surface'
              }`}
            >
              <span className="text-xs font-body font-semibold leading-tight">
                {seed.label}
              </span>
              <span className="text-[10px] font-body text-on-surface-variant leading-tight">
                {seed.description}
              </span>
            </button>
          ))}
        </div>
      </section>
    </div>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add src/client/toolbench/ToolbenchScenarios.tsx
git commit -m "feat(TTB-000): add ToolbenchScenarios tab component"
```

---

### Task 7: Assets tab

**Files:**
- Create: `src/client/toolbench/ToolbenchAssets.tsx`

Tab 2: draggable image thumbnail grid + CSV section.

- [ ] **Step 1: Create the component**

```tsx
// src/client/toolbench/ToolbenchAssets.tsx
import { LABEL_IMAGE_ASSETS, CSV_ASSETS } from './toolbench-manifest';
import { ToolbenchAssetThumbnail } from './ToolbenchAssetThumbnail';

interface ToolbenchAssetsProps {
  /** Called when an image asset is loaded (via click). */
  onLoadImage: (file: File) => void;
  /** Called when a CSV asset is loaded (via click). */
  onLoadCsv: (file: File) => void;
}

export function ToolbenchAssets({ onLoadImage, onLoadCsv }: ToolbenchAssetsProps) {
  return (
    <div className="flex flex-col gap-4 overflow-y-auto p-3">
      <section>
        <h3 className="font-label text-[10px] font-bold uppercase tracking-widest text-on-surface-variant mb-2">
          Label Images
        </h3>
        <p className="text-[10px] font-body text-on-surface-variant/70 mb-2">
          Drag onto a drop zone or click the arrow to load directly.
        </p>
        <div className="grid grid-cols-3 gap-1.5">
          {LABEL_IMAGE_ASSETS.map((asset) => (
            <ToolbenchAssetThumbnail
              key={asset.id}
              name={asset.name}
              description={asset.description}
              url={asset.url}
              filename={asset.filename}
              onLoad={onLoadImage}
              kind="image"
            />
          ))}
        </div>
      </section>

      <section>
        <h3 className="font-label text-[10px] font-bold uppercase tracking-widest text-on-surface-variant mb-2">
          CSV Files
        </h3>
        <div className="flex flex-col gap-1.5">
          {CSV_ASSETS.map((asset) => (
            <ToolbenchAssetThumbnail
              key={asset.id}
              name={asset.name}
              description={asset.description}
              url={asset.url}
              filename={asset.filename}
              onLoad={onLoadCsv}
              kind="csv"
            />
          ))}
        </div>
      </section>
    </div>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add src/client/toolbench/ToolbenchAssets.tsx
git commit -m "feat(TTB-000): add ToolbenchAssets tab component"
```

---

### Task 8: Quick Actions tab

**Files:**
- Create: `src/client/toolbench/ToolbenchActions.tsx`

Tab 3: utility shortcuts.

- [ ] **Step 1: Create the component**

```tsx
// src/client/toolbench/ToolbenchActions.tsx
import { useState } from 'react';
import type { Mode, ExtractionMode } from '../appTypes';

interface ToolbenchActionsProps {
  mode: Mode;
  extractionMode: ExtractionMode;
  onReset: () => void;
  onSwitchMode: (next: Mode) => void;
  onToggleExtraction: (next: ExtractionMode) => void;
  onLaunchTour: () => void;
}

export function ToolbenchActions({
  mode,
  extractionMode,
  onReset,
  onSwitchMode,
  onToggleExtraction,
  onLaunchTour,
}: ToolbenchActionsProps) {
  const [healthStatus, setHealthStatus] = useState<string | null>(null);
  const [healthLoading, setHealthLoading] = useState(false);

  const checkHealth = async () => {
    setHealthLoading(true);
    setHealthStatus(null);
    try {
      const res = await fetch('/api/health');
      const data = await res.json();
      setHealthStatus(JSON.stringify(data, null, 2));
    } catch (err) {
      setHealthStatus(`Error: ${err instanceof Error ? err.message : 'Unknown error'}`);
    } finally {
      setHealthLoading(false);
    }
  };

  const altMode: Mode = mode === 'single' ? 'batch' : 'single';
  const altExtraction: ExtractionMode = extractionMode === 'cloud' ? 'local' : 'cloud';

  return (
    <div className="flex flex-col gap-2 overflow-y-auto p-3">
      <h3 className="font-label text-[10px] font-bold uppercase tracking-widest text-on-surface-variant mb-1">
        Quick Actions
      </h3>

      <ActionButton icon="restart_alt" label="Reset app" onClick={onReset} />
      <ActionButton
        icon={altMode === 'batch' ? 'view_list' : 'draft'}
        label={`Switch to ${altMode}`}
        onClick={() => onSwitchMode(altMode)}
      />
      <ActionButton
        icon={altExtraction === 'cloud' ? 'cloud' : 'hard_drive'}
        label={`Switch to ${altExtraction} extraction`}
        onClick={() => onToggleExtraction(altExtraction)}
      />
      <ActionButton icon="help" label="Open help tour" onClick={onLaunchTour} />
      <ActionButton
        icon="monitor_heart"
        label="Check API health"
        onClick={checkHealth}
        loading={healthLoading}
      />

      {healthStatus !== null ? (
        <pre className="mt-1 rounded bg-surface-dim p-2 text-[10px] font-mono text-on-surface whitespace-pre-wrap max-h-32 overflow-y-auto">
          {healthStatus}
        </pre>
      ) : null}
    </div>
  );
}

function ActionButton({
  icon,
  label,
  onClick,
  loading,
}: {
  icon: string;
  label: string;
  onClick: () => void;
  loading?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={loading}
      className="flex items-center gap-2.5 rounded px-2.5 py-2 text-left text-xs font-body font-semibold text-on-surface hover:bg-surface-container-high transition-colors disabled:opacity-50"
    >
      <span className="material-symbols-outlined text-[16px] text-on-surface-variant">
        {loading ? 'hourglass_empty' : icon}
      </span>
      {label}
    </button>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add src/client/toolbench/ToolbenchActions.tsx
git commit -m "feat(TTB-000): add ToolbenchActions tab component"
```

---

### Task 9: Main AssessorToolbench shell

**Files:**
- Create: `src/client/toolbench/AssessorToolbench.tsx`

The FAB button and expanding card shell with tab switching, keyboard handling, and Escape-to-close.

- [ ] **Step 1: Create the component**

```tsx
// src/client/toolbench/AssessorToolbench.tsx
import { useEffect, useRef } from 'react';
import { useToolbenchState, type ToolbenchTab } from './useToolbenchState';
import { ToolbenchScenarios } from './ToolbenchScenarios';
import { ToolbenchAssets } from './ToolbenchAssets';
import { ToolbenchActions } from './ToolbenchActions';
import type { SeedScenario } from '../scenarios';
import type { Mode, ExtractionMode } from '../appTypes';

const TABS: { id: ToolbenchTab; label: string }[] = [
  { id: 'scenarios', label: 'Scenarios' },
  { id: 'assets', label: 'Assets' },
  { id: 'actions', label: 'Actions' },
];

interface AssessorToolbenchProps {
  /* Scenario state */
  activeScenarioId: string;
  activeBatchSeedId: string;
  onSelectScenario: (scenario: SeedScenario) => void;
  onSelectBatchSeed: (id: string) => void;

  /* Asset loading */
  onLoadImage: (file: File) => void;
  onLoadCsv: (file: File) => void;

  /* Quick actions */
  mode: Mode;
  extractionMode: ExtractionMode;
  onReset: () => void;
  onSwitchMode: (next: Mode) => void;
  onToggleExtraction: (next: ExtractionMode) => void;
  onLaunchTour: () => void;
}

export function AssessorToolbench(props: AssessorToolbenchProps) {
  const { open, tab, setTab, toggle, close } = useToolbenchState();
  const panelRef = useRef<HTMLDivElement>(null);

  /* Escape to close */
  useEffect(() => {
    if (!open) return;
    const handler = (event: KeyboardEvent) => {
      if (event.key === 'Escape') close();
    };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, [open, close]);

  /* Click outside to close */
  useEffect(() => {
    if (!open) return;
    const handler = (event: MouseEvent) => {
      if (panelRef.current && !panelRef.current.contains(event.target as Node)) {
        close();
      }
    };
    // Delay to avoid closing on the same click that opened
    const id = setTimeout(() => document.addEventListener('mousedown', handler), 0);
    return () => {
      clearTimeout(id);
      document.removeEventListener('mousedown', handler);
    };
  }, [open, close]);

  return (
    <div ref={panelRef} className="fixed bottom-4 right-4 z-40 flex flex-col items-end gap-2">
      {/* Expanded panel */}
      {open ? (
        <div
          className="flex flex-col w-[400px] max-h-[520px] rounded-xl border border-dashed border-outline-variant/60 bg-surface-container shadow-ambient overflow-hidden animate-in fade-in slide-in-from-bottom-2 duration-150"
          role="dialog"
          aria-label="Assessor Toolbench"
        >
          {/* Header */}
          <div className="flex items-center justify-between border-b border-outline-variant/30 px-3 py-2">
            <span className="font-label text-xs font-bold uppercase tracking-widest text-on-surface-variant">
              Assessor Toolbench
            </span>
            <button
              type="button"
              onClick={close}
              className="flex h-6 w-6 items-center justify-center rounded-full hover:bg-surface-container-high transition-colors"
              aria-label="Close toolbench"
            >
              <span className="material-symbols-outlined text-[16px] text-on-surface-variant">
                close
              </span>
            </button>
          </div>

          {/* Tabs */}
          <div className="flex border-b border-outline-variant/30" role="tablist">
            {TABS.map((t) => (
              <button
                key={t.id}
                type="button"
                role="tab"
                aria-selected={tab === t.id}
                onClick={() => setTab(t.id)}
                className={`flex-1 px-2 py-1.5 text-center text-[11px] font-label font-bold uppercase tracking-wider transition-colors ${
                  tab === t.id
                    ? 'text-primary border-b-2 border-primary'
                    : 'text-on-surface-variant hover:text-on-surface'
                }`}
              >
                {t.label}
              </button>
            ))}
          </div>

          {/* Tab content */}
          <div className="flex-1 min-h-0 overflow-hidden" role="tabpanel">
            {tab === 'scenarios' ? (
              <ToolbenchScenarios
                activeScenarioId={props.activeScenarioId}
                activeBatchSeedId={props.activeBatchSeedId}
                onSelectScenario={props.onSelectScenario}
                onSelectBatchSeed={props.onSelectBatchSeed}
              />
            ) : tab === 'assets' ? (
              <ToolbenchAssets
                onLoadImage={props.onLoadImage}
                onLoadCsv={props.onLoadCsv}
              />
            ) : (
              <ToolbenchActions
                mode={props.mode}
                extractionMode={props.extractionMode}
                onReset={props.onReset}
                onSwitchMode={props.onSwitchMode}
                onToggleExtraction={props.onToggleExtraction}
                onLaunchTour={props.onLaunchTour}
              />
            )}
          </div>
        </div>
      ) : null}

      {/* FAB */}
      <button
        type="button"
        onClick={toggle}
        className={`flex items-center gap-2 rounded-full border border-dashed px-4 py-2.5 font-label text-xs font-bold uppercase tracking-widest shadow-ambient transition-all ${
          open
            ? 'border-primary/50 bg-primary/10 text-primary'
            : 'border-outline-variant/60 bg-surface-container text-on-surface-variant hover:border-primary/40 hover:text-primary'
        }`}
        aria-label={open ? 'Close assessor toolbench' : 'Open assessor toolbench'}
        aria-expanded={open}
      >
        <span className="material-symbols-outlined text-[18px]">
          {open ? 'close' : 'science'}
        </span>
        Toolbench
      </button>
    </div>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add src/client/toolbench/AssessorToolbench.tsx
git commit -m "feat(TTB-000): add AssessorToolbench shell with FAB and tabs"
```

---

### Task 10: Integrate into App.tsx and wire callbacks

**Files:**
- Modify: `src/client/App.tsx`

Mount `<AssessorToolbench>` at the root level and wire all callbacks from existing hooks.

- [ ] **Step 1: Add imports**

At the top of `App.tsx`, add:

```typescript
import { AssessorToolbench } from './toolbench/AssessorToolbench';
import { fetchAsFile } from './toolbench/useToolbenchDrag';
```

- [ ] **Step 2: Add asset-loading callbacks**

Inside the `App` function, before the return statement, add callbacks for asset loading:

```typescript
const handleToolbenchLoadImage = useCallback(async (file: File) => {
  const previewUrl = URL.createObjectURL(file);
  const sizeLabel =
    file.size < 1024 * 1024
      ? `${(file.size / 1024).toFixed(0)} KB`
      : `${(file.size / (1024 * 1024)).toFixed(1)} MB`;
  single.onImageChange({ file, previewUrl, sizeLabel });
  if (view !== 'intake') setView('intake');
  if (mode !== 'single') setMode('single');
}, [single, view, mode, setView, setMode]);

const handleToolbenchLoadCsv = useCallback(async (file: File) => {
  batch.onSelectLiveCsv(file);
  if (mode !== 'batch') setMode('batch');
  if (view !== 'batch-intake') setView('batch-intake');
}, [batch, mode, view, setMode, setView]);

const handleToolbenchReset = useCallback(() => {
  single.reset();
  batch.reset();
  setView('intake');
  setMode('single');
}, [single, batch, setView, setMode]);

const handleToolbenchSwitchMode = useCallback((next: Mode) => {
  setMode(next);
  setView(next === 'single' ? 'intake' : 'batch-intake');
}, [setMode, setView]);
```

- [ ] **Step 3: Mount AssessorToolbench after AppShell**

In the return statement, add `<AssessorToolbench>` as a sibling after `<AppShell>`, wrapped in the same auth-gated fragment:

```tsx
<AssessorToolbench
  activeScenarioId={single.scenarioId}
  activeBatchSeedId={batch.batchSeedId}
  onSelectScenario={single.onSelectScenario}
  onSelectBatchSeed={batch.onSelectBatchSeed}
  onLoadImage={handleToolbenchLoadImage}
  onLoadCsv={handleToolbenchLoadCsv}
  mode={mode}
  extractionMode={extractionMode}
  onReset={handleToolbenchReset}
  onSwitchMode={handleToolbenchSwitchMode}
  onToggleExtraction={(next) => setExtractionMode(next)}
  onLaunchTour={help.onLaunchTour}
/>
```

- [ ] **Step 4: Commit**

```bash
git add src/client/App.tsx
git commit -m "feat(TTB-000): mount AssessorToolbench in App and wire callbacks"
```

---

### Task 11: Remove fixture controls from AppShell header

**Files:**
- Modify: `src/client/AppShell.tsx`

Remove the ScenarioPicker, variant override, force failure, batch scenario picker, stream variant picker, and dashboard seed picker from the header. Keep the ExtractionModeSelector (it stays in the header, separate from the toolbench), HelpLauncher, and SignedInIdentity.

- [ ] **Step 1: Remove ScenarioPicker import**

Remove the import:
```typescript
import { ScenarioPicker } from './ScenarioPicker';
```

And remove the `SEED_BATCHES`, `STREAM_SEEDS` imports from `./batchScenarios` (only if no other reference remains in this file).

And remove the `DASHBOARD_SEEDS` import from `./batchDashboardScenarios`.

- [ ] **Step 2: Remove fixture controls block from header**

In `AppShell.tsx`, the fixture controls live at approximately lines 151–234. Replace the entire conditional block:

```tsx
{mode === 'single' ? (
  fixtureControlsEnabled ? (
    <>
      <ScenarioPicker ... />
      <label>Result variant ...</label>
      <label>Force failure ...</label>
    </>
  ) : null
) : fixtureControlsEnabled ? (
  <>
    <label>Batch scenario ...</label>
    {view === 'batch-processing' ? <label>Stream variant ...</label> : null}
    {view === 'batch-dashboard' || view === 'batch-result' ? <label>Dashboard seed ...</label> : null}
  </>
) : null}
```

With nothing. Just remove the block entirely. The ExtractionModeSelector on line 146-150 stays.

- [ ] **Step 3: Remove `fixtureControlsEnabled` prop**

Remove `fixtureControlsEnabled` from the `AppShellProps` interface and destructuring. If it's still used in the batch upload section (lines ~298-302 where it gates `interactive` and `onSelectImages`/`onSelectCsv`), change those to always be interactive:

```tsx
<BatchUpload
  // ...
  interactive={true}
  onSelectImages={batch.onSelectLiveImages}
  onSelectCsv={batch.onSelectLiveCsv}
  // ...
/>
```

Since the toolbench is always present, the batch upload zones should always accept live drops too.

- [ ] **Step 4: Update App.tsx to stop passing `fixtureControlsEnabled` to AppShell**

Remove the `fixtureControlsEnabled={fixtureControlsEnabled}` prop from the `<AppShell>` render in `App.tsx`.

Also remove the `fixtureControlsEnabled` variable and `fixturesEnabled` import from `App.tsx` if nothing else uses it. Check if `useSingleReviewFlow` and `useBatchWorkflow` still need it — if they only used it for initial seed state, change them to always seed (since the toolbench is always present).

- [ ] **Step 5: Commit**

```bash
git add src/client/AppShell.tsx src/client/App.tsx
git commit -m "refactor(TTB-000): remove fixture controls from AppShell header"
```

---

### Task 12: Extend DropZone for toolbench drag support

**Files:**
- Modify: `src/client/useFileDropInput.ts`

Extend the `onDrop` handler to recognize the toolbench custom MIME type and fetch the asset as a File.

- [ ] **Step 1: Add toolbench drag handling to useFileDropInput**

Update the `onDrop` handler in `useFileDropInput.ts`:

```typescript
import { TOOLBENCH_DRAG_MIME, fetchAsFile } from './toolbench/useToolbenchDrag';

// Replace the existing onDrop with:
const onDrop = (event: DragEvent<HTMLElement>) => {
  event.preventDefault();
  if (options.trackDragState) {
    setIsDragOver(false);
  }

  if (!options.interactive) {
    return;
  }

  // Check for toolbench asset drag
  const toolbenchData = event.dataTransfer.getData(TOOLBENCH_DRAG_MIME);
  if (toolbenchData) {
    try {
      const { url, filename } = JSON.parse(toolbenchData) as { url: string; filename: string };
      fetchAsFile(url, filename).then((file) => {
        emitSelectedFiles([file]);
      });
    } catch {
      // Ignore malformed drag data
    }
    return;
  }

  // Normal file drop
  emitSelectedFiles(Array.from(event.dataTransfer.files));
};
```

- [ ] **Step 2: Also allow toolbench drags in onDragOver**

The existing `onDragOver` already calls `event.preventDefault()` which signals drop acceptance. No change needed — the browser will allow the drop as long as `preventDefault` is called.

- [ ] **Step 3: Commit**

```bash
git add src/client/useFileDropInput.ts
git commit -m "feat(TTB-000): extend useFileDropInput to accept toolbench drag assets"
```

---

### Task 13: Delete ScenarioPicker.tsx

**Files:**
- Delete: `src/client/ScenarioPicker.tsx`

- [ ] **Step 1: Verify no remaining imports**

```bash
grep -r "ScenarioPicker" src/client/ --include="*.ts" --include="*.tsx"
```

Expected: no results (after Task 11 removed the import from AppShell).

- [ ] **Step 2: Delete the file**

```bash
git rm src/client/ScenarioPicker.tsx
git commit -m "refactor(TTB-000): remove ScenarioPicker — replaced by AssessorToolbench"
```

---

### Task 14: Smoke test and typecheck

**Files:** None (validation only)

- [ ] **Step 1: Run typecheck**

```bash
npm run typecheck
```

Expected: clean exit with no errors. Fix any type issues surfaced by the integration.

- [ ] **Step 2: Run existing tests**

```bash
npm test
```

Expected: all existing tests pass. If any tests import `ScenarioPicker` or assert on fixture controls in the header, update them.

- [ ] **Step 3: Run dev server and verify visually**

```bash
npm run dev
```

Open the app in a browser. Verify:
- The FAB appears in the bottom-right corner
- Clicking it expands the card panel
- Scenarios tab shows 7 single + 8 batch scenarios
- Clicking a scenario loads it
- Assets tab shows 20 image thumbnails in a 3-column grid
- Dragging a thumbnail onto the DropZone loads the image
- Clicking the load button on a thumbnail loads the image
- Quick Actions tab buttons work (reset, switch mode, toggle extraction, health check, help tour)
- Escape closes the panel
- The header no longer shows the old ScenarioPicker or fixture control dropdowns
- The ExtractionModeSelector still appears in the header

- [ ] **Step 4: Commit any fixes**

```bash
git add -u
git commit -m "fix(TTB-000): address typecheck and test issues from toolbench integration"
```

# Bundle Optimization Guide

## Overview

This project implements aggressive bundle size optimization using Vite's code-splitting and lazy loading.

## Current Optimizations

### 1. Code Splitting (vite.config.ts)
- **React vendor chunk**: Core React libraries
- **Query vendor chunk**: TanStack Query
- **UI vendor chunk**: Radix UI components  
- **Chart vendor chunk**: Recharts + date-fns

### 2. Dynamic Imports (App.tsx + lazy-components.ts)
All heavy, non-critical components are lazy-loaded:
- Settings dialogs and tabs
- Project modals and wizards
- Deployment components
- Database provisioning UI
- Documentation panels
- Command palette

### 3. Bundle Analysis

Run analysis:
```bash
ANALYZE=true npm run build
```

View report: `frontend/dist/stats.html`

Or use the script:
```bash
chmod +x scripts/analyze-bundle.sh
./scripts/analyze-bundle.sh
```

## Performance Budgets

Defined in `scripts/check-bundle-budget.js`:

- **Main bundle**: 300 KB
- **Vendor bundle**: 500 KB  
- **Total**: 800 KB

## CI Integration

The `.github/workflows/bundle-budget.yml` workflow:
1. Builds on PRs touching frontend code
2. Compares against baseline (`.baseline-bundle-sizes.json`)
3. Fails if bundle size regresses >10%
4. Posts PR comment with size comparison

## Creating Baseline

First time setup:
```bash
cd frontend
ANALYZE=true npm run build
node ../scripts/check-bundle-budget.js
```

This creates `.baseline-bundle-sizes.json` automatically.

## Adding New Components

When adding large components:

1. **Check if critical for initial render**
   - If NO: Add to `lazy-components.ts`
   - If YES: Keep as direct import

2. **Update lazy-components.ts**:
```typescript
export const LazyNewComponent = lazy(() =>
  import("@/components/NewComponent").then(m => ({ default: m.NewComponent }))
);
```

3. **Use in App.tsx with Suspense**:
```tsx
<Suspense fallback={<Skeleton />}>
  <LazyNewComponent />
</Suspense>
```

## Avoiding Regressions

- ❌ Don't import heavy libraries in eagerly-loaded components
- ❌ Avoid barrel exports that break tree-shaking
- ✅ Use named imports from specific paths
- ✅ Check bundle analyzer after adding dependencies
- ✅ Keep dashboard and critical path lean

## Measuring Impact

Compare before/after:
```bash
# Before optimization
npm run build
du -sh frontend/dist/assets

# After optimization  
ANALYZE=true npm run build
open frontend/dist/stats.html
```

## Expected Results

Target: **15-30% reduction** in initial JS bundle size through:
- Deferred loading of 10+ heavy components
- Vendor chunk splitting
- Tree-shaking optimization

## Troubleshooting

**Stats.html not generated?**
- Ensure `ANALYZE=true` is set
- Check that `rollup-plugin-visualizer` is installed

**Bundle budget failing?**
- Review `dist/stats.html` for largest modules
- Consider lazy-loading additional components
- Update budget in `check-bundle-budget.js` if justified

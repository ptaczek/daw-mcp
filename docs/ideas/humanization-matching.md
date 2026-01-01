# Humanization Matching

## Problem

When generating new MIDI notes to complement an existing humanized clip, the new notes sound mechanical if placed exactly on grid. We need a way to match the "feel" of the original performance.

## Current State

`get_clip_stats` returns:
```json
{
  "detectedGrid": {
    "resolution": 16,
    "confidence": 0.839
  }
}
```

The confidence score indicates average alignment to the detected grid, but doesn't capture enough detail to replicate the humanization.

## Proposed Enhancement

Extend `detectedGrid` with timing distribution statistics:

```json
{
  "resolution": 16,
  "confidence": 0.839,
  "timing": {
    "meanError": 0.02,      // average deviation in beats (signed or absolute)
    "stdDev": 0.015,        // standard deviation of deviations
    "maxError": 0.045,      // maximum observed deviation
    "bias": -0.005          // tendency to play ahead/behind beat (negative = ahead)
  }
}
```

## Usage

When generating new notes to match existing humanization:

```typescript
function humanize(quantizedX: number, timing: TimingStats): number {
  // Apply gaussian-distributed error matching the original feel
  const error = gaussianRandom(timing.meanError, timing.stdDev);
  // Clamp to reasonable range
  const clampedError = Math.max(-timing.maxError, Math.min(timing.maxError, error));
  return quantizedX + clampedError + timing.bias;
}
```

## Benefits

- New notes blend naturally with existing humanized content
- Preserves the performer's timing characteristics
- Works for any style (tight vs loose, ahead vs behind beat)

## Implementation Notes

- Calculate timing stats in `detectGridResolution()` function
- Store per-note errors during detection loop
- Compute mean, stdDev, max from error array
- Bias = mean of signed errors (positive = late, negative = early)

## Related

- `mcp-server/src/handlers/analysis.ts` - grid detection logic
- Potential future tool: `humanize_notes` that applies these stats to quantized input

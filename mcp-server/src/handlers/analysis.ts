/**
 * Analysis handlers: get_clip_stats
 */

import { HandlerContext, ToolResult, successResult, errorResult } from './types.js';
import { selectClipIfNeeded } from '../helpers/index.js';
import { analyzeMusic, MusicAnalysis } from '../music-analysis.js';
import { getStepSize } from '../config.js';

/** Grid detection result */
interface GridDetection {
  resolution: number;   // detected grid resolution (e.g., 16 for 1/16th notes)
  confidence: number;   // 0-1, how well notes align (1 = perfect, lower = humanized)
}

/** Clip statistics result */
export interface ClipStats {
  noteCount: number;
  pitchRange: { min: number; max: number; span: number } | null;
  pitchClasses: number[];
  velocityRange: { min: number; max: number; avg: number } | null;
  durationRange: { min: number; max: number } | null;
  lengthBeats: number;
  gridResolution: number;           // configured resolution (e.g., 16 for 1/16th notes)
  detectedGrid: GridDetection;      // detected grid with confidence score
  stepSize: number;                 // e.g., 0.25 for 1/16th notes
  density: number;                  // filled grid cells / total grid cells (0-1)
  beatGrid: number[];               // 1 = note in cell, 0 = empty (at gridResolution)
  analysis: MusicAnalysis | null;
}

/**
 * Detect the coarsest grid resolution that notes align to, with confidence score.
 * Uses average deviation from nearest grid points to determine fit.
 * Returns the coarsest grid where confidence >= threshold.
 */
function detectGridResolution(notes: Array<{ x: number }>): GridDetection {
  if (notes.length === 0) return { resolution: 16, confidence: 1 };

  const positions = notes.map(n => n.x);
  const resolutions = [4, 8, 16, 32, 64];
  const confidenceThreshold = 0.7; // Accept grid if 70%+ confidence

  for (const resolution of resolutions) {
    const stepSize = 4 / resolution;

    // Calculate average normalized error (0 = perfect, 0.5 = max possible)
    let totalNormalizedError = 0;
    for (const pos of positions) {
      const nearestStep = Math.round(pos / stepSize) * stepSize;
      const error = Math.abs(pos - nearestStep);
      totalNormalizedError += error / stepSize; // normalize to step size
    }
    const avgNormalizedError = totalNormalizedError / positions.length;

    // Confidence: 1.0 = perfect, 0.0 = notes exactly between grid lines
    // avgNormalizedError ranges from 0 (perfect) to 0.5 (worst case)
    const confidence = Math.round((1 - avgNormalizedError * 2) * 1000) / 1000;

    if (confidence >= confidenceThreshold) {
      return { resolution, confidence };
    }
  }

  // Fallback: return finest grid with its confidence
  const stepSize = 4 / 64;
  let totalNormalizedError = 0;
  for (const pos of positions) {
    const nearestStep = Math.round(pos / stepSize) * stepSize;
    const error = Math.abs(pos - nearestStep);
    totalNormalizedError += error / stepSize;
  }
  const avgNormalizedError = totalNormalizedError / positions.length;
  const confidence = Math.max(0, Math.round((1 - avgNormalizedError * 2) * 1000) / 1000);

  return { resolution: 64, confidence };
}

/** Compute statistics for a clip's notes */
export function computeClipStats(
  notes: Array<{ x: number; y: number; velocity: number; duration: number }>,
  clipLengthBeats: number,
  stepSize: number
): ClipStats {
  const gridResolution = 4 / stepSize;  // e.g., stepSize=0.25 -> resolution=16
  const gridSlots = Math.ceil(clipLengthBeats / stepSize);

  if (notes.length === 0) {
    return {
      noteCount: 0,
      pitchRange: null,
      pitchClasses: [],
      velocityRange: null,
      durationRange: null,
      lengthBeats: clipLengthBeats,
      gridResolution,
      detectedGrid: { resolution: gridResolution, confidence: 1 },
      stepSize,
      density: 0,
      beatGrid: new Array(gridSlots).fill(0),
      analysis: null
    };
  }

  // Pitch range and classes
  const pitches = notes.map(n => n.y);
  const minPitch = Math.min(...pitches);
  const maxPitch = Math.max(...pitches);
  const pitchClassSet = new Set(pitches.map(p => p % 12));
  const pitchClasses = Array.from(pitchClassSet).sort((a, b) => a - b);

  // Velocity range (notes have velocity as 0-1, convert to 0-127)
  const velocities = notes.map(n => Math.round(n.velocity * 127));
  const minVel = Math.min(...velocities);
  const maxVel = Math.max(...velocities);
  const avgVel = Math.round(velocities.reduce((a, b) => a + b, 0) / velocities.length);

  // Duration range
  const durations = notes.map(n => n.duration);
  const minDur = Math.min(...durations);
  const maxDur = Math.max(...durations);

  // Beat grid at configured resolution (1 = note starts in this cell, 0 = empty)
  const beatGrid = new Array(gridSlots).fill(0);
  for (const note of notes) {
    const cellIndex = Math.floor(note.x / stepSize);
    if (cellIndex >= 0 && cellIndex < gridSlots) {
      beatGrid[cellIndex] = 1;
    }
  }

  // Density = ratio of filled cells to total cells (0.0 to 1.0)
  const filledCells = beatGrid.filter(x => x === 1).length;
  const density = Math.round((filledCells / gridSlots) * 1000) / 1000;

  // Music analysis (chord/scale detection)
  const analysis = analyzeMusic(notes, pitchClasses);

  // Detect actual grid resolution used by notes
  const detectedGrid = detectGridResolution(notes);

  return {
    noteCount: notes.length,
    pitchRange: { min: minPitch, max: maxPitch, span: maxPitch - minPitch },
    pitchClasses,
    velocityRange: { min: minVel, max: maxVel, avg: avgVel },
    durationRange: { min: Math.round(minDur * 100) / 100, max: Math.round(maxDur * 100) / 100 },
    lengthBeats: clipLengthBeats,
    gridResolution,
    detectedGrid,
    stepSize,
    density,
    beatGrid,
    analysis
  };
}

/** Handle get_clip_stats */
export async function handleGetClipStats(ctx: HandlerContext): Promise<ToolResult> {
  const { dawManager, config, daw, args } = ctx;

  try {
    await selectClipIfNeeded(dawManager, config, daw, args);

    // Get notes from clip
    const notesResult = await dawManager.send('clip.getNotes', {}, daw) as {
      notes: Array<{ x: number; y: number; velocity: number; duration: number }>;
      clipLength?: number;
    };
    const notes = notesResult.notes || [];

    // Get clip length (default to 4 beats if not available)
    const clipLength = notesResult.clipLength ?? 4;

    // Get step size from config (global gridResolution)
    const stepSize = getStepSize(config);

    // Compute stats
    const stats = computeClipStats(notes, clipLength, stepSize);

    return successResult(stats);
  } catch (error) {
    return errorResult(error instanceof Error ? error.message : String(error));
  }
}

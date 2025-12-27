/**
 * Clip statistics handler.
 */

import { HandlerContext, BatchResult } from './index.js';
import { selectClipIfNeeded } from '../helpers/index.js';
import { analyzeMusic, MusicAnalysis } from '../music-analysis.js';

/** Clip statistics result */
export interface ClipStats {
  noteCount: number;
  pitchRange: { min: number; max: number; span: number } | null;
  pitchClasses: number[];
  velocityRange: { min: number; max: number; avg: number } | null;
  durationRange: { min: number; max: number } | null;
  lengthBeats: number;
  density: number;
  beatGrid: number[];
  analysis: MusicAnalysis | null;
}

/** Compute statistics for a clip's notes */
export function computeClipStats(
  notes: Array<{ x: number; y: number; velocity: number; duration: number }>,
  clipLengthBeats: number
): ClipStats {
  if (notes.length === 0) {
    return {
      noteCount: 0,
      pitchRange: null,
      pitchClasses: [],
      velocityRange: null,
      durationRange: null,
      lengthBeats: clipLengthBeats,
      density: 0,
      beatGrid: new Array(Math.ceil(clipLengthBeats)).fill(0),
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

  // Beat grid (1 = note present on this beat, 0 = no note)
  const gridSize = Math.ceil(clipLengthBeats);
  const beatGrid = new Array(gridSize).fill(0);
  for (const note of notes) {
    const beatIndex = Math.floor(note.x);
    if (beatIndex >= 0 && beatIndex < gridSize) {
      beatGrid[beatIndex] = 1;
    }
  }

  // Density = notes per beat (normalized)
  const density = Math.round((notes.length / (clipLengthBeats * 4)) * 1000) / 1000;

  // Music analysis (chord/scale detection)
  const analysis = analyzeMusic(notes, pitchClasses);

  return {
    noteCount: notes.length,
    pitchRange: { min: minPitch, max: maxPitch, span: maxPitch - minPitch },
    pitchClasses,
    velocityRange: { min: minVel, max: maxVel, avg: avgVel },
    durationRange: { min: Math.round(minDur * 100) / 100, max: Math.round(maxDur * 100) / 100 },
    lengthBeats: clipLengthBeats,
    density,
    beatGrid,
    analysis
  };
}

/** Handle get_clip_stats */
export async function handleGetClipStats(ctx: HandlerContext): Promise<BatchResult & Partial<ClipStats>> {
  const { dawManager, config, daw, args } = ctx;

  await selectClipIfNeeded(dawManager, config, daw, args);

  try {
    // Get notes from clip
    const notesResult = await dawManager.send('clip.getNotes', {}, daw) as {
      notes: Array<{ x: number; y: number; velocity: number; duration: number }>;
      clipLength?: number;
    };
    const notes = notesResult.notes || [];

    // Get clip length (default to 4 beats if not available)
    const clipLength = notesResult.clipLength ?? 4;

    // Compute stats
    const stats = computeClipStats(notes, clipLength);

    return {
      success: true,
      completed: 1,
      failed: 0,
      ...stats
    };
  } catch (e) {
    return {
      success: false,
      completed: 0,
      failed: 1,
      errors: [{ index: 0, error: e instanceof Error ? e.message : String(e) }]
    };
  }
}

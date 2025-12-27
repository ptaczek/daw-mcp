/**
 * Handlers module - shared types and exports.
 */

import { DAWClientManager, DAWType } from '../daw-client.js';
import { Config } from '../config.js';

/** Handler context - passed to all handlers */
export interface HandlerContext {
  dawManager: DAWClientManager;
  config: Config;
  daw: DAWType;
  args: Record<string, unknown>;
}

/** Batch operation result type */
export interface BatchResult {
  success: boolean;
  completed: number;
  failed: number;
  errors?: Array<{ index: number; error: string }>;
  results?: unknown[];
  message?: string;
  notesFound?: number;
  notesCopied?: number;
  clips?: Array<{ trackIndex: number; slotIndex: number; notes: unknown[] }>;
  tracks?: Array<{ trackIndex: number; clips: unknown }>;
  createdIndices?: number[];
  createdClips?: Array<{ trackIndex: number; slotIndex: number; lengthInBeats: number; name?: string }>;
  sceneCount?: number;
  // Euclidean pattern results
  notesCreated?: number;
  patterns?: Array<{ hits: number; steps: number; pitch: number; notesGenerated: number }>;
  // Multi-clip Euclidean results
  euclidClips?: Array<{
    trackIndex: number;
    slotIndex: number;
    created: boolean;
    notesCreated: number;
    patterns: Array<{ hits: number; steps: number; pitch: number; notesGenerated: number }>;
  }>;
  euclidErrors?: Array<{ trackIndex: number; slotIndex?: number; error: string }>;
}

/** Sort notes by time (x) ascending, then by pitch (y) ascending */
export function sortNotes<T extends { x: number; y: number }>(notes: T[]): T[] {
  return [...notes].sort((a, b) => a.x - b.x || a.y - b.y);
}

// Re-export handlers
export { handleBatchSetNotes, handleBatchMoveNotes, handleBatchClearNotes, handleBatchSetNoteProperties } from './batch-notes.js';
export { handleBatchGetNotes, handleBatchListClips, handleBatchCreateClips, handleBatchDeleteClips } from './batch-clips.js';
export { handleBatchCreateTracks, handleBatchSetTrackProperties, handleBatchDeleteTracks } from './batch-tracks.js';
export { handleGetClipStats } from './clip-stats.js';
export { handleBatchCreateEuclidPattern } from './euclid.js';
export { handleTransposeRange, handleBatchOperations } from './operations.js';

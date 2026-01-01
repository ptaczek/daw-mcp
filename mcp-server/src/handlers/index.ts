/**
 * Handlers module exports.
 */

// Types
export { HandlerContext, ToolResult, successResult, errorResult, sortNotes } from './types.js';

// Project handlers
export { handleGetDaws, handleGetProjectInfo } from './project.js';

// Track handlers
export { handleListTracks, handleBatchCreateTracks, handleBatchSetTrackProperties, handleBatchDeleteTracks } from './tracks.js';

// Clip handlers
export { handleBatchListClips, handleBatchCreateClips, handleBatchDeleteClips, handleSetClipLength } from './clips.js';

// Note handlers
export { handleBatchGetNotes, handleBatchSetNotes, handleBatchClearNotes, handleBatchMoveNotes, handleBatchSetNoteProperties, handleTransposeClip, handleTransposeRange } from './notes.js';

// Analysis handlers
export { handleGetClipStats, computeClipStats, ClipStats } from './analysis.js';

// Euclidean pattern handler
export { handleBatchCreateEuclidPattern } from './euclid.js';

/**
 * Batch track operation handlers.
 */

import { HandlerContext, BatchResult } from './index.js';
import { toInternal, toUser } from '../helpers/index.js';

/** Handle batch_create_tracks */
export async function handleBatchCreateTracks(ctx: HandlerContext): Promise<BatchResult> {
  const { dawManager, daw, args } = ctx;

  const tracks = args.tracks as Array<{ type: string; name?: string; position?: number }>;
  const errors: Array<{ index: number; error: string }> = [];
  const createdIndices: number[] = [];
  let completed = 0;

  for (let i = 0; i < tracks.length; i++) {
    try {
      // Convert position from 1-based to 0-based (but -1 stays as -1 for "end")
      const trackRequest = {
        type: tracks[i].type,
        ...(tracks[i].position !== undefined && {
          position: tracks[i].position === -1 ? -1 : toInternal(tracks[i].position!)
        })
      };
      const result = await dawManager.send('track.create', trackRequest, daw) as { index?: number };
      if (result.index !== undefined) {
        // Convert 0-based result to 1-based for user
        createdIndices.push(toUser(result.index));
      }
      // Set name if provided (create might not support name directly)
      if (tracks[i].name && result.index !== undefined) {
        await dawManager.send('track.setName', { index: result.index, name: tracks[i].name }, daw);
      }
      completed++;
    } catch (e) {
      errors.push({ index: i, error: e instanceof Error ? e.message : String(e) });
    }
  }

  return {
    success: errors.length === 0,
    completed,
    failed: errors.length,
    createdIndices,
    ...(errors.length > 0 && { errors })
  };
}

/** Handle batch_set_track_properties */
export async function handleBatchSetTrackProperties(ctx: HandlerContext): Promise<BatchResult> {
  const { dawManager, daw, args } = ctx;

  const tracks = args.tracks as Array<{
    index: number;
    name?: string;
    volume?: number;
    mute?: boolean;
    solo?: boolean;
  }>;
  const errors: Array<{ index: number; error: string }> = [];
  let completed = 0;

  for (let i = 0; i < tracks.length; i++) {
    const track = tracks[i];
    // Convert 1-based user input to 0-based internal
    const internalIndex = toInternal(track.index);
    try {
      if (track.name !== undefined) {
        await dawManager.send('track.setName', { index: internalIndex, name: track.name }, daw);
      }
      if (track.volume !== undefined) {
        await dawManager.send('track.setVolume', { index: internalIndex, volume: track.volume }, daw);
      }
      if (track.mute !== undefined) {
        await dawManager.send('track.setMute', { index: internalIndex, mute: track.mute }, daw);
      }
      if (track.solo !== undefined) {
        await dawManager.send('track.setSolo', { index: internalIndex, solo: track.solo }, daw);
      }
      completed++;
    } catch (e) {
      errors.push({ index: i, error: e instanceof Error ? e.message : String(e) });
    }
  }

  return {
    success: errors.length === 0,
    completed,
    failed: errors.length,
    ...(errors.length > 0 && { errors })
  };
}

/** Handle batch_delete_tracks (delete in reverse order to preserve indices) */
export async function handleBatchDeleteTracks(ctx: HandlerContext): Promise<BatchResult> {
  const { dawManager, daw, args } = ctx;

  const trackIndices = args.trackIndices as number[];
  const errors: Array<{ index: number; error: string }> = [];
  let completed = 0;

  // Convert 1-based user input to 0-based internal, then sort in descending order
  const internalIndices = trackIndices.map(toInternal);
  const sortedIndices = [...internalIndices].sort((a, b) => b - a);

  for (let i = 0; i < sortedIndices.length; i++) {
    try {
      await dawManager.send('track.delete', { index: sortedIndices[i] }, daw);
      completed++;
    } catch (e) {
      // Report error with 1-based index for user
      errors.push({ index: toUser(sortedIndices[i]), error: e instanceof Error ? e.message : String(e) });
    }
  }

  return {
    success: errors.length === 0,
    completed,
    failed: errors.length,
    ...(errors.length > 0 && { errors })
  };
}

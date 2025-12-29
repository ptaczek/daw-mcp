/**
 * Batch clip operation handlers.
 */

import { HandlerContext, BatchResult, sortNotes } from './index.js';
import { toInternal, toUser, resolveClipIndices, slotHasContent, findEmptySlots } from '../helpers/index.js';
import { DAWClientManager, DAWType } from '../daw-client.js';

/**
 * Find empty slots with auto-scene-creation.
 * If not enough empty slots are found, creates the needed scenes and retries.
 */
async function findEmptySlotsWithAutoCreate(
  dawManager: DAWClientManager,
  daw: DAWType | undefined,
  trackIndex: number,
  startSlot: number,
  count: number
): Promise<{
  emptySlots: number[];
  found: number;
  requested: number;
  sceneCount: number;
  scenesCreated: number;
}> {
  let emptyResult = await findEmptySlots(dawManager, daw, trackIndex, startSlot, count);
  let scenesCreated = 0;

  if (emptyResult.found < count) {
    // Calculate how many more scenes we need
    const scenesNeeded = count - emptyResult.found;

    try {
      const createResult = await dawManager.send('clip.createScene', {
        count: scenesNeeded
      }, daw) as { success: boolean; created: number; sceneCount: number };

      if (createResult.success) {
        scenesCreated = createResult.created;
        // Small delay to allow Bitwig's observer to update scene count
        // This happens in Node.js, giving Bitwig's event loop time to process
        await new Promise(resolve => setTimeout(resolve, 50));
        // Retry finding empty slots with the new scene count
        emptyResult = await findEmptySlots(dawManager, daw, trackIndex, startSlot, count);
      }
    } catch {
      // Scene creation failed - continue with what we have
    }
  }

  return {
    ...emptyResult,
    scenesCreated
  };
}

/** Handle batch_get_notes (multi-clip, single clip, or cursor clip) */
export async function handleBatchGetNotes(ctx: HandlerContext): Promise<BatchResult> {
  const { dawManager, config, daw, args } = ctx;
  const verbose = args.verbose as boolean ?? false;

  // Resolve clips: explicit array > single trackIndex/slotIndex > cursor clip
  let clips: Array<{ trackIndex: number; slotIndex: number }>;
  let usedCursor = false;

  if (args.clips && (args.clips as Array<unknown>).length > 0) {
    clips = args.clips as Array<{ trackIndex: number; slotIndex: number }>;
  } else if (args.trackIndex !== undefined && args.slotIndex !== undefined) {
    clips = [{ trackIndex: args.trackIndex as number, slotIndex: args.slotIndex as number }];
  } else {
    // Get cursor clip
    const selection = await dawManager.send('clip.getSelection', {}, daw) as { trackIndex: number; slotIndex: number };
    if (selection.trackIndex === -1 || selection.slotIndex === -1) {
      return {
        success: false,
        completed: 0,
        failed: 1,
        errors: [{ index: 0, error: 'No clip selected. Select a clip in DAW or provide trackIndex/slotIndex (1-based).' }]
      };
    }
    // selection is 0-based internal, convert to 1-based for processing
    clips = [{ trackIndex: toUser(selection.trackIndex), slotIndex: toUser(selection.slotIndex) }];
    usedCursor = true;
  }

  const results: Array<{ trackIndex: number; slotIndex: number; notes: unknown[] }> = [];
  const errors: Array<{ index: number; error: string }> = [];

  for (let i = 0; i < clips.length; i++) {
    const clip = clips[i];
    // Convert 1-based user input to 0-based internal
    const internalTrack = toInternal(clip.trackIndex);
    const internalSlot = toInternal(clip.slotIndex);
    try {
      // Skip selection delay if using cursor (already selected)
      if (!usedCursor || clips.length > 1) {
        await dawManager.send('clip.select', { trackIndex: internalTrack, slotIndex: internalSlot }, daw);
        await new Promise(resolve => setTimeout(resolve, config.mcp.selectionDelayMs));
      }
      const notesResult = await dawManager.send('clip.getNotes', {}, daw) as {
        notes: Array<{ x: number; y: number; velocity: number; duration: number }>
      };
      const rawNotes = notesResult.notes || [];
      const sortedNotes = sortNotes(rawNotes);

      // Transform to lean format unless verbose
      const notes = verbose
        ? sortedNotes
        : sortedNotes.map(n => [n.x, n.y, Math.round(n.velocity * 127), Math.round(n.duration * 100) / 100]);

      // Return 1-based indices to user
      results.push({
        trackIndex: clip.trackIndex,  // Keep original 1-based from user
        slotIndex: clip.slotIndex,
        notes
      });
    } catch (e) {
      errors.push({ index: i, error: e instanceof Error ? e.message : String(e) });
    }
  }

  return {
    success: errors.length === 0,
    completed: results.length,
    failed: errors.length,
    clips: results,
    ...(errors.length > 0 && { errors })
  };
}

/** Handle batch_list_clips (multi-track, single track, or cursor track) */
export async function handleBatchListClips(ctx: HandlerContext): Promise<BatchResult> {
  const { dawManager, daw, args } = ctx;

  // Resolve trackIndices: explicit array > single trackIndex > cursor track
  let trackIndices: number[];
  if (args.trackIndices && (args.trackIndices as number[]).length > 0) {
    trackIndices = args.trackIndices as number[];
  } else if (args.trackIndex !== undefined) {
    trackIndices = [args.trackIndex as number];
  } else {
    // Get cursor track
    const selection = await dawManager.send('clip.getSelection', {}, daw) as { trackIndex: number };
    if (selection.trackIndex === -1) {
      return {
        success: false,
        completed: 0,
        failed: 1,
        errors: [{ index: 0, error: 'No track selected. Select a track in DAW or provide trackIndex/trackIndices (1-based).' }]
      };
    }
    // selection.trackIndex is 0-based internal, convert to 1-based for processing
    trackIndices = [toUser(selection.trackIndex)];
  }

  const results: Array<{ trackIndex: number; clips: unknown }> = [];
  const errors: Array<{ index: number; error: string }> = [];

  for (let i = 0; i < trackIndices.length; i++) {
    // Convert 1-based user input to 0-based internal
    const internalTrack = toInternal(trackIndices[i]);
    try {
      const clipsResult = await dawManager.send('clip.list', { trackIndex: internalTrack }, daw) as {
        clips: Array<{ slotIndex: number; [key: string]: unknown }>;
      };
      // Convert slotIndex to 1-based for user
      const convertedClips = clipsResult.clips.map(clip => ({
        ...clip,
        slotIndex: toUser(clip.slotIndex)
      }));
      // Return 1-based index to user
      results.push({
        trackIndex: trackIndices[i],  // Keep original 1-based from user
        clips: convertedClips
      });
    } catch (e) {
      errors.push({ index: i, error: e instanceof Error ? e.message : String(e) });
    }
  }

  return {
    success: errors.length === 0,
    completed: results.length,
    failed: errors.length,
    tracks: results,
    ...(errors.length > 0 && { errors })
  };
}

/** Handle batch_create_clips with safe creation (Mode A / Mode B) */
export async function handleBatchCreateClips(ctx: HandlerContext): Promise<BatchResult> {
  const { dawManager, config, daw, args } = ctx;

  const clips = args.clips as Array<{ trackIndex?: number; slotIndex?: number; lengthInBeats?: number; name?: string }> | undefined;
  const overwrite = (args.overwrite as boolean) ?? false;
  const errors: Array<{ index: number; error: string }> = [];
  const createdClips: Array<{ trackIndex: number; slotIndex: number; lengthInBeats: number; name?: string }> = [];
  let completed = 0;

  // Get cursor position for Mode A (auto-find empty slots)
  const cursor = await resolveClipIndices(dawManager, daw, undefined, undefined);
  const cursorTrack = cursor.trackIndex;  // 0-based internal
  let cursorSlot = cursor.slotIndex;       // 0-based internal

  // Get scene count to validate cursor position
  const sceneCountResult = await dawManager.send('clip.getSceneCount', {}, daw) as { sceneCount: number };
  const sceneCount = sceneCountResult.sceneCount;

  // Reset cursor to 0 if it points beyond existing scenes (stale cursor edge case)
  if (cursorSlot >= sceneCount) {
    cursorSlot = 0;
  }

  // If no clips array or empty, create one clip at first empty slot from cursor
  if (!clips || clips.length === 0) {
    const emptyResult = await findEmptySlotsWithAutoCreate(dawManager, daw, cursorTrack, cursorSlot, 1);
    if (emptyResult.found === 0) {
      return {
        success: false,
        completed: 0,
        failed: 1,
        errors: [{ index: 0, error: `No empty slots available even after attempting to create scenes. Scene count: ${emptyResult.sceneCount}` }],
        sceneCount: emptyResult.sceneCount
      };
    }
    const targetSlot = emptyResult.emptySlots[0];
    try {
      await dawManager.send('clip.create', { trackIndex: cursorTrack, slotIndex: targetSlot, lengthInBeats: 4 }, daw);
      createdClips.push({ trackIndex: toUser(cursorTrack), slotIndex: toUser(targetSlot), lengthInBeats: 4 });
      completed++;
    } catch (e) {
      errors.push({ index: 0, error: e instanceof Error ? e.message : String(e) });
    }
    return {
      success: errors.length === 0,
      completed,
      failed: errors.length,
      createdClips,
      sceneCount: emptyResult.sceneCount,
      ...(emptyResult.scenesCreated > 0 && { scenesCreated: emptyResult.scenesCreated }),
      ...(errors.length > 0 && { errors })
    };
  }

  // Process each clip request
  for (let i = 0; i < clips.length; i++) {
    const clip = clips[i];
    const lengthInBeats = clip.lengthInBeats ?? 4;

    try {
      // Determine track (use provided or cursor track)
      const trackIndex = clip.trackIndex !== undefined ? toInternal(clip.trackIndex) : cursorTrack;

      let slotIndex: number;

      if (clip.slotIndex !== undefined) {
        // Mode B: Targeted creation - validate slot is empty
        slotIndex = toInternal(clip.slotIndex);
        const hasContent = await slotHasContent(dawManager, daw, trackIndex, slotIndex);

        if (hasContent && !overwrite) {
          errors.push({
            index: i,
            error: `Slot ${clip.slotIndex} on track ${clip.trackIndex ?? toUser(cursorTrack)} has content. Use overwrite=true to replace.`
          });
          continue;
        }

        if (hasContent && overwrite) {
          // Delete existing clip first
          await dawManager.send('clip.delete', { trackIndex, slotIndex }, daw);
        }
      } else {
        // Mode A: Auto-find empty slot from cursor position (with auto-scene-creation)
        const emptyResult = await findEmptySlotsWithAutoCreate(dawManager, daw, trackIndex, cursorSlot, 1);
        if (emptyResult.found === 0) {
          errors.push({
            index: i,
            error: `No empty slots available from position ${toUser(cursorSlot)} even after attempting to create scenes. Scene count: ${emptyResult.sceneCount}`
          });
          continue;
        }
        slotIndex = emptyResult.emptySlots[0];
        // Move cursor forward for next auto-find
        cursorSlot = slotIndex + 1;
      }

      // Create the clip
      await dawManager.send('clip.create', { trackIndex, slotIndex, lengthInBeats }, daw);

      // Set clip name if provided
      if (clip.name) {
        await dawManager.send('clip.select', { trackIndex, slotIndex }, daw);
        await new Promise(resolve => setTimeout(resolve, config.mcp.selectionDelayMs));
        await dawManager.send('clip.setName', { name: clip.name }, daw);
      }

      createdClips.push({
        trackIndex: toUser(trackIndex),
        slotIndex: toUser(slotIndex),
        lengthInBeats,
        ...(clip.name && { name: clip.name })
      });
      completed++;
    } catch (e) {
      errors.push({ index: i, error: e instanceof Error ? e.message : String(e) });
    }
  }

  return {
    success: errors.length === 0,
    completed,
    failed: errors.length,
    createdClips,
    ...(errors.length > 0 && { errors })
  };
}

/** Handle batch_delete_clips */
export async function handleBatchDeleteClips(ctx: HandlerContext): Promise<BatchResult> {
  const { dawManager, daw, args } = ctx;

  let clips = args.clips as Array<{ trackIndex?: number; slotIndex?: number }> | undefined;
  const errors: Array<{ index: number; error: string }> = [];
  let completed = 0;

  // If no clips array or empty, delete clip at cursor
  if (!clips || clips.length === 0) {
    // resolveClipIndices returns 0-based for cursor selection
    const { trackIndex, slotIndex } = await resolveClipIndices(dawManager, daw);
    try {
      await dawManager.send('clip.delete', { trackIndex, slotIndex }, daw);
      completed++;
    } catch (e) {
      errors.push({ index: 0, error: e instanceof Error ? e.message : String(e) });
    }
    return {
      success: errors.length === 0,
      completed,
      failed: errors.length,
      ...(errors.length > 0 && { errors })
    };
  }

  for (let i = 0; i < clips.length; i++) {
    try {
      const clip = clips[i];
      // resolveClipIndices handles 1-based to 0-based conversion
      const { trackIndex, slotIndex } = await resolveClipIndices(dawManager, daw, clip.trackIndex, clip.slotIndex);
      await dawManager.send('clip.delete', { trackIndex, slotIndex }, daw);
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

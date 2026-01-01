/**
 * Euclidean rhythm pattern handler.
 */

import { HandlerContext, ToolResult, successResult, errorResult } from './types.js';
import { toInternal, toUser, quantizeForBitwig } from '../helpers/index.js';
import { patternsToNotes, EuclidPattern } from '../euclidean.js';

interface ClipInput {
  slotIndex?: number;
  lengthBeats?: number;
  name?: string;
  patterns: EuclidPattern[];
}

interface TrackInput {
  trackIndex: number;
  clips: ClipInput[];
}

interface ClipResult {
  trackIndex: number;
  slotIndex: number;
  created: boolean;
  notesCreated: number;
  patterns: Array<{ hits: number; steps: number; pitch: number; notesGenerated: number }>;
}

/** Handle batch_create_euclid_pattern (multi-track, multi-clip) */
export async function handleBatchCreateEuclidPattern(ctx: HandlerContext): Promise<ToolResult> {
  const { dawManager, config, daw, args } = ctx;

  const tracks = args.tracks as TrackInput[];
  const results: ClipResult[] = [];
  const euclidErrors: Array<{ trackIndex: number; slotIndex?: number; error: string }> = [];

  for (const track of tracks) {
    const trackIndex = track.trackIndex;
    const internalTrack = toInternal(trackIndex);

    for (const clipInput of track.clips) {
      let slotIndex: number;
      let created = false;

      try {
        if (clipInput.slotIndex !== undefined) {
          // Scenario 2: Update existing clip
          slotIndex = clipInput.slotIndex;
          const internalSlot = toInternal(slotIndex);

          // Select the clip
          await dawManager.send('clip.select', { trackIndex: internalTrack, slotIndex: internalSlot }, daw);
          await new Promise(resolve => setTimeout(resolve, config.mcp.selectionDelayMs));

          // Smart clearing: only clear notes at pitches we're about to pattern
          const pitchesToClear = [...new Set(clipInput.patterns.map(p => p.pitch))];
          for (const pitch of pitchesToClear) {
            await dawManager.send('clip.clearNotesAtPitch', { pitch }, daw);
          }
        } else {
          // Scenario 1: Create new clip
          const lengthBeats = clipInput.lengthBeats ?? 4;

          // Find empty slot on this track using findEmptySlots
          const findResult = await dawManager.send('clip.findEmptySlots', {
            trackIndex: internalTrack,
            startSlot: 0,
            count: 1
          }, daw) as { emptySlots: number[]; sceneCount: number };

          if (!findResult.emptySlots || findResult.emptySlots.length === 0) {
            euclidErrors.push({ trackIndex, error: `No empty slots available on track ${trackIndex}` });
            continue;
          }

          const emptySlot = findResult.emptySlots[0];
          slotIndex = toUser(emptySlot);

          // Create the clip
          await dawManager.send('clip.create', {
            trackIndex: internalTrack,
            slotIndex: emptySlot,
            lengthInBeats: lengthBeats
          }, daw);

          // Select the new clip
          await dawManager.send('clip.select', { trackIndex: internalTrack, slotIndex: emptySlot }, daw);
          await new Promise(resolve => setTimeout(resolve, config.mcp.selectionDelayMs));

          // Set clip name if provided
          if (clipInput.name) {
            await dawManager.send('clip.setName', { name: clipInput.name }, daw);
          }

          created = true;
        }

        // Generate and add notes
        const lengthBeats = clipInput.lengthBeats ?? 4;
        const notes = patternsToNotes(clipInput.patterns, lengthBeats);

        // Quantize for Bitwig if needed
        const quantizedNotes = notes.map(note => {
          if (daw === 'bitwig') {
            return {
              ...note,
              x: quantizeForBitwig(note.x, config),
              duration: quantizeForBitwig(note.duration, config)
            };
          }
          return note;
        });

        // Send notes
        if (daw === 'ableton') {
          await dawManager.send('clip.setNotes', { notes: quantizedNotes }, daw);
        } else {
          for (const note of quantizedNotes) {
            await dawManager.send('clip.setNote', note as unknown as Record<string, unknown>, daw);
          }
        }

        results.push({
          trackIndex,
          slotIndex,
          created,
          notesCreated: notes.length,
          patterns: clipInput.patterns.map(p => ({
            hits: p.hits,
            steps: p.steps,
            pitch: p.pitch,
            notesGenerated: notes.filter(n => n.y === p.pitch).length
          }))
        });

      } catch (e) {
        euclidErrors.push({
          trackIndex,
          slotIndex: clipInput.slotIndex,
          error: e instanceof Error ? e.message : String(e)
        });
      }
    }
  }

  return successResult({
    success: euclidErrors.length === 0,
    completed: results.length,
    failed: euclidErrors.length,
    euclidClips: results,
    ...(euclidErrors.length > 0 && { euclidErrors })
  });
}

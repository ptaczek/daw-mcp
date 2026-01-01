/**
 * Note handlers: batch_get_notes, batch_set_notes, batch_clear_notes, batch_move_notes,
 * batch_set_note_properties, transpose_clip, transpose_range
 */

import { HandlerContext, ToolResult, successResult, errorResult, sortNotes } from './types.js';
import { toInternal, toUser, quantizeForBitwig, selectClipIfNeeded } from '../helpers/index.js';

/** Handle batch_get_notes (multi-clip, single clip, or cursor clip) */
export async function handleBatchGetNotes(ctx: HandlerContext): Promise<ToolResult> {
  const { dawManager, config, daw, args } = ctx;

  try {
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
        return errorResult('No clip selected. Select a clip in DAW or provide trackIndex/slotIndex (1-based).');
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

    return successResult({
      success: errors.length === 0,
      completed: results.length,
      failed: errors.length,
      clips: results,
      ...(errors.length > 0 && { errors })
    });
  } catch (error) {
    return errorResult(error instanceof Error ? error.message : String(error));
  }
}

/** Handle batch_set_notes (supports both array and object formats) */
export async function handleBatchSetNotes(ctx: HandlerContext): Promise<ToolResult> {
  const { dawManager, config, daw, args } = ctx;

  try {
    await selectClipIfNeeded(dawManager, config, daw, args);
    const rawNotes = args.notes as Array<unknown>;

    // Convert all notes to object format
    const notes: Array<{ x: number; y: number; velocity?: number; duration?: number }> = [];

    for (const rawNote of rawNotes) {
      if (Array.isArray(rawNote)) {
        const arr = rawNote as number[];
        notes.push({
          x: arr[0],
          y: arr[1],
          velocity: arr[2] ?? 100,
          duration: arr[3] ?? 0.25
        });
      } else {
        notes.push(rawNote as { x: number; y: number; velocity?: number; duration?: number });
      }
    }

    // Quantize for Bitwig (Ableton supports arbitrary positioning)
    const processedNotes = daw === 'bitwig'
      ? notes.map(n => ({
          ...n,
          x: quantizeForBitwig(n.x, config),
          duration: n.duration !== undefined ? quantizeForBitwig(n.duration, config) : undefined
        }))
      : notes;

    // Ableton supports batch setNotes in single call, Bitwig needs individual calls
    if (daw === 'ableton') {
      await dawManager.send('clip.setNotes', { notes: processedNotes }, daw);
      return successResult({ success: true });
    } else {
      // Bitwig: send notes one by one
      const errors: Array<{ index: number; error: string }> = [];
      let completed = 0;

      for (let i = 0; i < processedNotes.length; i++) {
        try {
          await dawManager.send('clip.setNote', processedNotes[i], daw);
          completed++;
        } catch (e) {
          errors.push({ index: i, error: e instanceof Error ? e.message : String(e) });
        }
      }

      return successResult({
        success: errors.length === 0,
        completed,
        failed: errors.length,
        ...(errors.length > 0 && { errors })
      });
    }
  } catch (error) {
    return errorResult(error instanceof Error ? error.message : String(error));
  }
}

/** Handle batch_clear_notes (specific notes or clear all) */
export async function handleBatchClearNotes(ctx: HandlerContext): Promise<ToolResult> {
  const { dawManager, config, daw, args } = ctx;

  try {
    await selectClipIfNeeded(dawManager, config, daw, args);
    const notes = args.notes as Array<{ x: number; y: number }> | undefined;

    // If no notes array or empty, clear all notes
    if (!notes || notes.length === 0) {
      await dawManager.send('clip.clearAllNotes', {}, daw);
      return successResult({ success: true, message: 'All notes cleared' });
    }

    // Clear specific notes
    const errors: Array<{ index: number; error: string }> = [];
    let completed = 0;

    for (let i = 0; i < notes.length; i++) {
      try {
        await dawManager.send('clip.clearNote', notes[i], daw);
        completed++;
      } catch (e) {
        errors.push({ index: i, error: e instanceof Error ? e.message : String(e) });
      }
    }

    return successResult({
      success: errors.length === 0,
      completed,
      failed: errors.length,
      ...(errors.length > 0 && { errors })
    });
  } catch (error) {
    return errorResult(error instanceof Error ? error.message : String(error));
  }
}

/** Handle batch_move_notes */
export async function handleBatchMoveNotes(ctx: HandlerContext): Promise<ToolResult> {
  const { dawManager, config, daw, args } = ctx;

  try {
    await selectClipIfNeeded(dawManager, config, daw, args);
    const moves = args.moves as Array<{ x: number; y: number; dx?: number; dy?: number }>;
    const errors: Array<{ index: number; error: string }> = [];
    let completed = 0;

    for (let i = 0; i < moves.length; i++) {
      try {
        await dawManager.send('clip.moveNote', moves[i], daw);
        completed++;
      } catch (e) {
        errors.push({ index: i, error: e instanceof Error ? e.message : String(e) });
      }
    }

    return successResult({
      success: errors.length === 0,
      completed,
      failed: errors.length,
      ...(errors.length > 0 && { errors })
    });
  } catch (error) {
    return errorResult(error instanceof Error ? error.message : String(error));
  }
}

/** Handle batch_set_note_properties */
export async function handleBatchSetNoteProperties(ctx: HandlerContext): Promise<ToolResult> {
  const { dawManager, config, daw, args } = ctx;

  try {
    await selectClipIfNeeded(dawManager, config, daw, args);
    const notes = args.notes as Array<{
      x: number;
      y: number;
      velocity?: number;
      duration?: number;
      gain?: number;
      pan?: number;
      pressure?: number;
      timbre?: number;
      transpose?: number;
      chance?: number;
      muted?: boolean;
    }>;
    const errors: Array<{ index: number; error: string }> = [];
    let completed = 0;

    // Map property names to commands
    const propertyCommands: Record<string, string> = {
      velocity: 'clip.setNoteVelocity',
      duration: 'clip.setNoteDuration',
      gain: 'clip.setNoteGain',
      pan: 'clip.setNotePan',
      pressure: 'clip.setNotePressure',
      timbre: 'clip.setNoteTimbre',
      transpose: 'clip.setNoteTranspose',
      chance: 'clip.setNoteChance',
      muted: 'clip.setNoteMuted'
    };

    for (let i = 0; i < notes.length; i++) {
      const note = notes[i];
      const { x, y, ...properties } = note;

      try {
        for (const [prop, value] of Object.entries(properties)) {
          const command = propertyCommands[prop];
          if (command && value !== undefined) {
            if (prop === 'muted') {
              await dawManager.send(command, { x, y, muted: value }, daw);
            } else {
              await dawManager.send(command, { x, y, value }, daw);
            }
          }
        }
        completed++;
      } catch (e) {
        errors.push({ index: i, error: e instanceof Error ? e.message : String(e) });
      }
    }

    return successResult({
      success: errors.length === 0,
      completed,
      failed: errors.length,
      ...(errors.length > 0 && { errors })
    });
  } catch (error) {
    return errorResult(error instanceof Error ? error.message : String(error));
  }
}

/** Handle transpose_clip */
export async function handleTransposeClip(ctx: HandlerContext): Promise<ToolResult> {
  const { dawManager, config, daw, args } = ctx;

  try {
    const semitones = args.semitones as number;

    // Handle optional clip selection
    await selectClipIfNeeded(dawManager, config, daw, args);

    await dawManager.send('clip.transpose', { semitones }, daw);
    return successResult({ success: true });
  } catch (error) {
    return errorResult(error instanceof Error ? error.message : String(error));
  }
}

/** Handle transpose_range */
export async function handleTransposeRange(ctx: HandlerContext): Promise<ToolResult> {
  const { dawManager, config, daw, args } = ctx;

  try {
    await selectClipIfNeeded(dawManager, config, daw, args);
    const { startStep, endStep, semitones, pitchFilter } = args as {
      startStep: number;
      endStep: number;
      semitones: number;
      pitchFilter?: number;
    };

    // Get current notes
    const notesResult = await dawManager.send('clip.getNotes', {}, daw) as { notes: Array<{ x: number; y: number }> };
    const notes = notesResult.notes || [];

    // Filter notes in range (and optionally by pitch)
    const notesToMove = notes.filter(n => {
      const inRange = n.x >= startStep && n.x <= endStep;
      const matchesPitch = pitchFilter === undefined || n.y === pitchFilter;
      return inRange && matchesPitch;
    });

    if (notesToMove.length === 0) {
      return successResult({
        success: true,
        completed: 0,
        failed: 0,
        message: 'No notes found in specified range'
      });
    }

    // Move the notes
    const errors: Array<{ index: number; error: string }> = [];
    let completed = 0;
    for (let i = 0; i < notesToMove.length; i++) {
      try {
        await dawManager.send('clip.moveNote', {
          x: notesToMove[i].x,
          y: notesToMove[i].y,
          dx: 0,
          dy: semitones
        }, daw);
        completed++;
      } catch (e) {
        errors.push({ index: i, error: e instanceof Error ? e.message : String(e) });
      }
    }

    return successResult({
      success: errors.length === 0,
      completed,
      failed: errors.length,
      notesFound: notesToMove.length,
      ...(errors.length > 0 && { errors })
    });
  } catch (error) {
    return errorResult(error instanceof Error ? error.message : String(error));
  }
}

/**
 * Batch note operation handlers.
 */

import { HandlerContext, BatchResult } from './index.js';
import { selectClipIfNeeded, quantizeForBitwig } from '../helpers/index.js';

/** Handle batch_set_notes (supports both array and object formats) */
export async function handleBatchSetNotes(ctx: HandlerContext): Promise<BatchResult> {
  const { dawManager, config, daw, args } = ctx;

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
    try {
      await dawManager.send('clip.setNotes', { notes: processedNotes }, daw);
      return {
        success: true,
        completed: processedNotes.length,
        failed: 0
      };
    } catch (e) {
      return {
        success: false,
        completed: 0,
        failed: processedNotes.length,
        errors: [{ index: 0, error: e instanceof Error ? e.message : String(e) }]
      };
    }
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

    return {
      success: errors.length === 0,
      completed,
      failed: errors.length,
      ...(errors.length > 0 && { errors })
    };
  }
}

/** Handle batch_move_notes */
export async function handleBatchMoveNotes(ctx: HandlerContext): Promise<BatchResult> {
  const { dawManager, config, daw, args } = ctx;

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

  return {
    success: errors.length === 0,
    completed,
    failed: errors.length,
    ...(errors.length > 0 && { errors })
  };
}

/** Handle batch_clear_notes (specific notes or clear all) */
export async function handleBatchClearNotes(ctx: HandlerContext): Promise<BatchResult> {
  const { dawManager, config, daw, args } = ctx;

  await selectClipIfNeeded(dawManager, config, daw, args);
  const notes = args.notes as Array<{ x: number; y: number }> | undefined;

  // If no notes array or empty, clear all notes
  if (!notes || notes.length === 0) {
    try {
      await dawManager.send('clip.clearAllNotes', {}, daw);
      return {
        success: true,
        completed: 1,
        failed: 0,
        message: 'All notes cleared'
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

  return {
    success: errors.length === 0,
    completed,
    failed: errors.length,
    ...(errors.length > 0 && { errors })
  };
}

/** Handle batch_set_note_properties */
export async function handleBatchSetNoteProperties(ctx: HandlerContext): Promise<BatchResult> {
  const { dawManager, config, daw, args } = ctx;

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

  return {
    success: errors.length === 0,
    completed,
    failed: errors.length,
    ...(errors.length > 0 && { errors })
  };
}

/**
 * Higher-level operation handlers (transpose_range, batch_operations).
 */

import { HandlerContext, BatchResult } from './index.js';
import { selectClipIfNeeded } from '../helpers/index.js';

/** Handle transpose_range */
export async function handleTransposeRange(ctx: HandlerContext): Promise<BatchResult> {
  const { dawManager, config, daw, args } = ctx;

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
    return {
      success: true,
      completed: 0,
      failed: 0,
      message: 'No notes found in specified range'
    };
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

  return {
    success: errors.length === 0,
    completed,
    failed: errors.length,
    notesFound: notesToMove.length,
    ...(errors.length > 0 && { errors })
  };
}

/** Handle batch_operations (generic multi-action) */
export async function handleBatchOperations(ctx: HandlerContext): Promise<BatchResult> {
  const { dawManager, config, daw, args } = ctx;

  await selectClipIfNeeded(dawManager, config, daw, args);
  const operations = args.operations as Array<{
    action: 'set' | 'move' | 'clear' | 'transpose_clip';
    x?: number;
    y?: number;
    dx?: number;
    dy?: number;
    velocity?: number;
    duration?: number;
    semitones?: number;
  }>;

  const errors: Array<{ index: number; error: string }> = [];
  let completed = 0;

  for (let i = 0; i < operations.length; i++) {
    const op = operations[i];
    try {
      switch (op.action) {
        case 'set':
          await dawManager.send('clip.setNote', {
            x: op.x,
            y: op.y,
            velocity: op.velocity ?? 100,
            duration: op.duration ?? 0.25
          }, daw);
          break;
        case 'move':
          await dawManager.send('clip.moveNote', {
            x: op.x,
            y: op.y,
            dx: op.dx ?? 0,
            dy: op.dy ?? 0
          }, daw);
          break;
        case 'clear':
          await dawManager.send('clip.clearNote', { x: op.x, y: op.y }, daw);
          break;
        case 'transpose_clip':
          await dawManager.send('clip.transpose', { semitones: op.semitones ?? 0 }, daw);
          break;
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

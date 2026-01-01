/**
 * Clip selection helpers.
 * Handles resolving clip positions from user input or cursor selection.
 */

import { DAWClientManager, DAWType } from '../daw-client.js';
import { Config } from '../config.js';
import { toInternal } from './indices.js';

/**
 * Resolve clip indices (use provided or get from cursor selection).
 * User input is 1-based, returns 0-based internal indices.
 */
export async function resolveClipIndices(
  dawManager: DAWClientManager,
  daw: DAWType | undefined,
  trackIndex?: number,
  slotIndex?: number
): Promise<{ trackIndex: number; slotIndex: number }> {
  if (trackIndex !== undefined && slotIndex !== undefined) {
    // Convert 1-based user input to 0-based internal
    return { trackIndex: toInternal(trackIndex), slotIndex: toInternal(slotIndex) };
  }

  const selection = await dawManager.send('clip.getSelection', {}, daw) as {
    trackIndex: number;
    slotIndex: number;
    hasContent: boolean;
    trackName: string;
    clipName: string;
  };

  if (selection.trackIndex === -1 || selection.slotIndex === -1) {
    throw new Error('No clip slot selected. Select a slot in DAW or provide trackIndex/slotIndex (1-based).');
  }

  // Selection from cursor is already 0-based (internal format)
  return { trackIndex: selection.trackIndex, slotIndex: selection.slotIndex };
}

/** Check if a specific slot has content (uses 0-based internal indices) */
export async function slotHasContent(
  dawManager: DAWClientManager,
  daw: DAWType | undefined,
  trackIndex: number,
  slotIndex: number
): Promise<boolean> {
  const result = await dawManager.send('clip.hasContent', { trackIndex, slotIndex }, daw) as { hasContent: boolean };
  return result.hasContent;
}

/** Find N empty slots starting from startSlot (uses 0-based internal indices) */
export async function findEmptySlots(
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
}> {
  return await dawManager.send('clip.findEmptySlots', { trackIndex, startSlot, count }, daw) as {
    emptySlots: number[];
    found: number;
    requested: number;
    sceneCount: number;
  };
}

/** Select clip if needed (resolve indices and select if provided) */
export async function selectClipIfNeeded(
  dawManager: DAWClientManager,
  config: Config,
  daw: DAWType | undefined,
  args: Record<string, unknown>
): Promise<void> {
  const indices = await resolveClipIndices(
    dawManager,
    daw,
    args.trackIndex as number | undefined,
    args.slotIndex as number | undefined
  );

  // Only select if indices were explicitly provided (not from cursor)
  if (args.trackIndex !== undefined && args.slotIndex !== undefined) {
    await dawManager.send('clip.select', {
      trackIndex: indices.trackIndex,
      slotIndex: indices.slotIndex
    }, daw);
    // Delay to ensure cursor clip follows the selection
    await new Promise(resolve => setTimeout(resolve, config.mcp.selectionDelayMs));
  }
}

/**
 * Index conversion helpers.
 * User-facing API uses 1-based indexing (Track 1, Slot 1)
 * Internal DAW API uses 0-based indexing (Track 0, Slot 0)
 */

import { getStepSize, Config } from '../config.js';

/** Convert 1-based user index to 0-based internal index */
export function toInternal(index: number): number {
  return index - 1;
}

/** Convert 0-based internal index to 1-based user index */
export function toUser(index: number): number {
  return index + 1;
}

/**
 * Quantize a beat value to the configured grid.
 * Used when sending notes to Bitwig (API limitation).
 */
export function quantizeForBitwig(beats: number, config: Config): number {
  const stepSize = getStepSize(config);
  return Math.round(beats / stepSize) * stepSize;
}

/**
 * Euclidean rhythm generator using Tonal.js RhythmPattern
 *
 * Examples:
 *   euclid(8, 3)  → [1,0,0,1,0,0,1,0]  // tresillo
 *   euclid(8, 5)  → [1,0,1,0,1,1,0,1]  // cinquillo
 *   euclid(16, 7) → west african bell pattern
 */

import { RhythmPattern } from 'tonal';

export interface EuclidPattern {
  hits: number;
  steps: number;
  pitch: number;
  velocity?: number;
  rotate?: number;
  duration?: number;
}

interface NoteOutput {
  x: number;
  y: number;
  velocity: number;
  duration: number;
}

/**
 * Convert Euclidean pattern parameters to MIDI notes
 * @param pattern Pattern configuration
 * @param lengthBeats Total clip length in beats
 * @returns Array of notes in the format used by batch_set_notes
 */
function patternToNotes(pattern: EuclidPattern, lengthBeats: number): NoteOutput[] {
  const { hits, steps, pitch, velocity = 100, rotate: rotateAmount = 0, duration } = pattern;

  // Generate base pattern using Tonal.js
  // API: euclid(steps, hits) - note the order!
  let rhythmPattern = RhythmPattern.euclid(steps, hits);

  // Apply rotation if specified
  // API: rotate(pattern, amount)
  if (rotateAmount !== 0) {
    rhythmPattern = RhythmPattern.rotate(rhythmPattern, rotateAmount);
  }

  // Calculate step size in beats
  const stepSize = lengthBeats / steps;
  const noteDuration = duration ?? stepSize;

  // Convert pattern to notes
  const notes: NoteOutput[] = [];
  for (let i = 0; i < rhythmPattern.length; i++) {
    if (rhythmPattern[i] === 1) {
      notes.push({
        x: i * stepSize,
        y: pitch,
        velocity,
        duration: noteDuration
      });
    }
  }

  return notes;
}

/**
 * Convert multiple patterns to notes (for layered drums, etc.)
 */
export function patternsToNotes(patterns: EuclidPattern[], lengthBeats: number): NoteOutput[] {
  const allNotes: NoteOutput[] = [];

  for (const pattern of patterns) {
    const notes = patternToNotes(pattern, lengthBeats);
    allNotes.push(...notes);
  }

  return allNotes;
}

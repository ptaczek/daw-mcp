/**
 * Music analysis using Tonal.js
 * Provides chord detection, scale suggestion, and key estimation
 */

import { Chord, Scale, Note, Interval } from 'tonal';

interface ChordInfo {
  beat: number;
  midiNotes: number[];
  noteNames: string[];
  chord: string | null;
  type: string | null;
}

export interface MusicAnalysis {
  chords: ChordInfo[];
  suggestedScales: string[];
  suggestedKey: string | null;
  rootNote: string | null;
}

/**
 * Convert MIDI note number to note name (e.g., 60 -> "C4")
 */
function midiToNoteName(midi: number): string {
  return Note.fromMidi(midi) || `${midi}`;
}

/**
 * Convert MIDI note number to pitch class name (e.g., 60 -> "C")
 */
function midiToPitchClass(midi: number): string {
  const noteName = Note.fromMidi(midi);
  return noteName ? Note.pitchClass(noteName) : '';
}

/**
 * Detect chord from a set of MIDI notes
 */
function detectChord(midiNotes: number[]): { chord: string | null; type: string | null } {
  if (midiNotes.length < 2) {
    return { chord: null, type: null };
  }

  // Get pitch classes (note names without octave)
  const pitchClasses = midiNotes
    .map(midiToPitchClass)
    .filter(pc => pc !== '');

  if (pitchClasses.length < 2) {
    return { chord: null, type: null };
  }

  // Try to detect chord
  const detected = Chord.detect(pitchClasses);

  if (detected.length > 0) {
    const chordName = detected[0];
    // Parse chord name to get root and type
    const parsed = Chord.get(chordName);
    return {
      chord: chordName,
      type: parsed.type || parsed.quality || null
    };
  }

  return { chord: null, type: null };
}

/**
 * Group notes by beat and detect chords
 */
function analyzeChords(
  notes: Array<{ x: number; y: number }>,
  beatsPerChord: number = 1
): ChordInfo[] {
  if (notes.length === 0) {
    return [];
  }

  // Group notes by beat
  const notesByBeat = new Map<number, number[]>();

  for (const note of notes) {
    const beat = Math.floor(note.x / beatsPerChord) * beatsPerChord;
    if (!notesByBeat.has(beat)) {
      notesByBeat.set(beat, []);
    }
    notesByBeat.get(beat)!.push(note.y);
  }

  // Analyze each beat
  const chords: ChordInfo[] = [];

  for (const [beat, midiNotes] of notesByBeat) {
    // Remove duplicates and sort
    const uniqueNotes = [...new Set(midiNotes)].sort((a, b) => a - b);
    const noteNames = uniqueNotes.map(midiToNoteName);
    const { chord, type } = detectChord(uniqueNotes);

    chords.push({
      beat,
      midiNotes: uniqueNotes,
      noteNames,
      chord,
      type
    });
  }

  // Sort by beat
  return chords.sort((a, b) => a.beat - b.beat);
}

/**
 * Convert pitch class number to chroma (0-11)
 */
function noteToChroma(noteName: string): number {
  const chroma = Note.chroma(noteName);
  return chroma !== undefined ? chroma : -1;
}

/**
 * Suggest scales that contain all given pitch classes
 */
function suggestScales(pitchClasses: number[]): string[] {
  if (pitchClasses.length === 0) {
    return [];
  }

  // Convert pitch classes to a Set for fast lookup
  const pitchClassSet = new Set(pitchClasses);

  const suggestions: Array<{ scale: string; coverage: number }> = [];

  // Check common scales for each possible root
  const roots = ['C', 'Db', 'D', 'Eb', 'E', 'F', 'Gb', 'G', 'Ab', 'A', 'Bb', 'B'];
  const scaleTypes = ['major', 'minor', 'dorian', 'phrygian', 'lydian', 'mixolydian', 'locrian', 'harmonic minor', 'melodic minor'];

  for (const root of roots) {
    for (const scaleType of scaleTypes) {
      const scale = Scale.get(`${root} ${scaleType}`);
      if (scale.notes.length === 0) continue;

      // Convert scale notes to pitch classes (0-11)
      const scaleChromaSet = new Set(scale.notes.map(n => noteToChroma(n)).filter(c => c >= 0));

      // Check if all our pitch classes are in this scale
      const allMatch = pitchClasses.every(pc => scaleChromaSet.has(pc));

      if (allMatch) {
        // Coverage = how much of the scale we use
        const coverage = pitchClasses.length / scale.notes.length;
        suggestions.push({
          scale: `${root} ${scaleType}`,
          coverage
        });
      }
    }
  }

  // Sort by coverage (prefer scales where we use more of the notes)
  suggestions.sort((a, b) => b.coverage - a.coverage);

  // Return top 5 suggestions
  return suggestions.slice(0, 5).map(s => s.scale);
}

/**
 * Estimate the most likely key based on pitch classes
 */
function estimateKey(pitchClasses: number[]): string | null {
  if (pitchClasses.length < 3) {
    return null;
  }

  const scales = suggestScales(pitchClasses);

  // Prefer major and minor keys
  const majorOrMinor = scales.find(s => s.endsWith('major') || s.endsWith('minor'));

  return majorOrMinor || scales[0] || null;
}

/**
 * Get the most likely root note from pitch classes
 */
function findRootNote(pitchClasses: number[]): string | null {
  if (pitchClasses.length === 0) {
    return null;
  }

  const key = estimateKey(pitchClasses);
  if (key) {
    // Extract root from key name
    const parts = key.split(' ');
    return parts[0] || null;
  }

  // Fallback: use the first pitch class
  const names = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];
  return names[pitchClasses[0]] || null;
}

/**
 * Full music analysis of notes
 */
export function analyzeMusic(
  notes: Array<{ x: number; y: number }>,
  pitchClasses: number[],
  beatsPerChord: number = 1
): MusicAnalysis {
  const chords = analyzeChords(notes, beatsPerChord);
  const suggestedScales = suggestScales(pitchClasses);
  const suggestedKey = estimateKey(pitchClasses);
  const rootNote = findRootNote(pitchClasses);

  return {
    chords,
    suggestedScales,
    suggestedKey,
    rootNote
  };
}

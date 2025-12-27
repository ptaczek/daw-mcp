/**
 * MCP Tool definitions (JSON schemas).
 * All tools use unified names (no DAW prefix) with optional daw parameter.
 */

import { Tool } from '@modelcontextprotocol/sdk/types.js';
import { Config } from '../config.js';

// Common DAW parameter schema
export const dawParam = {
  daw: {
    type: 'string',
    enum: ['bitwig', 'ableton'],
    description: 'Target DAW (optional - uses default from config if omitted)'
  }
};

/** Generate tool definitions (some depend on config values) */
export function createToolDefinitions(config: Config): Tool[] {
  return [
    // Discovery tool
    {
      name: 'get_daws',
      description: 'Check which DAWs are connected and available. Returns connection status for each DAW and indicates which is the default. IMPORTANT: Call this first to discover available DAWs. When multiple DAWs are connected, you must specify the "daw" parameter in other tool calls to target a specific DAW (e.g., daw: "ableton" or daw: "bitwig"). Without the "daw" parameter, tools will use the default DAW. Each DAW includes grid info: when grid is null, arbitrary note positioning is supported (any float value for x/duration). When grid has a value, note positions snap to the specified stepSize.',
      inputSchema: {
        type: 'object',
        properties: {},
        required: []
      }
    },

    // Project tools
    {
      name: 'get_project_info',
      description: 'Get current project information including BPM, time signature, and playback state',
      inputSchema: {
        type: 'object',
        properties: { ...dawParam },
        required: []
      }
    },
    {
      name: 'transport_set_position',
      description: 'Set playback position in beats',
      inputSchema: {
        type: 'object',
        properties: {
          ...dawParam,
          beats: { type: 'number', description: 'Position in beats from start' }
        },
        required: ['beats']
      }
    },

    // Track tools
    {
      name: 'list_tracks',
      description: 'List all tracks in the project with their properties',
      inputSchema: { type: 'object', properties: { ...dawParam }, required: [] }
    },

    // MIDI Clip tools
    {
      name: 'transpose_clip',
      description: 'Transpose all notes in a clip by a number of semitones. Works on the clip currently selected in DAW\'s UI by default. Provide trackIndex/slotIndex to target a specific clip (adds brief selection delay).',
      inputSchema: {
        type: 'object',
        properties: {
          ...dawParam,
          trackIndex: { type: 'integer', description: 'Track number, 1-based (optional - uses DAW UI selection if omitted)' },
          slotIndex: { type: 'integer', description: 'Clip slot number, 1-based (optional - uses DAW UI selection if omitted)' },
          semitones: { type: 'integer', description: 'Number of semitones (positive = up, negative = down)' }
        },
        required: ['semitones']
      }
    },
    {
      name: 'set_clip_length',
      description: 'Set the length of a clip. Works on the clip currently selected in DAW\'s UI by default. Provide trackIndex/slotIndex to target a specific clip (adds brief selection delay).',
      inputSchema: {
        type: 'object',
        properties: {
          ...dawParam,
          trackIndex: { type: 'integer', description: 'Track number, 1-based (optional - uses DAW UI selection if omitted)' },
          slotIndex: { type: 'integer', description: 'Clip slot number, 1-based (optional - uses DAW UI selection if omitted)' },
          lengthInBeats: { type: 'number', description: 'Clip length in beats' }
        },
        required: ['lengthInBeats']
      }
    },

    // Batch note operations
    {
      name: 'batch_set_notes',
      description: 'Create/modify multiple MIDI notes in one call. Accepts two formats:\n' +
        '- Ultra-lean arrays: [[x, y, velocity, duration], ...] e.g., [[0, 60, 100, 0.5], [4, 64, 80, 0.25]]\n' +
        '- Object format: [{x, y, velocity?, duration?}, ...] for advanced properties\n' +
        'Format is auto-detected. Works on the clip currently selected in DAW\'s UI by default. Provide trackIndex/slotIndex to target a specific clip (adds brief selection delay).',
      inputSchema: {
        type: 'object',
        properties: {
          ...dawParam,
          trackIndex: { type: 'integer', description: 'Track number, 1-based (optional - uses DAW UI selection if omitted)' },
          slotIndex: { type: 'integer', description: 'Clip slot number, 1-based (optional - uses DAW UI selection if omitted)' },
          notes: {
            type: 'array',
            description: 'Array of notes. Use [x, y, velocity, duration] arrays (lean) or {x, y, velocity?, duration?} objects',
            items: {}
          }
        },
        required: ['notes']
      }
    },
    {
      name: 'batch_move_notes',
      description: 'Move multiple MIDI notes in one call. Works on the clip currently selected in DAW\'s UI by default. Provide trackIndex/slotIndex to target a specific clip (adds brief selection delay).',
      inputSchema: {
        type: 'object',
        properties: {
          ...dawParam,
          trackIndex: { type: 'integer', description: 'Track number, 1-based (optional - uses DAW UI selection if omitted)' },
          slotIndex: { type: 'integer', description: 'Clip slot number, 1-based (optional - uses DAW UI selection if omitted)' },
          moves: {
            type: 'array',
            items: {
              type: 'object',
              properties: {
                x: { type: 'integer', description: 'Current step position' },
                y: { type: 'integer', description: 'Current MIDI note number' },
                dx: { type: 'integer', description: 'Steps to move horizontally (positive = right)' },
                dy: { type: 'integer', description: 'Semitones to move vertically (positive = up)' }
              },
              required: ['x', 'y']
            },
            description: 'Array of note moves'
          }
        },
        required: ['moves']
      }
    },
    {
      name: 'batch_clear_notes',
      description: 'Remove MIDI notes from a clip. If notes array omitted or empty, clears ALL notes (replaces clear_all_notes). Works on the clip currently selected in DAW\'s UI by default. Provide trackIndex/slotIndex to target a specific clip (adds brief selection delay).',
      inputSchema: {
        type: 'object',
        properties: {
          ...dawParam,
          trackIndex: { type: 'integer', description: 'Track number, 1-based (optional - uses DAW UI selection if omitted)' },
          slotIndex: { type: 'integer', description: 'Clip slot number, 1-based (optional - uses DAW UI selection if omitted)' },
          notes: {
            type: 'array',
            items: {
              type: 'object',
              properties: {
                x: { type: 'integer', description: 'Step position' },
                y: { type: 'integer', description: 'MIDI note number' }
              },
              required: ['x', 'y']
            },
            description: 'Array of notes to clear (optional - clears ALL notes if omitted or empty)'
          }
        },
        required: []
      }
    },
    {
      name: 'batch_set_note_properties',
      description: 'Set properties on multiple notes in one call (velocity, duration, gain, pan, pressure, timbre, transpose, chance, muted). Works on the clip currently selected in DAW\'s UI by default. Provide trackIndex/slotIndex to target a specific clip (adds brief selection delay).',
      inputSchema: {
        type: 'object',
        properties: {
          ...dawParam,
          trackIndex: { type: 'integer', description: 'Track number, 1-based (optional - uses DAW UI selection if omitted)' },
          slotIndex: { type: 'integer', description: 'Clip slot number, 1-based (optional - uses DAW UI selection if omitted)' },
          notes: {
            type: 'array',
            items: {
              type: 'object',
              properties: {
                x: { type: 'integer', description: 'Step position' },
                y: { type: 'integer', description: 'MIDI note number' },
                velocity: { type: 'number', description: 'Velocity (0.0 to 1.0)' },
                duration: { type: 'number', description: 'Duration in beats' },
                gain: { type: 'number', description: 'Gain (0.0 to 1.0)' },
                pan: { type: 'number', description: 'Pan (-1.0 to 1.0)' },
                pressure: { type: 'number', description: 'Pressure (0.0 to 1.0)' },
                timbre: { type: 'number', description: 'Timbre (-1.0 to 1.0)' },
                transpose: { type: 'number', description: 'Transpose in semitones' },
                chance: { type: 'number', description: 'Chance (0.0 to 1.0)' },
                muted: { type: 'boolean', description: 'Mute state' }
              },
              required: ['x', 'y']
            },
            description: 'Array of notes with properties to set'
          }
        },
        required: ['notes']
      }
    },

    // Higher-level operations
    {
      name: 'transpose_range',
      description: 'Transpose notes within a step range. Reads notes, filters by range, and moves them. Works on the clip currently selected in DAW\'s UI by default. Provide trackIndex/slotIndex to target a specific clip (adds brief selection delay).',
      inputSchema: {
        type: 'object',
        properties: {
          ...dawParam,
          trackIndex: { type: 'integer', description: 'Track number, 1-based (optional - uses DAW UI selection if omitted)' },
          slotIndex: { type: 'integer', description: 'Clip slot number, 1-based (optional - uses DAW UI selection if omitted)' },
          startStep: { type: 'integer', description: 'Start step position (inclusive)' },
          endStep: { type: 'integer', description: 'End step position (inclusive)' },
          semitones: { type: 'integer', description: 'Semitones to transpose (positive = up, negative = down)' },
          pitchFilter: { type: 'integer', description: 'Optional: only transpose notes at this MIDI pitch' }
        },
        required: ['startStep', 'endStep', 'semitones']
      }
    },
    {
      name: 'batch_operations',
      description: 'Execute multiple heterogeneous operations in sequence (set, move, clear, transpose_clip). Works on the clip currently selected in DAW\'s UI by default. Provide trackIndex/slotIndex to target a specific clip (adds brief selection delay).',
      inputSchema: {
        type: 'object',
        properties: {
          ...dawParam,
          trackIndex: { type: 'integer', description: 'Track number, 1-based (optional - uses DAW UI selection if omitted)' },
          slotIndex: { type: 'integer', description: 'Clip slot number, 1-based (optional - uses DAW UI selection if omitted)' },
          operations: {
            type: 'array',
            items: {
              type: 'object',
              properties: {
                action: {
                  type: 'string',
                  enum: ['set', 'move', 'clear', 'transpose_clip'],
                  description: 'Operation type'
                },
                x: { type: 'integer', description: 'Step position (for set, move, clear)' },
                y: { type: 'integer', description: 'MIDI note number (for set, move, clear)' },
                dx: { type: 'integer', description: 'Steps to move (for move)' },
                dy: { type: 'integer', description: 'Semitones to move (for move)' },
                velocity: { type: 'integer', description: 'Velocity (for set)' },
                duration: { type: 'number', description: 'Duration (for set)' },
                semitones: { type: 'integer', description: 'Semitones (for transpose_clip)' }
              },
              required: ['action']
            },
            description: 'Array of operations to execute'
          }
        },
        required: ['operations']
      }
    },

    // Batch clip operations
    {
      name: 'batch_get_notes',
      description: 'Read notes from one or more clips. If clips array omitted, uses cursor clip. Returns ultra-lean format by default: [[x, y, velocity, duration], ...]. Use verbose=true for full note properties.',
      inputSchema: {
        type: 'object',
        properties: {
          ...dawParam,
          trackIndex: { type: 'integer', description: 'Track number, 1-based (single clip shorthand, optional - uses DAW UI selection if omitted)' },
          slotIndex: { type: 'integer', description: 'Clip slot number, 1-based (single clip shorthand, optional - uses DAW UI selection if omitted)' },
          clips: {
            type: 'array',
            items: {
              type: 'object',
              properties: {
                trackIndex: { type: 'integer', description: 'Track number, 1-based' },
                slotIndex: { type: 'integer', description: 'Clip slot number, 1-based' }
              },
              required: ['trackIndex', 'slotIndex']
            },
            description: 'Array of clips to read notes from (optional - uses trackIndex/slotIndex or cursor clip if omitted)'
          },
          verbose: { type: 'boolean', description: 'If true, return full note properties as objects. Default: false (returns lean arrays)' }
        },
        required: []
      }
    },
    {
      name: 'get_clip_stats',
      description: 'Get statistics about a clip without reading all notes. Returns pitch classes, velocity/duration ranges, beat grid, and density. Token-efficient for orientation before detailed analysis. Works on cursor clip by default.',
      inputSchema: {
        type: 'object',
        properties: {
          ...dawParam,
          trackIndex: { type: 'integer', description: 'Track number, 1-based (optional - uses DAW UI selection if omitted)' },
          slotIndex: { type: 'integer', description: 'Clip slot number, 1-based (optional - uses DAW UI selection if omitted)' }
        },
        required: []
      }
    },
    {
      name: 'batch_list_clips',
      description: 'List clips WITH CONTENT from one or more tracks. If trackIndices omitted, uses cursor track. Only returns slots that have clips - empty slots are not listed. To find the first empty slot, use max(slotIndex) + 1.',
      inputSchema: {
        type: 'object',
        properties: {
          ...dawParam,
          trackIndex: { type: 'integer', description: 'Track number, 1-based (single track shorthand, optional - uses DAW UI selection if omitted)' },
          trackIndices: {
            type: 'array',
            items: { type: 'integer' },
            description: 'Array of track numbers, 1-based (optional - uses trackIndex or cursor track if omitted)'
          }
        },
        required: []
      }
    },
    {
      name: 'batch_create_clips',
      description: `Create clips safely with two modes:\n` +
        `- Mode A (no slotIndex): Finds empty slots automatically from cursor position, within actual project scene count (not bank window of ${config.bitwig.scenes})\n` +
        `- Mode B (with slotIndex): Creates at specific slots, fails if occupied unless overwrite=true\n` +
        `Returns created slot positions for subsequent note operations. Uses DAW's UI selection for cursor track if trackIndex omitted.`,
      inputSchema: {
        type: 'object',
        properties: {
          ...dawParam,
          clips: {
            type: 'array',
            items: {
              type: 'object',
              properties: {
                trackIndex: { type: 'integer', description: 'Track number, 1-based (optional - uses DAW UI selection if omitted)' },
                slotIndex: { type: 'integer', description: 'Slot number, 1-based (optional - finds empty slot within scene count if omitted)' },
                lengthInBeats: { type: 'number', description: 'Clip length in beats (default: 4)' },
                name: { type: 'string', description: 'Clip name (optional)' }
              }
            },
            description: 'Array of clips to create. Omit slotIndex to auto-find empty slots. Optionally set clip name.'
          },
          overwrite: { type: 'boolean', description: 'If true, replace existing clips. Default: false (fail if slot has content)' }
        }
      }
    },
    {
      name: 'batch_delete_clips',
      description: 'Delete multiple clips in one call. If clips array is empty or omitted, deletes clip at DAW\'s UI selection.',
      inputSchema: {
        type: 'object',
        properties: {
          ...dawParam,
          clips: {
            type: 'array',
            items: {
              type: 'object',
              properties: {
                trackIndex: { type: 'integer', description: 'Track number, 1-based (optional - uses DAW UI selection if omitted)' },
                slotIndex: { type: 'integer', description: 'Clip slot number, 1-based (optional - uses DAW UI selection if omitted)' }
              }
            },
            description: 'Array of clips to delete. If empty/omitted, deletes at DAW UI selection.'
          }
        }
      }
    },

    // Generative tools
    {
      name: 'batch_create_euclid_pattern',
      description: 'Create Euclidean rhythm patterns across multiple tracks and clips in one call. ' +
        'Reduces round-trips when creating drum patterns across separate tracks. ' +
        'If slotIndex omitted, creates new clips safely. If slotIndex provided, updates existing clip (clears only pitches being patterned).',
      inputSchema: {
        type: 'object',
        properties: {
          ...dawParam,
          tracks: {
            type: 'array',
            items: {
              type: 'object',
              properties: {
                trackIndex: { type: 'integer', description: 'Track number, 1-based' },
                clips: {
                  type: 'array',
                  items: {
                    type: 'object',
                    properties: {
                      slotIndex: { type: 'integer', description: 'Clip slot, 1-based (optional - creates new clip if omitted)' },
                      lengthBeats: { type: 'number', description: 'Clip length in beats (default: 4)' },
                      name: { type: 'string', description: 'Clip name (optional, for new clips)' },
                      patterns: {
                        type: 'array',
                        items: {
                          type: 'object',
                          properties: {
                            hits: { type: 'integer', description: 'Number of hits to distribute' },
                            steps: { type: 'integer', description: 'Total steps (16 = 1 bar at 1/16th)' },
                            pitch: { type: 'integer', description: 'MIDI note number' },
                            velocity: { type: 'integer', description: 'Note velocity 0-127 (default: 100)' },
                            rotate: { type: 'integer', description: 'Rotate pattern by N steps (default: 0)' },
                            duration: { type: 'number', description: 'Note duration in beats (default: auto)' }
                          },
                          required: ['hits', 'steps', 'pitch']
                        },
                        description: 'Euclidean patterns for this clip'
                      }
                    },
                    required: ['patterns']
                  },
                  description: 'Clips to create/update on this track'
                }
              },
              required: ['trackIndex', 'clips']
            },
            description: 'Array of tracks with their clips and patterns'
          }
        },
        required: ['tracks']
      }
    },

    // Batch track operations
    {
      name: 'batch_create_tracks',
      description: 'Create multiple tracks in one call. Replaces bitwig_create_track.',
      inputSchema: {
        type: 'object',
        properties: {
          ...dawParam,
          tracks: {
            type: 'array',
            items: {
              type: 'object',
              properties: {
                type: {
                  type: 'string',
                  enum: ['instrument', 'audio', 'effect'],
                  description: 'Type of track to create'
                },
                name: { type: 'string', description: 'Optional track name' },
                position: { type: 'integer', description: 'Position to insert, 1-based (-1 for end)' }
              },
              required: ['type']
            },
            description: 'Array of tracks to create'
          }
        },
        required: ['tracks']
      }
    },
    {
      name: 'batch_set_track_properties',
      description: 'Set properties on multiple tracks in one call. Replaces set_track_name, set_track_volume, set_track_mute, set_track_solo.',
      inputSchema: {
        type: 'object',
        properties: {
          ...dawParam,
          tracks: {
            type: 'array',
            items: {
              type: 'object',
              properties: {
                index: { type: 'integer', description: 'Track number, 1-based' },
                name: { type: 'string', description: 'New track name' },
                volume: { type: 'number', description: 'Volume (0.0 to 1.0)' },
                mute: { type: 'boolean', description: 'Mute state' },
                solo: { type: 'boolean', description: 'Solo state' }
              },
              required: ['index']
            },
            description: 'Array of tracks with properties to set'
          }
        },
        required: ['tracks']
      }
    },
    {
      name: 'batch_delete_tracks',
      description: 'Delete multiple tracks in one call. Deletes in reverse order to preserve indices. Replaces bitwig_delete_track.',
      inputSchema: {
        type: 'object',
        properties: {
          ...dawParam,
          trackIndices: {
            type: 'array',
            items: { type: 'integer' },
            description: 'Array of track numbers, 1-based'
          }
        },
        required: ['trackIndices']
      }
    }
  ];
}

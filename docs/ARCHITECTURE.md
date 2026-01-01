# DAW MCP Architecture

## Overview

MCP server for controlling DAWs (Bitwig Studio, Ableton Live) from Claude.

```
                         Claude Code
                              │
                        MCP Protocol (stdio)
                              ▼
                ┌─────────────────────────────┐
                │   MCP Server (TypeScript)   │
                │  • Unified tool interface   │
                │  • Music analysis (Tonal.js)│
                │  • Euclidean rhythm gen     │
                └─────────────────────────────┘
                         │         │
            TCP :8181 ───┘         └─── TCP :8182
                 │                        │
                 ▼                        ▼
    ┌─────────────────────┐   ┌─────────────────────┐
    │  Bitwig Extension   │   │  Ableton Extension  │
    │       (Java)        │   │      (Python)       │
    │  • JSON-RPC server  │   │  • JSON-RPC server  │
    │  • Bitwig API       │   │  • Live API         │
    └─────────────────────┘   └─────────────────────┘
              │                        │
              ▼                        ▼
       Bitwig Studio            Ableton Live
```

## Components

### 1. MCP Server (TypeScript)

Location: `mcp-server/`

The bridge between Claude and DAW extensions:
- Exposes unified MCP tools (no DAW prefix)
- Optional `daw` parameter for explicit DAW selection
- Lazy TCP connections (connect on first use)
- Music theory analysis via Tonal.js
- Euclidean rhythm pattern generation

Key files:
- `src/index.ts` - Entry point
- `src/server.ts` - MCP server setup and request routing
- `src/tools/definitions.ts` - Tool JSON schemas
- `src/handlers/` - Tool handlers (batch-notes, batch-clips, euclid, etc.)
- `src/helpers/` - Utilities (indices, clip-selection, command-map)
- `src/daw-client.ts` - TCP client abstraction
- `src/config.ts` - Configuration loading
- `src/music-analysis.ts` - Tonal.js chord/scale detection
- `src/euclidean.ts` - Rhythm pattern generation

### 2. Bitwig Extension (Java)

Location: `bitwig-extension/`

A `.bwextension` file that runs inside Bitwig Studio:
- Registers as a controller (no hardware needed)
- TCP server on `localhost:8181`
- JSON-RPC 2.0 protocol
- Full access to Bitwig's Controller API

Key classes:
- `BitwigMCPExtension` - Entry point, creates API objects
- `server/MCPServer` - TCP server, JSON-RPC handling
- `handlers/ClipHandler` - MIDI note read/write
- `handlers/CommandDispatcher` - Routes commands to handlers
- `config/ConfigReader` - Configuration loading

### 3. Ableton Extension (Python)

Location: `ableton-extension/`

A MIDI Remote Script that runs inside Ableton Live:
- Non-blocking TCP server on `localhost:8182`
- 100ms polling via `schedule_message()` (Live doesn't support threading)
- JSON-RPC 2.0 protocol (same as Bitwig)

Key files:
- `__init__.py` - Entry point, `create_instance()`
- `manager.py` - ControlSurface subclass, tick scheduler
- `tcp_server.py` - Non-blocking TCP server
- `dispatcher.py` - Routes commands to handlers
- `handlers/clip.py` - MIDI note operations

## Communication Protocol

JSON-RPC 2.0 over TCP, newline-delimited.

**Request:**
```json
{"jsonrpc": "2.0", "id": "1", "method": "clip.getNotes", "params": {"trackIndex": 1, "slotIndex": 1}}
```

**Response:**
```json
{"jsonrpc": "2.0", "id": "1", "result": {"notes": [[0, 60, 100, 0.5]], "count": 1}}
```

**Error:**
```json
{"jsonrpc": "2.0", "id": "1", "error": {"code": -32000, "message": "No clip at position"}}
```

See `PROTOCOL.md` for full method reference.

## Unified Tool API

Tools use generic names with optional `daw` parameter:

```typescript
// Uses default DAW from config
batch_get_notes()
batch_set_notes({notes: [[0, 60, 100, 0.5]]})

// Explicit DAW selection
batch_get_notes({daw: "ableton"})
batch_set_notes({daw: "bitwig", notes: [...]})
```

### Core Tools (enabled by default)

| Category | Tools |
|----------|-------|
| Discovery | `get_daws` |
| Project | `get_project_info` |
| Tracks | `list_tracks` |
| Clips | `batch_list_clips`, `batch_create_clips`, `batch_delete_clips`, `set_clip_length` |
| MIDI Notes | `batch_get_notes`, `batch_set_notes`, `batch_clear_notes` |
| Analysis | `get_clip_stats` (includes Tonal.js chord/scale detection, grid detection with confidence) |
| Generative | `batch_create_euclid_pattern` |

### Optional Tools (disabled by default)

Enable in config with `"tool_name": true`:

| Tool | Use Case |
|------|----------|
| `batch_move_notes` | Shift note positions |
| `batch_set_note_properties` | Velocity, duration, MPE |
| `transpose_clip` | Transpose all notes |
| `transpose_range` | Transpose notes in range |
| `batch_create_tracks` | Create multiple tracks |
| `batch_delete_tracks` | Delete tracks |
| `batch_set_track_properties` | Volume, pan, mute, solo |
| `transport_set_position` | Set playback position |

## Configuration

Shared config file for all components:

| Platform | Path |
|----------|------|
| Linux | `~/.config/daw-mcp/config.json` |
| macOS | `~/Library/Application Support/daw-mcp/config.json` |
| Windows | `%APPDATA%\daw-mcp\config.json` |

See `docs/example-config.json` for all options.

## Feature Parity

### Core MIDI Operations (fully implemented)

| Feature | Bitwig | Ableton |
|---------|--------|---------|
| Note velocity/duration/mute | Yes | Yes |
| Note gain/pan/timbre/chance/transpose | Yes | No (API limitation) |
| Cursor clip tracking | Instant | ~100ms polling |

### Implementation Gaps

Features that are possible but not yet implemented:

| Feature | Bitwig | Ableton | Priority |
|---------|--------|---------|----------|
| Transport stop | Yes | Missing | Medium |
| Track select | Yes | Missing | Low |
| Track pan/arm | Yes | Missing | Low |
| Delete scene | Missing | Missing | Low |

**Note:** Scene count and create scene are now implemented in both DAWs. `batch_create_clips` automatically creates scenes when needed.

### What's Actually Needed

Real-world usage has shown the essential feature set:

**Essential (v1.0 target) - DONE:**
- Track: name, select (done)
- Clips: full MIDI note manipulation (done)
- Scenes: count, create (done)
- Project: tempo/time signature read (done via `get_project_info`)

**Nice-to-have:**
- Transport: stop (Bitwig may have issues with clip/note operations during playback - needs verification)
- Track: color

**Over-engineered (Bitwig-only, rarely used):**
- MPE note properties (gain, pan, pressure, timbre)
- Note chance/probability
- Per-note transpose

## Future Enhancements

**Later:**
- Device/plugin parameter control
- Audio clip support

## Out of Scope

- **Arrangement view** - Bitwig API doesn't expose it; session view is better suited for AI workflows anyway
- **Reaper** - No clip launcher paradigm; would require MIDI/OSC which adds complexity for marginal benefit

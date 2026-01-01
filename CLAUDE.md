# DAW MCP Project

MCP server for controlling DAWs (Bitwig Studio, Ableton Live) from Claude.

## Scope: Session View / Clip Launcher Only

**This project intentionally targets only the clip launcher (Bitwig) / session view (Ableton) paradigm.** Arrangement view is out of scope.

**Rationale:**
- Clip launcher provides discrete, addressable units (track × slot) - ideal for AI-driven workflows
- Arrangement view has continuous timeline addressing - fragile, less intuitive for AI
- Bitwig's Control Surface API doesn't expose arrangement clips at all
- Ableton's API has arrangement access, but asymmetric support across DAWs is undesirable
- The user arranges clips into songs - that's human creative territory

**Implications:**
- No arrangement clip creation, reading, or note manipulation
- No Reaper support (Reaper lacks a clip launcher paradigm entirely)
- MIDI/OSC alternatives were considered but rejected - not worth the complexity

**Workflow:** AI generates clips in launcher slots → User arranges them into songs on timeline.

## Project Structure

- `bitwig-extension/` - Java extension for Bitwig Studio (TCP server on port 8181)
- `ableton-extension/` - Python MIDI Remote Script for Ableton Live (port 8182)
- `mcp-server/` - TypeScript MCP server that bridges Claude to DAW extensions

## Building (Development)

```bash
# Bitwig extension
cd bitwig-extension && gradle build && gradle copyExtension

# MCP server
cd mcp-server && npm install && npm run build
```

## Release Build

Creates a distributable ZIP with all components:

```bash
./scripts/release.sh 1.0.0
```

**Output:** `release/daw-mcp-1.0.0.zip` (~325KB)

**Contents:**
- `BitwigMCP.bwextension` - Java extension (cross-platform, single file)
- `AbletonMCP/` - Python Remote Scripts (cross-platform)
- `mcp-server.js` - Bundled MCP server (~215KB, requires Node.js)
- `config.example.json` - Example configuration
- `README.md` - Installation instructions

**How it works:**
1. Builds Bitwig extension via Gradle
2. Bundles MCP server with esbuild into single JS file
3. Copies Ableton Python scripts
4. Creates ZIP archive

**User installation:**
1. Extract ZIP
2. Copy `BitwigMCP.bwextension` to Bitwig extensions folder
3. Copy `AbletonMCP/` to Ableton Remote Scripts folder
4. Add to Claude config:
   ```json
   {
     "mcpServers": {
       "daw": {
         "command": "node",
         "args": ["/path/to/mcp-server.js"]
       }
     }
   }
   ```

## Architecture

```
Claude <-> MCP Server (stdio) <-> TCP <-> DAW Extension <-> DAW API
                                   │
                                   ├── :8181 Bitwig (Java)
                                   └── :8182 Ableton (Python)
```

## Key Files

### Bitwig Extension (Java)

| File | Purpose |
|------|---------|
| `bitwig-extension/src/main/java/com/pxaudio/bitwigmcp/BitwigMCPExtension.java` | Main extension entry point, creates API objects |
| `bitwig-extension/src/main/java/com/pxaudio/bitwigmcp/server/MCPServer.java` | TCP server, JSON-RPC handling |
| `bitwig-extension/src/main/java/com/pxaudio/bitwigmcp/handlers/ClipHandler.java` | MIDI note read/write operations |
| `bitwig-extension/src/main/java/com/pxaudio/bitwigmcp/handlers/CommandDispatcher.java` | Routes commands to handlers |
| `bitwig-extension/.../config/ConfigReader.java` | Java config file loading |

### Ableton Extension (Python)

| File | Purpose |
|------|---------|
| `ableton-extension/__init__.py` | Entry point for Live Remote Script |
| `ableton-extension/manager.py` | ControlSurface subclass, tick scheduler |
| `ableton-extension/tcp_server.py` | Non-blocking TCP server |
| `ableton-extension/handlers/clip.py` | MIDI note operations |

**Linux Development:** Ableton Live 12 runs via Lutris in Wine prefix at `/home/pta/Games/ableton`. Note: Wine doesn't follow symlinks, so files must be copied:
```bash
cp -r /home/pta/Develop/audio/daw-mcp/ableton-extension/* \
  /home/pta/Games/ableton/drive_c/users/pta/Documents/Ableton/User\ Library/Remote\ Scripts/AbletonMCP/
```

### MCP Server (TypeScript)

| File | Purpose |
|------|---------|
| `mcp-server/src/index.ts` | MCP tool definitions and command mapping |
| `mcp-server/src/daw-client.ts` | TCP client for DAW communication (lazy connections) |
| `mcp-server/src/config.ts` | Configuration file loading |
| `mcp-server/src/music-analysis.ts` | Tonal.js chord/scale/key detection |
| `mcp-server/src/euclidean.ts` | Euclidean rhythm generation (uses Tonal.js RhythmPattern) |

## Configuration

Both extensions and the MCP server read from a shared config file:

| Platform | Path |
|----------|------|
| Linux | `~/.config/daw-mcp/config.json` |
| macOS | `~/Library/Application Support/daw-mcp/config.json` |
| Windows | `%APPDATA%\daw-mcp\config.json` |

**Example config:**
```json
{
  "defaultDaw": "bitwig",
  "gridResolution": 16,
  "bitwig": {
    "port": 8181,
    "cursorClipLengthBeats": 128,
    "scenes": 128
  },
  "ableton": {
    "port": 8182
  },
  "mcp": {
    "selectionDelayMs": 400,
    "requestTimeoutMs": 10000
  },
  "tools": {
    "transpose_clip": true,
    "batch_operations": false
  }
}
```

### Grid Resolution

The global `gridResolution` setting affects both DAWs:

| gridResolution | stepSize | Musical Value |
|----------------|----------|---------------|
| 4              | 1.0      | 1/4 note      |
| 8              | 0.5      | 1/8 note      |
| 16             | 0.25     | 1/16 note     |
| 32             | 0.125    | 1/32 note     |

**Formulas:**
- `stepSize = 4 / gridResolution`
- `clipSteps = cursorClipLengthBeats × (gridResolution / 4)`

**Per-DAW behavior:**
- **Bitwig:** Notes are quantized to the grid (API limitation). The step size determines note positioning precision.
- **Ableton:** Notes can be placed at arbitrary positions. The grid is used only for `get_clip_stats` calculations (`beatGrid` and `density`).

**Defaults:** If config file is missing, all defaults are used. If a section is missing, that section uses defaults. Tools not listed default to enabled.

**Tool filtering:** Set any tool to `false` to disable it. Disabled tools won't appear in MCP tools list.

## Protocol

JSON-RPC 2.0 over TCP. Methods use dot notation: `track.list`, `clip.setNote`, `clip.getNotes`, etc.

## Unified Tool API

Tools use unified names (no DAW prefix) with an optional `daw` parameter:

```typescript
// Uses default DAW from config
batch_get_notes()
batch_list_clips()

// Explicit DAW selection for interop
batch_get_notes({daw: "ableton"})
batch_set_notes({daw: "bitwig", notes: [[0, 60, 100, 0.5]]})
```

### Available Tools (Enabled by Default)

| Category | Tools |
|----------|-------|
| Discovery | `get_daws` - check connected DAWs and default |
| Project | `get_project_info` |
| Tracks | `list_tracks` |
| Clips | `batch_list_clips`, `batch_create_clips`, `batch_delete_clips`, `set_clip_length` |
| MIDI Notes | `batch_get_notes`, `batch_set_notes`, `batch_clear_notes` |
| Analysis | `get_clip_stats` - stats + Tonal.js chord/scale/key detection |
| Generative | `batch_create_euclid_pattern` - Euclidean rhythms (multi-track/clip) |
| Smart Ops | `batch_operations` |

### Optional Tools (Disabled by Default)

Enable in config with `"tool_name": true`:

| Tool | Use Case |
|------|----------|
| `batch_move_notes` | Shift note positions |
| `batch_set_note_properties` | Velocity, duration, MPE properties |
| `transpose_clip` | Transpose all notes in clip |
| `transpose_range` | Transpose notes in step range |
| `batch_create_tracks` | Create multiple tracks |
| `batch_delete_tracks` | Delete multiple tracks |
| `batch_set_track_properties` | Volume, pan, mute, solo |
| `transport_set_position` | Set playback position |

## Bitwig API Documentation

Local JavaDoc: `/opt/bitwig-studio/resources/doc/control-surface/api/index.html`

Key interfaces for MIDI note manipulation:
- `Clip` - clip operations, note grid, observers
- `CursorClip` - extends Clip with navigation (created in init, used for note editing)
- `NoteStep` - individual note properties (velocity, duration, pan, gain, chance, timbre, transpose, etc.)

### Bitwig API Constraints

Many Bitwig API objects can only be created during `init()`:
- `createLauncherCursorClip()` - must be called in init
- `addNoteStepObserver()` - must be registered in init
- Track banks, cursor tracks, transport - all created in init

The extension creates these during initialization and handlers use the pre-created objects.

### Optional Clip Selection - Cursor Follows User

All clip-related operations support optional `trackIndex/slotIndex` parameters. When omitted, operations use the cursor selection (the clip selected in DAW's UI).

**How it works:**
- The cursor clip is created from `cursorTrack` which follows user selection
- When `trackIndex/slotIndex` are omitted, the MCP server calls `clip.getSelection` to get current cursor position
- If no clip is selected, a clear error message is returned

**Examples:**
```typescript
// Use cursor selection (whatever user has selected in DAW)
batch_get_notes()
batch_set_notes({notes: [[0, 60, 100, 0.5]]})

// Explicit selection (1-based: track 1 = first track, slot 3 = third slot)
batch_get_notes({trackIndex: 1, slotIndex: 3})
batch_set_notes({trackIndex: 1, slotIndex: 3, notes: [[0, 60, 100, 0.5]]})

// List clips from cursor track
batch_list_clips()  // Uses cursor track
batch_list_clips({trackIndex: 4})  // Fourth track

// Cross-DAW operations
batch_get_notes({daw: "bitwig", trackIndex: 1, slotIndex: 1})
batch_set_notes({daw: "ableton", notes: [[0, 60, 100, 0.5]]})
```

**Affected tools:**
- `batch_get_notes`, `batch_set_notes`, `batch_clear_notes`, `set_clip_length`
- `batch_list_clips` (trackIndex only)
- `get_clip_stats`, `batch_create_euclid_pattern`
- Optional: `transpose_clip`, `batch_move_notes`, `batch_set_note_properties`, `transpose_range`, `batch_operations`

### Note Reading (Pull-Based)

Notes are read via direct `getStep()` queries (not observer-based):
1. `ClipHandler.getNotes()` iterates through all step positions
2. For each position, `clip.getStep(channel, x, y).state()` is checked
3. Notes with `NoteOn` state are collected and returned

This pull-based approach is reliable and synchronous, avoiding race conditions with the async observer pattern.

### Clip Selection Timing

When providing explicit `trackIndex/slotIndex` parameters (instead of using cursor), a delay is added to allow the cursor clip to follow the selection (configurable via `mcp.selectionDelayMs`, default 400ms). This only applies when parameters are explicitly provided. Using cursor selection (omitting parameters) is instant. See `docs/OPTIMIZATION_IDEAS.md` Section 8 for observer-based settlement detection approach (deferred).

### Ultra-Lean Note Format

**Read (`batch_get_notes`)** - default format:
```json
{"notes": [[0, 60, 100, 0.5], [4, 64, 80, 0.25]], "count": 2}
```
Format: `[x, y, velocity (0-127), duration]`. Use `verbose=true` for full properties.

**Write (`batch_set_notes`)** - accepts both:
```json
{"notes": [[0, 60, 100, 0.5]]}           // Ultra-lean (preferred)
{"notes": [{"x": 0, "y": 60, ...}]}      // Object format
```

~10-15x token reduction vs verbose format.

### Minimal Success Responses

All write operations return only `{"success": true}` on success. Error details included only on failure.

### Music Analysis (Tonal.js)

`get_clip_stats` includes music theory analysis via Tonal.js:

```json
{
  "noteCount": 24,
  "pitchClasses": [0, 2, 3, 5, 7, 8, 10],
  "analysis": {
    "chords": [{"beat": 0, "chord": "Cm", "type": "minor"}, ...],
    "suggestedScales": ["C minor", "Eb major", "F dorian"],
    "suggestedKey": "C minor",
    "rootNote": "C"
  }
}
```

### Euclidean Rhythm Patterns

`batch_create_euclid_pattern` generates mathematically distributed rhythms:

```typescript
// Classic drum pattern with kick, hihat, snare
batch_create_euclid_pattern({
  lengthBeats: 4,
  patterns: [
    { hits: 4, steps: 16, pitch: 36, velocity: 100 },           // kick: 4/4
    { hits: 7, steps: 16, pitch: 38, velocity: 80 },            // hihat: euclidean 7/16
    { hits: 2, steps: 16, pitch: 37, velocity: 90, rotate: 4 }  // snare: backbeat
  ]
})
```

Common patterns: tresillo (3,8), cinquillo (5,8), west african bell (7,16).

### Safe Clip Creation

`batch_create_clips` prevents accidental overwrites with two modes:

**Mode A: Auto-find empty slots** (omit `slotIndex`)
```typescript
// Creates 3 clips at first available empty slots from cursor
batch_create_clips({
  clips: [
    {lengthInBeats: 4, name: "Intro"},
    {lengthInBeats: 8, name: "Verse A"},
    {lengthInBeats: 16}
  ]
})
// Returns: {createdClips: [{trackIndex: 1, slotIndex: 5, lengthInBeats: 4, name: "Intro"}, ...]}
```

**Mode B: Targeted creation** (provide `slotIndex`)
```typescript
// Fails if slot 3 has content (unless overwrite=true)
batch_create_clips({
  clips: [{trackIndex: 1, slotIndex: 3, lengthInBeats: 4, name: "Bass Loop"}]
})
// Error: "Slot 3 on track 1 has content. Use overwrite=true to replace."
```

**Key behaviors:**
- Empty slots are found within actual project scene count (not bank size of 128)
- Returns `createdClips` array with exact positions for subsequent note operations
- Use `overwrite: true` to explicitly replace existing clips
- Mode A advances cursor position automatically when creating multiple clips
- Optional `name` parameter sets clip name after creation

### NoteStep Properties Available

Read/write:
- velocity, duration, gain, pan, pressure, timbre, transpose
- chance (probability), muted state
- position (x = step, y = pitch)

Read-only via observer:
- state (NoteOn, NoteContinue, Empty)
- channel

### Ableton Live Limitations

Some Bitwig features are not available in Ableton's Live API:
- Note chance, timbre, transpose, gain, pan (per-note MPE properties)
- Cursor clip tracking is polling-based (~100ms vs instant in Bitwig)

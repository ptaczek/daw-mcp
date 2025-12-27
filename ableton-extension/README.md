# Ableton Live Extension

Python MIDI Remote Script for controlling Ableton Live via MCP.

## Architecture

```
Claude <-> MCP Server (TypeScript) <-> TCP :8182 <-> This Script <-> Live API
```

Key design decisions:
- Non-blocking TCP socket (Live's Python doesn't support threading)
- 100ms polling via `schedule_message()` cooperative scheduler
- JSON-RPC 2.0 protocol (same as Bitwig extension)

## Installation

Copy this folder to your Remote Scripts directory:

- **Windows:** `C:\Users\<username>\Documents\Ableton\User Library\Remote Scripts\AbletonMCP\`
- **macOS:** `/Users/<username>/Music/Ableton/User Library/Remote Scripts/AbletonMCP/`
- **Linux (Wine/Lutris):** Copy files (symlinks don't work in Wine):
  ```bash
  cp -r /path/to/daw-mcp/ableton-extension/* \
    <wine_prefix>/drive_c/users/<user>/Documents/Ableton/User\ Library/Remote\ Scripts/AbletonMCP/
  ```

Then select "AbletonMCP" as a control surface in Live's preferences (Link, Tempo, MIDI tab).

## File Structure

| File | Purpose |
|------|---------|
| `__init__.py` | Entry point, `create_instance()` |
| `manager.py` | ControlSurface subclass, tick scheduler |
| `tcp_server.py` | Non-blocking TCP server, JSON-RPC handling |
| `dispatcher.py` | Routes JSON-RPC commands to handlers |
| `handlers/base.py` | Base handler class |
| `handlers/project.py` | Project info (BPM, time signature) |
| `handlers/transport.py` | Playback state |
| `handlers/track.py` | Track listing and properties |
| `handlers/clip.py` | MIDI note read/write operations |

## Supported Commands

- `project.info` - Get BPM, time signature, playback state
- `track.list` - List all tracks with properties
- `clip.list` - List clips on a track
- `clip.create` - Create new clips
- `clip.delete` - Delete clips
- `clip.setLength` - Set clip length
- `clip.getNotes` - Read MIDI notes from clip
- `clip.setNotes` - Write MIDI notes to clip
- `clip.clearNotes` - Clear notes from clip
- `clip.getSelection` - Get current clip selection

## Limitations vs Bitwig

Some Bitwig features are not available in Ableton's Live API:
- Per-note MPE properties (chance, timbre, transpose, gain, pan)
- Cursor clip tracking is polling-based (~100ms vs instant in Bitwig)

## References

- [AbletonOSC](https://github.com/ideoforms/AbletonOSC) - Reference implementation (MIT licensed)
- Ableton Push2 scripts - Official API usage examples

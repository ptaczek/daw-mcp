# DAW MCP

Bring AI into your music production workflow. DAW MCP connects Claude to your DAW, letting you have a conversation about your music while Claude reads, creates, and modifies MIDI clips in real-time.

<!-- TODO: Add demo GIF showing a conversation creating a bassline variation -->

## What Can You Do With This?

**Get unstuck.** Staring at an empty clip? Describe what you're going for and let Claude sketch out an idea. It won't be perfect, but it's a starting point — and starting points break writer's block.

**Explore variations.** Have a 2-bar loop you like? Ask Claude to extend it to 8 bars with fills, or create three different variations to try. Keep what works, discard what doesn't.

**Add harmonic richness.** Claude understands music theory. Ask it to add chord extensions, create a counter-melody, or suggest what scale your clip is in.

**Build energy.** Create buildups, add increasingly expressive phrases, design call-and-response patterns — all through natural conversation.

**Move between DAWs.** With both Bitwig and Ableton connected, you can read notes from one and write them to the other. Useful for cross-DAW collaboration or just comparing how ideas feel in different environments.

**Learn by doing.** Curious about Euclidean rhythms? Ask Claude to create one and explain the pattern. Want to understand jazz voicings? Have it add some to your progression and break down what it did.

<!-- TODO: Add GIF showing cross-DAW workflow -->

## Example Prompts

These are from real sessions — the kind of back-and-forth that makes this useful:

**Starting from nothing:**
> "I have an empty clip selected. Create a moody 4-bar chord progression in D minor, one chord per bar"

**Extending ideas:**
> "Create an 8-bar bassline from this 2-bar loop. Add increasingly expressive fills at the ends of bars 2, 4, 6, and 8"

**Musical dialogue:**
> "This clip is a short synth phrase — kind of an 'announcer.' Create a 4-bar call-and-response conversation from it"

**Iterating on results:**
> "This variation is too busy. Give me something more restrained but keep the opening phrase intact"

**Cross-DAW transfer:**
> "Read the melody from this Ableton clip and create a transposed version in Bitwig"

**Harmonic enrichment:**
> "Take this chord progression and make the voicings richer — the last chord should reach higher"

**Expressive dynamics:**
> "The velocity is mapped to filter cutoff. Create a phrase where the velocity arc tells a story — tension building, then resolving"

**Euclidean rhythms:**
> "Track 2 has a drum kit (C1=kick, D1=snare, F#1=hihat). Create a new clip with euclidean patterns: kick on 4/16, hihat on 7/16, snare on the backbeat"

**Analysis:**
> "What key is this clip in? What chords do you see?"

**Quick clip scaffolding:**
> "Create 3 clips at first available empty slots — Intro (4 beats), Verse A (8 beats), and one more (16 beats)"

**Full arrangement sketching:**
> "I have 4 tracks with different instruments. Create 4-8 clips per track that can play in sequence as a complete arrangement"

## Quick Start

You'll need:
- **Bitwig Studio** and/or **Ableton Live** (the DAWs)
- **Claude Desktop** or **Claude Code** (the AI interface)
- **Node.js 18+** (runs the bridge between them)

### 1. Download and Extract

Download the latest release ZIP from [Releases](../../releases) and extract it somewhere convenient.

You'll get:
```
daw-mcp/
├── BitwigMCP.bwextension    # Bitwig extension
├── AbletonMCP/              # Ableton Remote Script folder
├── mcp-server.js            # The bridge (runs on Node.js)
├── config.example.json      # Optional configuration
└── README.md
```

### 2. Install the DAW Extension

#### Bitwig Studio

Copy `BitwigMCP.bwextension` to your extensions folder:

| Platform | Location |
|----------|----------|
| **Windows** | `%USERPROFILE%\Documents\Bitwig Studio\Extensions\` |
| **macOS** | `~/Documents/Bitwig Studio/Extensions/` |
| **Linux** | `~/Bitwig Studio/Extensions/` |

Then in Bitwig: **Settings → Controllers → + Add Controller → search "Bitwig MCP Bridge"**

You should see: *"Bitwig MCP Bridge started on port 8181"*

#### Ableton Live

Copy the entire `AbletonMCP` folder to your Remote Scripts folder:

| Platform | Location |
|----------|----------|
| **Windows** | `%USERPROFILE%\Documents\Ableton\User Library\Remote Scripts\` |
| **macOS** | `~/Music/Ableton/User Library/Remote Scripts/` |
| **Linux** | (Wine) `~/.wine/drive_c/users/YOU/Documents/Ableton/User Library/Remote Scripts/` |

Then in Ableton: **Preferences → Link, Tempo & MIDI → Control Surface → select "AbletonMCP"**

You should see *"AbletonMCP loaded"* in the status bar.

### 3. Connect Claude

#### Claude Desktop (Recommended for non-developers)

Edit your Claude Desktop config file:

| Platform | Location |
|----------|----------|
| **Windows** | `%APPDATA%\Claude\claude_desktop_config.json` |
| **macOS** | `~/Library/Application Support/Claude/claude_desktop_config.json` |
| **Linux** | `~/.config/Claude/claude_desktop_config.json` |

Add this (create the file if it doesn't exist):

**macOS / Linux:**
```json
{
  "mcpServers": {
    "daw": {
      "command": "node",
      "args": ["/full/path/to/mcp-server.js"],
      "transport": "stdio"
    }
  }
}
```

**Windows:**
```json
{
  "mcpServers": {
    "daw": {
      "command": "cmd",
      "args": ["/c", "node", "C:\\Users\\YOU\\path\\to\\mcp-server.js"],
      "transport": "stdio"
    }
  }
}
```

Replace the path with the actual location where you extracted the files.

Restart Claude Desktop. You should see a hammer icon indicating MCP tools are available.

#### Claude Code (For developers)

Add to your Claude Code settings (`~/.claude.json` or project's `.claude/settings.json`):

**macOS / Linux:**
```json
{
  "mcpServers": {
    "daw": {
      "command": "node",
      "args": ["/full/path/to/mcp-server.js"],
      "transport": "stdio"
    }
  }
}
```

**Windows:**
```json
{
  "mcpServers": {
    "daw": {
      "command": "cmd",
      "args": ["/c", "node", "C:\\Users\\YOU\\path\\to\\mcp-server.js"],
      "transport": "stdio"
    }
  }
}
```

### 4. Start Making Music

1. Open your DAW and create or select a MIDI clip
2. Start a conversation with Claude
3. Ask it to do something with your clip

That's it. Claude can now see what's in your clips and create new musical content.

<!-- TODO: Add GIF showing the full workflow from empty clip to musical idea -->

## Supported DAWs

| DAW | Status | Notes |
|-----|--------|-------|
| **Bitwig Studio** | ✅ Ready | Full support via Java extension |
| **Ableton Live** | ✅ Ready | Full support via Python Remote Script |

## Current Limitations

**Clip Launcher / Session View only.** This works with clips in the session/launcher view. Arrangement view is intentionally out of scope — the discrete clip paradigm is better suited for AI-assisted workflows, and you're the one who arranges clips into songs.

**MIDI only.** Audio clips, automation, and mixing are outside the current scope.

**Read and write, not real-time.** Claude can read your clips and write new content, but it's not listening live or generating in real-time as you play.

**Your taste is still required.** Claude will give you ideas — some great, some not. The creative judgment of what works is still yours.

## What's Happening Under the Hood

```
You ←→ Claude ←→ MCP Server ←→ DAW Extension ←→ Your DAW
                    │
                    ├── Port 8181: Bitwig
                    └── Port 8182: Ableton
```

Claude talks to a small server that translates requests into commands your DAW understands. The DAW extensions expose clip contents and accept new notes via a simple protocol.

## Optional Configuration

For custom settings, create a config file:

| Platform | Location |
|----------|----------|
| **Windows** | `%APPDATA%\daw-mcp\config.json` |
| **macOS** | `~/Library/Application Support/daw-mcp/config.json` |
| **Linux** | `~/.config/daw-mcp/config.json` |

```json
{
  "defaultDaw": "bitwig",
  "bitwig": {
    "gridResolution": 16
  }
}
```

The `gridResolution` controls note precision in Bitwig (16 = 1/16th notes). Ableton supports arbitrary positioning natively.

See `config.example.json` in the release for all options.

## Troubleshooting

**"Could not connect to [DAW]"**
- Is the DAW running?
- Is the extension/remote script enabled?
- Check if the port is available: `nc -zv localhost 8181` (Bitwig) or `8182` (Ableton)

**Extension doesn't appear in DAW**
- Make sure files are in the correct location
- Restart the DAW
- Check the DAW's script/extension console for errors

**Claude doesn't see the MCP tools**
- Verify the path in your config is correct and absolute
- Restart Claude Desktop / reconnect in Claude Code
- Check that Node.js 18+ is installed and in your PATH

## Building from Source

If you want to build from source instead of using the release:

```bash
git clone https://github.com/ptaczek/daw-mcp.git
cd daw-mcp
./scripts/release.sh 1.0.0
# Output: release/daw-mcp-1.0.0.zip
```

Requires: Node.js 18+, Java 11+ (JDK), Gradle 8.x

## Acknowledgments

The Ableton Live integration was built using [AbletonOSC](https://github.com/ideoforms/AbletonOSC) as a reference — a well-documented project that made understanding Live's Python Remote Script API much easier.

## License

MIT — see [LICENSE](LICENSE) for details.

#!/bin/bash
# Release script for daw-mcp
# Creates a distributable ZIP file with all components

set -e

# Read version from package.json if not provided
if [ -n "$1" ]; then
  VERSION="$1"
else
  VERSION=$(node -p "require('./mcp-server/package.json').version")
fi
RELEASE_DIR="release/daw-mcp-${VERSION}"
ZIP_FILE="release/daw-mcp-${VERSION}.zip"

echo "=== Building daw-mcp release v${VERSION} ==="

# Clean previous release
rm -rf release
mkdir -p "$RELEASE_DIR"

# 1. Build Bitwig extension
echo "Building Bitwig extension..."
cd bitwig-extension
gradle build -q
cp build/libs/*.bwextension "../$RELEASE_DIR/BitwigMCP.bwextension"
cd ..

# 2. Bundle MCP server
echo "Bundling MCP server..."
cd mcp-server
npm run bundle --silent
cp dist/mcp-server.js "../$RELEASE_DIR/"
cd ..

# 3. Copy Ableton extension
echo "Copying Ableton extension..."
mkdir -p "$RELEASE_DIR/AbletonMCP"
cp -r ableton-extension/* "$RELEASE_DIR/AbletonMCP/"
# Remove any __pycache__ directories
find "$RELEASE_DIR/AbletonMCP" -type d -name "__pycache__" -exec rm -rf {} + 2>/dev/null || true

# 4. Copy example config
echo "Copying example config..."
cp docs/example-config.json "$RELEASE_DIR/config.example.json"

# 5. Create README
echo "Creating README..."
cat > "$RELEASE_DIR/README.md" << 'EOF'
# DAW MCP - Control Bitwig & Ableton from Claude

MCP server for controlling DAWs (Bitwig Studio, Ableton Live) from Claude.

## Installation

### 1. Bitwig Studio

Copy `BitwigMCP.bwextension` to your Bitwig extensions folder:
- **Linux**: `~/.BitwigStudio/extensions/`
- **macOS**: `~/Documents/Bitwig Studio/Extensions/`
- **Windows**: `%USERPROFILE%\Documents\Bitwig Studio\Extensions\`

Enable the extension in Bitwig: Settings → Extensions → BitwigMCP

### 2. Ableton Live

Copy the `AbletonMCP` folder to your Remote Scripts folder:
- **macOS**: `~/Music/Ableton/User Library/Remote Scripts/`
- **Windows**: `%APPDATA%\Ableton\Live x.x\Preferences\User Remote Scripts\`

Enable in Live: Preferences → Link/Tempo/MIDI → Control Surface → AbletonMCP

### 3. MCP Server

Add to your Claude Code config (`~/.claude/claude_desktop_config.json`):

**Linux/macOS:**
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

**Windows:**
```json
{
  "mcpServers": {
    "daw": {
      "command": "cmd",
      "args": ["/c", "node", "C:\\path\\to\\mcp-server.js"]
    }
  }
}
```

### 4. Configuration (Optional)

Copy `config.example.json` to your config directory:
- **Linux**: `~/.config/daw-mcp/config.json`
- **macOS**: `~/Library/Application Support/daw-mcp/config.json`
- **Windows**: `%APPDATA%\daw-mcp\config.json`

## Usage

Once installed, Claude can control your DAW with commands like:
- "List all tracks"
- "Set BPM to 128"
- "Create a 4-bar MIDI clip with a C minor chord progression"
- "Transpose the selected clip up 5 semitones"

## Requirements

- Node.js 18+ (for MCP server)
- Bitwig Studio 5+ or Ableton Live 11+

## More Info

https://github.com/yourusername/daw-mcp
EOF

# 6. Create ZIP
echo "Creating ZIP archive..."
cd release
zip -r "daw-mcp-${VERSION}.zip" "daw-mcp-${VERSION}"
cd ..

echo ""
echo "=== Release complete ==="
echo "Output: $ZIP_FILE"
ls -lh "$ZIP_FILE"

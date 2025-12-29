# Release script for daw-mcp (Windows)
# Creates a distributable ZIP file with all components
# Usage: .\release.ps1 [version]

param(
    [string]$Version
)

$ErrorActionPreference = "Stop"

# Read version from package.json if not provided
if (-not $Version) {
    $packageJson = Get-Content -Path "mcp-server\package.json" | ConvertFrom-Json
    $Version = $packageJson.version
}

$ReleaseDir = "release\daw-mcp-$Version"
$ZipFile = "release\daw-mcp-$Version.zip"

Write-Host "=== Building daw-mcp release v$Version ===" -ForegroundColor Cyan

# Clean previous release
if (Test-Path "release") {
    Remove-Item -Recurse -Force "release"
}
New-Item -ItemType Directory -Path $ReleaseDir -Force | Out-Null

# 1. Build Bitwig extension
Write-Host "Building Bitwig extension..." -ForegroundColor Yellow
Push-Location "bitwig-extension"
& gradle build -q
if ($LASTEXITCODE -ne 0) { throw "Gradle build failed" }
Copy-Item "build\libs\*.bwextension" "..\$ReleaseDir\BitwigMCP.bwextension"
Pop-Location

# 2. Bundle MCP server
Write-Host "Bundling MCP server..." -ForegroundColor Yellow
Push-Location "mcp-server"
& npm run bundle --silent
if ($LASTEXITCODE -ne 0) { throw "npm bundle failed" }
Copy-Item "dist\mcp-server.js" "..\$ReleaseDir\"
Pop-Location

# 3. Copy Ableton extension
Write-Host "Copying Ableton extension..." -ForegroundColor Yellow
New-Item -ItemType Directory -Path "$ReleaseDir\AbletonMCP" -Force | Out-Null
Copy-Item -Recurse "ableton-extension\*" "$ReleaseDir\AbletonMCP\"
# Remove any __pycache__ directories
Get-ChildItem -Path "$ReleaseDir\AbletonMCP" -Recurse -Directory -Filter "__pycache__" | Remove-Item -Recurse -Force -ErrorAction SilentlyContinue

# 4. Copy example config
Write-Host "Copying example config..." -ForegroundColor Yellow
Copy-Item "docs\example-config.json" "$ReleaseDir\config.example.json"

# 5. Create README
Write-Host "Creating README..." -ForegroundColor Yellow
$ReadmeContent = @'
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
'@
Set-Content -Path "$ReleaseDir\README.md" -Value $ReadmeContent

# 6. Create ZIP
Write-Host "Creating ZIP archive..." -ForegroundColor Yellow
if (Test-Path $ZipFile) {
    Remove-Item $ZipFile
}
Compress-Archive -Path $ReleaseDir -DestinationPath $ZipFile

Write-Host ""
Write-Host "=== Release complete ===" -ForegroundColor Green
Write-Host "Output: $ZipFile"
$fileInfo = Get-Item $ZipFile
Write-Host ("Size: {0:N2} KB" -f ($fileInfo.Length / 1KB))

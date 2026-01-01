import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import { DAWType } from './daw-client.js';

export interface Config {
  // Default DAW to use when not specified
  defaultDaw: DAWType;

  // Global grid resolution (affects both DAWs)
  // Bitwig: used for note quantization (API limitation)
  // Ableton: used for clip stats bucketing
  gridResolution: number;  // 16 = 1/16th notes, 32 = 1/32nd notes

  // Per-DAW configuration
  bitwig: {
    port: number;
    cursorClipLengthBeats: number; // Cursor clip length in beats
    scenes: number;                // Scene count for clip launcher
  };
  ableton: {
    port: number;
  };

  // MCP server settings
  mcp: {
    selectionDelayMs: number;
    requestTimeoutMs: number;
  };

  // Tool filtering (tool name -> enabled)
  tools: Record<string, boolean>;
}

const DEFAULTS: Config = {
  defaultDaw: 'bitwig',
  gridResolution: 16,  // 1/16th notes (global for both DAWs)
  bitwig: {
    port: 8181,
    cursorClipLengthBeats: 128, // 32 bars × 4 beats
    scenes: 128,
  },
  ableton: {
    port: 8182,
  },
  mcp: {
    selectionDelayMs: 400,
    requestTimeoutMs: 10000,
  },
  tools: {}, // Empty = all enabled
};

/**
 * Get the config file path for the current platform.
 * - Linux: ~/.config/daw-mcp/config.json
 * - macOS: ~/Library/Application Support/daw-mcp/config.json
 * - Windows: %APPDATA%\daw-mcp\config.json
 */
function getConfigPath(): string {
  const platform = os.platform();

  if (platform === 'win32') {
    return path.join(process.env.APPDATA || os.homedir(), 'daw-mcp', 'config.json');
  } else if (platform === 'darwin') {
    return path.join(os.homedir(), 'Library', 'Application Support', 'daw-mcp', 'config.json');
  } else {
    return path.join(os.homedir(), '.config', 'daw-mcp', 'config.json');
  }
}

/**
 * Load configuration from the config file.
 * Falls back to defaults if file doesn't exist or is invalid.
 */
export function loadConfig(): Config {
  const configPath = getConfigPath();

  if (!fs.existsSync(configPath)) {
    console.error(`[Config] No config file found at ${configPath}, using defaults`);
    return DEFAULTS;
  }

  try {
    const content = fs.readFileSync(configPath, 'utf-8');
    const parsed = JSON.parse(content);

    const config: Config = {
      defaultDaw: parsed.defaultDaw ?? DEFAULTS.defaultDaw,
      gridResolution: parsed.gridResolution ?? DEFAULTS.gridResolution,
      bitwig: {
        port: parsed.bitwig?.port ?? DEFAULTS.bitwig.port,
        cursorClipLengthBeats: parsed.bitwig?.cursorClipLengthBeats ?? DEFAULTS.bitwig.cursorClipLengthBeats,
        scenes: parsed.bitwig?.scenes ?? DEFAULTS.bitwig.scenes,
      },
      ableton: {
        port: parsed.ableton?.port ?? DEFAULTS.ableton.port,
      },
      mcp: {
        selectionDelayMs: parsed.mcp?.selectionDelayMs ?? DEFAULTS.mcp.selectionDelayMs,
        requestTimeoutMs: parsed.mcp?.requestTimeoutMs ?? DEFAULTS.mcp.requestTimeoutMs,
      },
      tools: parsed.tools ?? {},
    };

    console.error(`[Config] Loaded: defaultDaw=${config.defaultDaw}, gridResolution=${config.gridResolution}`);
    return config;
  } catch (error) {
    console.error('[Config] Failed to load config:', error);
    return DEFAULTS;
  }
}

/**
 * Tools disabled by default (can be enabled in config with "tool_name": true).
 * These are OPT (optional) tools - useful but not essential for core workflows.
 */
const DEFAULT_DISABLED_TOOLS = [
  'batch_move_notes',         // Rarely needed - producer adjusts timing manually
  'batch_set_note_properties', // MPE properties - producer handles nuanced control
  'transpose_clip',           // Optional convenience
  'transpose_range',          // Specific use case
  'batch_create_tracks',      // Producer creates tracks manually
  'batch_delete_tracks',      // Destructive - producer prefers manual control
  'batch_set_track_properties', // Mixing - not content creation
  'transport_set_position',   // For future arrangement support
];

/**
 * Check if a tool is enabled in the config.
 * - Explicit config takes precedence
 * - DEFAULT_DISABLED_TOOLS are disabled unless explicitly enabled
 * - All other tools default to enabled
 */
export function isToolEnabled(config: Config, toolName: string): boolean {
  // Explicit config takes precedence
  if (toolName in config.tools) {
    return config.tools[toolName] !== false;
  }
  // Default disabled tools
  if (DEFAULT_DISABLED_TOOLS.includes(toolName)) {
    return false;
  }
  // Everything else enabled by default
  return true;
}

/**
 * Get the config file path (for logging/debugging).
 */
function getConfigFilePath(): string {
  return getConfigPath();
}

/**
 * Get the step size in beats for the configured grid resolution.
 * Formula: stepSize = 4 / gridResolution
 * Example: gridResolution=16 -> stepSize=0.25 (1/16th note)
 */
export function getStepSize(config: Config): number {
  return 4 / config.gridResolution;
}

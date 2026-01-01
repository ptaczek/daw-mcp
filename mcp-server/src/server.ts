/**
 * MCP Server setup and request routing.
 * Uses registry pattern for tool handlers.
 */

import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from '@modelcontextprotocol/sdk/types.js';
import { DAWClientManager, DAWType } from './daw-client.js';
import { Config, isToolEnabled } from './config.js';
import { createToolDefinitions } from './tools/index.js';
import { resolveDaw } from './helpers/daw-resolution.js';
import { HandlerContext, ToolResult, errorResult } from './handlers/types.js';

// Import handlers from domain modules
import { handleGetDaws, handleGetProjectInfo } from './handlers/project.js';
import { handleListTracks, handleBatchCreateTracks, handleBatchSetTrackProperties, handleBatchDeleteTracks } from './handlers/tracks.js';
import { handleBatchListClips, handleBatchCreateClips, handleBatchDeleteClips, handleSetClipLength } from './handlers/clips.js';
import { handleBatchGetNotes, handleBatchSetNotes, handleBatchClearNotes, handleBatchMoveNotes, handleBatchSetNoteProperties, handleTransposeClip, handleTransposeRange } from './handlers/notes.js';
import { handleGetClipStats } from './handlers/analysis.js';
import { handleBatchCreateEuclidPattern } from './handlers/euclid.js';

/** Handler type for tools that need HandlerContext */
type ToolHandler = (ctx: HandlerContext) => Promise<ToolResult>;

/** Build the tool registry */
function createToolRegistry(): Map<string, ToolHandler> {
  return new Map<string, ToolHandler>([
    // Project (get_daws handled separately - doesn't need context)
    ['get_project_info', handleGetProjectInfo],

    // Tracks
    ['list_tracks', handleListTracks],
    ['batch_create_tracks', handleBatchCreateTracks],
    ['batch_set_track_properties', handleBatchSetTrackProperties],
    ['batch_delete_tracks', handleBatchDeleteTracks],

    // Clips
    ['batch_list_clips', handleBatchListClips],
    ['batch_create_clips', handleBatchCreateClips],
    ['batch_delete_clips', handleBatchDeleteClips],
    ['set_clip_length', handleSetClipLength],

    // Notes
    ['batch_get_notes', handleBatchGetNotes],
    ['batch_set_notes', handleBatchSetNotes],
    ['batch_clear_notes', handleBatchClearNotes],
    ['batch_move_notes', handleBatchMoveNotes],
    ['batch_set_note_properties', handleBatchSetNoteProperties],
    ['transpose_clip', handleTransposeClip],
    ['transpose_range', handleTransposeRange],

    // Analysis
    ['get_clip_stats', handleGetClipStats],

    // Generative
    ['batch_create_euclid_pattern', handleBatchCreateEuclidPattern],
  ]);
}

/** Create and configure the MCP server */
export function createServer(config: Config, dawManager: DAWClientManager): Server {
  const server = new Server(
    {
      name: 'daw-mcp',
      version: '1.0.0',
    },
    {
      capabilities: {
        tools: {},
      },
    }
  );

  const tools = createToolDefinitions(config);
  const toolRegistry = createToolRegistry();

  // Handle list tools request (filter by config)
  server.setRequestHandler(ListToolsRequestSchema, async () => {
    const enabledTools = tools.filter(tool => isToolEnabled(config, tool.name));
    return { tools: enabledTools };
  });

  // Handle tool calls
  server.setRequestHandler(CallToolRequestSchema, async (request) => {
    const { name, arguments: args } = request.params;
    const safeArgs = (args ?? {}) as Record<string, unknown>;

    // Special case: get_daws doesn't need DAW resolution (it IS the discovery)
    if (name === 'get_daws') {
      return handleGetDaws(config, dawManager);
    }

    // Look up handler in registry
    const handler = toolRegistry.get(name);
    if (!handler) {
      return errorResult(`Unknown tool: ${name}`);
    }

    try {
      // Resolve which DAW to use (probes connections, auto-selects single DAW)
      const daw = await resolveDaw(
        safeArgs.daw as DAWType | undefined,
        dawManager,
        config.defaultDaw
      );

      // Build context and execute handler
      const ctx: HandlerContext = { dawManager, config, daw, args: safeArgs };
      return await handler(ctx);
    } catch (error) {
      return handleError(error, safeArgs.daw as DAWType | undefined, config, dawManager);
    }
  });

  return server;
}

/** Handle errors with helpful messages */
function handleError(
  error: unknown,
  requestedDaw: DAWType | undefined,
  config: Config,
  dawManager: DAWClientManager
): ToolResult {
  const errorMessage = error instanceof Error ? error.message : String(error);
  const targetDaw = requestedDaw ?? config.defaultDaw;
  const port = dawManager.getPort(targetDaw);

  // Check if it's a connection error
  if (errorMessage.includes('ECONNREFUSED') || errorMessage.includes('Connection')) {
    const dawName = targetDaw === 'bitwig' ? 'Bitwig Studio' : 'Ableton Live';
    const extensionName = targetDaw === 'bitwig' ? 'Bitwig MCP Bridge extension' : 'AbletonMCP Remote Script';

    return {
      content: [
        {
          type: 'text',
          text: `Error: Could not connect to ${dawName}. Make sure:\n` +
                `1. ${dawName} is running\n` +
                `2. The ${extensionName} is enabled\n` +
                `3. The extension is listening on port ${port}`,
        },
      ],
      isError: true,
    };
  }

  return errorResult(errorMessage);
}

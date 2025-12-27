/**
 * MCP Server setup and request routing.
 */

import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from '@modelcontextprotocol/sdk/types.js';
import { DAWClientManager, DAWType } from './daw-client.js';
import { Config, isToolEnabled, getBitwigStepSize } from './config.js';
import { createToolDefinitions } from './tools/index.js';
import {
  toInternal, toUser, extractDaw, getCommand
} from './helpers/index.js';
import {
  HandlerContext, BatchResult,
  handleBatchSetNotes, handleBatchMoveNotes, handleBatchClearNotes, handleBatchSetNoteProperties,
  handleBatchGetNotes, handleBatchListClips, handleBatchCreateClips, handleBatchDeleteClips,
  handleBatchCreateTracks, handleBatchSetTrackProperties, handleBatchDeleteTracks,
  handleGetClipStats,
  handleBatchCreateEuclidPattern,
  handleTransposeRange, handleBatchOperations
} from './handlers/index.js';

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

  // Handle list tools request (filter by config)
  server.setRequestHandler(ListToolsRequestSchema, async () => {
    const enabledTools = tools.filter(tool => isToolEnabled(config, tool.name));
    return { tools: enabledTools };
  });

  // Handle tool calls
  server.setRequestHandler(CallToolRequestSchema, async (request) => {
    const { name, arguments: args } = request.params;

    // Handle get_daws - special tool that checks all DAW connections
    if (name === 'get_daws') {
      return handleGetDaws(config, dawManager);
    }

    const daw = extractDaw(args as Record<string, unknown>, dawManager);

    try {
      // Check for batch operations first
      const batchResult = await handleBatchOperation(name, args as Record<string, unknown>, config, dawManager, daw);
      if (batchResult !== null) {
        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify(batchResult, null, 2),
            },
          ],
        };
      }

      // Execute the command
      const command = getCommand(name);
      const result = await dawManager.send(command, args as Record<string, unknown>, daw);

      // Transform responses for user-facing output
      let output = result;

      if (name === 'list_tracks') {
        // Convert track indices to 1-based
        const resultObj = result as { tracks?: Array<{ index: number; [key: string]: unknown }> } | Array<{ index: number; [key: string]: unknown }>;
        const tracks = Array.isArray(resultObj) ? resultObj : (resultObj.tracks ?? []);
        output = tracks.map(track => ({
          ...track,
          index: toUser(track.index)
        }));
      }

      return {
        content: [
          {
            type: 'text',
            text: JSON.stringify(output, null, 2),
          },
        ],
      };
    } catch (error) {
      return handleError(error, daw, config, dawManager);
    }
  });

  return server;
}

/** Handle get_daws tool */
async function handleGetDaws(config: Config, dawManager: DAWClientManager) {
  try {
    const connections = await dawManager.checkConnections();
    const connectedDaws = connections.filter(c => c.connected);
    const defaultDaw = connections.find(c => c.isDefault);

    // Add grid info per DAW
    const stepSize = getBitwigStepSize(config);
    const dawsWithGrid = connections.map(c => ({
      ...c,
      grid: c.daw === 'bitwig' ? {
        resolution: config.bitwig.gridResolution,
        stepSize: stepSize,
        unit: `1/${config.bitwig.gridResolution}th note`
      } : null  // Ableton supports arbitrary positioning
    }));

    return {
      content: [
        {
          type: 'text',
          text: JSON.stringify({
            daws: dawsWithGrid,
            summary: {
              connectedCount: connectedDaws.length,
              connectedDaws: connectedDaws.map(c => c.daw),
              defaultDaw: defaultDaw?.daw,
              hint: connectedDaws.length > 1
                ? 'Multiple DAWs connected. Use "daw" parameter to target a specific DAW (e.g., daw: "ableton").'
                : connectedDaws.length === 1
                ? `Only ${connectedDaws[0].daw} is connected. The "daw" parameter is optional.`
                : 'No DAWs connected. Please start Bitwig Studio or Ableton Live with the extension enabled.'
            }
          }, null, 2),
        },
      ],
    };
  } catch (error) {
    return {
      content: [
        {
          type: 'text',
          text: `Error checking DAW connections: ${error instanceof Error ? error.message : String(error)}`,
        },
      ],
    };
  }
}

/** Route to appropriate batch handler */
async function handleBatchOperation(
  name: string,
  args: Record<string, unknown>,
  config: Config,
  dawManager: DAWClientManager,
  daw: DAWType
): Promise<BatchResult | null> {
  const ctx: HandlerContext = { dawManager, config, daw, args };

  switch (name) {
    case 'batch_set_notes':
      return handleBatchSetNotes(ctx);

    case 'batch_move_notes':
      return handleBatchMoveNotes(ctx);

    case 'batch_clear_notes':
      return handleBatchClearNotes(ctx);

    case 'batch_set_note_properties':
      return handleBatchSetNoteProperties(ctx);

    case 'transpose_range':
      return handleTransposeRange(ctx);

    case 'batch_operations':
      return handleBatchOperations(ctx);

    case 'get_clip_stats':
      return handleGetClipStats(ctx);

    case 'batch_create_euclid_pattern':
      return handleBatchCreateEuclidPattern(ctx);

    case 'batch_get_notes':
      return handleBatchGetNotes(ctx);

    case 'batch_list_clips':
      return handleBatchListClips(ctx);

    case 'batch_create_clips':
      return handleBatchCreateClips(ctx);

    case 'batch_delete_clips':
      return handleBatchDeleteClips(ctx);

    case 'batch_create_tracks':
      return handleBatchCreateTracks(ctx);

    case 'batch_set_track_properties':
      return handleBatchSetTrackProperties(ctx);

    case 'batch_delete_tracks':
      return handleBatchDeleteTracks(ctx);

    // Handle tools with optional clip selection
    case 'transpose_clip':
    case 'set_clip_length':
      // Convert 1-based user indices to 0-based internal indices
      if (args.trackIndex !== undefined) {
        args.trackIndex = toInternal(args.trackIndex as number);
      }
      if (args.slotIndex !== undefined) {
        args.slotIndex = toInternal(args.slotIndex as number);
      }
      return null;  // Let standard command handler process it

    default:
      return null;
  }
}

/** Handle errors with helpful messages */
function handleError(
  error: unknown,
  daw: DAWType,
  config: Config,
  dawManager: DAWClientManager
) {
  const errorMessage = error instanceof Error ? error.message : String(error);
  const targetDaw = daw ?? config.defaultDaw;
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

  return {
    content: [
      {
        type: 'text',
        text: `Error: ${errorMessage}`,
      },
    ],
    isError: true,
  };
}

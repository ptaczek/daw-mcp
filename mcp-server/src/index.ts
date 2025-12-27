#!/usr/bin/env node

/**
 * DAW MCP Server - Entry point.
 * Bridges Claude to Bitwig Studio and Ableton Live via MCP protocol.
 */

import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { DAWClientManager } from './daw-client.js';
import { loadConfig } from './config.js';
import { createServer } from './server.js';

// Load configuration
const config = loadConfig();

// Create DAW client manager with configured ports and timeout
const dawManager = new DAWClientManager({
  defaultDaw: config.defaultDaw,
  bitwigPort: config.bitwig.port,
  abletonPort: config.ableton.port,
  timeout: config.mcp.requestTimeoutMs,
});

// Create MCP server
const server = createServer(config, dawManager);

// Start server
async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error(`DAW MCP server running on stdio (default: ${config.defaultDaw})`);
}

main().catch(console.error);

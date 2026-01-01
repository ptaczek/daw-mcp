/**
 * Shared handler types and utilities.
 */

import { CallToolResult } from '@modelcontextprotocol/sdk/types.js';
import { DAWClientManager, DAWType } from '../daw-client.js';
import { Config } from '../config.js';

/** Handler context - passed to all handlers */
export interface HandlerContext {
  dawManager: DAWClientManager;
  config: Config;
  daw: DAWType;
  args: Record<string, unknown>;
}

/** Tool result type - re-export from SDK for compatibility */
export type ToolResult = CallToolResult;

/** Create success response */
export function successResult(data: unknown): ToolResult {
  return {
    content: [{ type: 'text', text: JSON.stringify(data, null, 2) }]
  };
}

/** Create error response */
export function errorResult(message: string): ToolResult {
  return {
    content: [{ type: 'text', text: `Error: ${message}` }],
    isError: true
  };
}

/** Sort notes by time (x) ascending, then by pitch (y) ascending */
export function sortNotes<T extends { x: number; y: number }>(notes: T[]): T[] {
  return [...notes].sort((a, b) => a.x - b.x || a.y - b.y);
}

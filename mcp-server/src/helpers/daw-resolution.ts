/**
 * Dynamic DAW resolution.
 * Probes connections on each tool call and auto-selects single connected DAW.
 */

import { DAWClientManager, DAWType } from '../daw-client.js';

/**
 * Resolve which DAW to use for a tool call.
 *
 * Priority:
 * 1. Explicit DAW parameter from user
 * 2. Single connected DAW (auto-select regardless of config)
 * 3. Config default (when multiple or none connected)
 */
export async function resolveDaw(
  explicitDaw: DAWType | undefined,
  dawManager: DAWClientManager,
  configDefault: DAWType
): Promise<DAWType> {
  // If explicit, use it
  if (explicitDaw === 'bitwig' || explicitDaw === 'ableton') {
    return explicitDaw;
  }

  // Probe both extensions via TCP
  const connections = await dawManager.checkConnections();
  const connected = connections.filter(c => c.connected);

  // Single DAW connected → use it (ignores config default)
  if (connected.length === 1) {
    return connected[0].daw;
  }

  // Multiple or none → use config default
  return configDefault;
}

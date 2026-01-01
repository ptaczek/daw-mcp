/**
 * Project-level handlers: get_daws, get_project_info
 */

import { HandlerContext, ToolResult, successResult, errorResult } from './types.js';
import { DAWClientManager } from '../daw-client.js';
import { Config, getStepSize } from '../config.js';

/**
 * Handle get_daws - discover connected DAWs.
 * This is special: it doesn't use resolveDaw() since it IS the discovery tool.
 */
export async function handleGetDaws(
  config: Config,
  dawManager: DAWClientManager
): Promise<ToolResult> {
  try {
    const connections = await dawManager.checkConnections();
    const connectedDaws = connections.filter(c => c.connected);
    const defaultDaw = connections.find(c => c.isDefault);

    // Add grid info per DAW
    // Bitwig: grid enforced (API quantizes notes)
    // Ableton: grid is null (arbitrary note positioning supported)
    const stepSize = getStepSize(config);
    const dawsWithGrid = connections.map(c => ({
      ...c,
      grid: c.daw === 'bitwig' ? {
        resolution: config.gridResolution,
        stepSize: stepSize,
        unit: `1/${config.gridResolution}th note`
      } : null  // Ableton supports arbitrary positioning
    }));

    return successResult({
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
    });
  } catch (error) {
    return errorResult(`Error checking DAW connections: ${error instanceof Error ? error.message : String(error)}`);
  }
}

/**
 * Handle get_project_info - get BPM, time signature, etc.
 */
export async function handleGetProjectInfo(ctx: HandlerContext): Promise<ToolResult> {
  const { dawManager, daw } = ctx;

  try {
    const result = await dawManager.send('project.getInfo', {}, daw);
    return successResult(result);
  } catch (error) {
    return errorResult(error instanceof Error ? error.message : String(error));
  }
}

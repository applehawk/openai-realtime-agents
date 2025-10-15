/**
 * Utility to verify MCP tools are properly connected to the severstalAssistant agent
 *
 * Usage:
 * 1. Import this file in your component or test
 * 2. Call verifyMcpToolsConnection() to get a detailed report
 * 3. Check browser console for detailed logs
 */

import { severstalAssistant } from './index';

export interface McpToolVerification {
  isConnected: boolean;
  toolCount: number;
  mcpTools: Array<{
    serverLabel?: string;
    serverUrl?: string;
    type: string;
    name?: string;
  }>;
  errors: string[];
  warnings: string[];
}

/**
 * Verifies that hostedMcpTools are properly configured in the agent
 */
export function verifyMcpToolsConnection(): McpToolVerification {
  const result: McpToolVerification = {
    isConnected: false,
    toolCount: 0,
    mcpTools: [],
    errors: [],
    warnings: [],
  };

  try {
    // Check if agent has tools property
    if (!severstalAssistant.tools) {
      result.errors.push('Agent does not have a tools property');
      return result;
    }

    result.toolCount = severstalAssistant.tools.length;

    // Inspect each tool
    severstalAssistant.tools.forEach((tool: any, index: number) => {
      console.log(`[verifyMcpTools] Tool ${index}:`, tool);

      // Check if it's an MCP tool by looking for common MCP properties
      const isMcpTool =
        tool.serverLabel !== undefined ||
        tool.serverUrl !== undefined ||
        tool.definition?.serverLabel !== undefined ||
        tool.definition?.serverUrl !== undefined ||
        (tool.name && tool.name.includes('mcp')) ||
        tool.type === 'mcp' ||
        tool.constructor?.name?.includes('Mcp');

      if (isMcpTool) {
        result.mcpTools.push({
          serverLabel: tool.serverLabel || tool.definition?.serverLabel,
          serverUrl: tool.serverUrl || tool.definition?.serverUrl,
          type: tool.constructor?.name || typeof tool,
          name: tool.name || tool.definition?.name,
        });
      }
    });

    // Validation checks
    if (result.toolCount === 0) {
      result.errors.push('No tools found in agent configuration');
    }

    if (result.mcpTools.length === 0) {
      result.warnings.push(
        'No MCP tools detected. Tools may be proxied or structured differently.'
      );
    } else {
      result.isConnected = true;
      console.log(
        `[verifyMcpTools] ✅ Found ${result.mcpTools.length} MCP tool(s) out of ${result.toolCount} total tools`
      );
    }

    // Check for expected MCP servers
    const expectedServers = ['calendar', 'RAG'];
    const foundLabels = result.mcpTools
      .map(t => t.serverLabel)
      .filter(Boolean) as string[];

    expectedServers.forEach(expected => {
      if (!foundLabels.includes(expected)) {
        result.warnings.push(`Expected MCP server '${expected}' not found in tools`);
      }
    });

    // Validate URLs
    result.mcpTools.forEach(tool => {
      if (tool.serverUrl) {
        if (!tool.serverUrl.startsWith('http://') && !tool.serverUrl.startsWith('https://')) {
          result.warnings.push(
            `MCP tool '${tool.serverLabel}' has URL without protocol: ${tool.serverUrl}`
          );
        }
      } else {
        result.warnings.push(
          `MCP tool '${tool.serverLabel || 'unknown'}' is missing serverUrl`
        );
      }
    });

  } catch (error) {
    result.errors.push(`Exception during verification: ${error instanceof Error ? error.message : String(error)}`);
  }

  // Log summary
  console.log('[verifyMcpTools] Verification Result:', {
    isConnected: result.isConnected,
    toolCount: result.toolCount,
    mcpToolCount: result.mcpTools.length,
    errors: result.errors,
    warnings: result.warnings,
  });

  console.log('[verifyMcpTools] MCP Tools Details:', result.mcpTools);

  return result;
}

/**
 * Runtime check that can be called when the session connects
 * Returns a promise that resolves with the verification result
 */
export async function verifyMcpToolsAtRuntime(
  sessionTools?: any[]
): Promise<McpToolVerification> {
  const staticVerification = verifyMcpToolsConnection();

  if (sessionTools && sessionTools.length > 0) {
    console.log('[verifyMcpTools] Runtime session tools:', sessionTools);

    // Compare static config with runtime session
    if (sessionTools.length !== staticVerification.toolCount) {
      staticVerification.warnings.push(
        `Tool count mismatch: config has ${staticVerification.toolCount}, session has ${sessionTools.length}`
      );
    }
  }

  return staticVerification;
}

/**
 * Helper to test MCP tool connectivity by making a test call
 * Note: This is a placeholder - actual implementation depends on SDK internals
 */
export async function testMcpToolConnectivity(
  serverLabel: string
): Promise<{ success: boolean; error?: string }> {
  console.log(`[verifyMcpTools] Testing connectivity to MCP server: ${serverLabel}`);

  try {
    // Find the tool
    const tool = severstalAssistant.tools.find(
      (t: any) =>
        t.serverLabel === serverLabel ||
        t.definition?.serverLabel === serverLabel
    );

    if (!tool) {
      return {
        success: false,
        error: `MCP tool with serverLabel '${serverLabel}' not found`
      };
    }

    // MCP tools from OpenAI SDK might not expose direct connectivity tests
    // This would require actual session context
    console.log(`[verifyMcpTools] Tool found:`, tool);

    return {
      success: true,
    };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : String(error)
    };
  }
}

// Auto-run verification on module load for immediate feedback
if (typeof window !== 'undefined') {
  console.log('[verifyMcpTools] Running automatic verification...');
  verifyMcpToolsConnection();
}

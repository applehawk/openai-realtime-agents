/**
 * Runtime monitor for MCP tool execution
 *
 * This utility helps debug and verify that MCP tools are being called correctly
 * during agent sessions.
 */

export interface McpToolCall {
  timestamp: Date;
  toolName: string;
  serverLabel?: string;
  serverUrl?: string;
  arguments: any;
  result?: any;
  error?: string;
  duration?: number;
}

class McpToolMonitor {
  private calls: McpToolCall[] = [];
  private maxCalls = 100; // Keep last 100 calls

  /**
   * Log an MCP tool call
   */
  logCall(call: Omit<McpToolCall, 'timestamp'>) {
    const fullCall: McpToolCall = {
      ...call,
      timestamp: new Date(),
    };

    this.calls.push(fullCall);

    // Keep only the last N calls
    if (this.calls.length > this.maxCalls) {
      this.calls.shift();
    }

    // Log to console with styling
    console.group(
      `%c[MCP Tool Call] ${call.serverLabel || call.toolName}`,
      'color: #0066cc; font-weight: bold'
    );
    console.log('Time:', fullCall.timestamp.toLocaleTimeString());
    console.log('Tool:', call.toolName);
    console.log('Server:', call.serverLabel, '-', call.serverUrl);
    console.log('Arguments:', call.arguments);
    if (call.result) {
      console.log('Result:', call.result);
    }
    if (call.error) {
      console.error('Error:', call.error);
    }
    if (call.duration) {
      console.log('Duration:', `${call.duration}ms`);
    }
    console.groupEnd();

    return fullCall;
  }

  /**
   * Get all logged calls
   */
  getCalls(): McpToolCall[] {
    return [...this.calls];
  }

  /**
   * Get calls for a specific server
   */
  getCallsForServer(serverLabel: string): McpToolCall[] {
    return this.calls.filter(call => call.serverLabel === serverLabel);
  }

  /**
   * Get statistics about tool usage
   */
  getStats() {
    const stats = {
      totalCalls: this.calls.length,
      successfulCalls: this.calls.filter(c => !c.error).length,
      failedCalls: this.calls.filter(c => c.error).length,
      byServer: {} as Record<string, number>,
      byTool: {} as Record<string, number>,
      averageDuration: 0,
    };

    // Count by server
    this.calls.forEach(call => {
      const server = call.serverLabel || 'unknown';
      stats.byServer[server] = (stats.byServer[server] || 0) + 1;

      const tool = call.toolName || 'unknown';
      stats.byTool[tool] = (stats.byTool[tool] || 0) + 1;
    });

    // Calculate average duration
    const callsWithDuration = this.calls.filter(c => c.duration);
    if (callsWithDuration.length > 0) {
      const totalDuration = callsWithDuration.reduce((sum, c) => sum + (c.duration || 0), 0);
      stats.averageDuration = totalDuration / callsWithDuration.length;
    }

    return stats;
  }

  /**
   * Clear all logged calls
   */
  clear() {
    this.calls = [];
    console.log('[MCP Monitor] Call history cleared');
  }

  /**
   * Export calls as JSON (useful for debugging)
   */
  exportCalls(): string {
    return JSON.stringify(this.calls, null, 2);
  }

  /**
   * Print a summary report to console
   */
  printReport() {
    const stats = this.getStats();

    console.group('%c[MCP Monitor] Usage Report', 'color: #0066cc; font-weight: bold; font-size: 14px');
    console.log('Total Calls:', stats.totalCalls);
    console.log('Successful:', stats.successfulCalls);
    console.log('Failed:', stats.failedCalls);
    console.log('Average Duration:', `${stats.averageDuration.toFixed(2)}ms`);

    console.group('Calls by Server:');
    Object.entries(stats.byServer).forEach(([server, count]) => {
      console.log(`  ${server}: ${count}`);
    });
    console.groupEnd();

    console.group('Calls by Tool:');
    Object.entries(stats.byTool).forEach(([tool, count]) => {
      console.log(`  ${tool}: ${count}`);
    });
    console.groupEnd();

    console.groupEnd();
  }
}

// Global singleton instance
export const mcpMonitor = new McpToolMonitor();

// Make it available in browser console for debugging
if (typeof window !== 'undefined') {
  (window as any).mcpMonitor = mcpMonitor;
  console.log(
    '%c[MCP Monitor] Available globally as window.mcpMonitor',
    'color: #0066cc; font-style: italic'
  );
  console.log(
    '%cUsage: mcpMonitor.getStats(), mcpMonitor.printReport(), mcpMonitor.getCalls()',
    'color: #666; font-style: italic'
  );
}

/**
 * Wrapper function to monitor MCP tool execution
 * Use this to wrap tool execution calls
 */
export async function monitoredMcpCall<T>(
  serverLabel: string,
  toolName: string,
  serverUrl: string,
  args: any,
  executor: () => Promise<T>
): Promise<T> {
  const startTime = Date.now();

  try {
    const result = await executor();
    const duration = Date.now() - startTime;

    mcpMonitor.logCall({
      toolName,
      serverLabel,
      serverUrl,
      arguments: args,
      result,
      duration,
    });

    return result;
  } catch (error) {
    const duration = Date.now() - startTime;

    mcpMonitor.logCall({
      toolName,
      serverLabel,
      serverUrl,
      arguments: args,
      error: error instanceof Error ? error.message : String(error),
      duration,
    });

    throw error;
  }
}

export default mcpMonitor;

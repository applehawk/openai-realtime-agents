/**
 * MCP Server Manager
 *
 * Manages MCP tools by fetching them from server-side API endpoint.
 * Uses hostedMcpTool approach instead of direct MCPServerStreamableHttp
 * to avoid "No existing trace found" error in browser environment.
 */

interface ContainerStatus {
  status: string;
  running: boolean;
  port?: number;
  health?: string;
  container_id?: string;
  container_name?: string;
}

interface MCPTool {
  name: string;
  description?: string;
  inputSchema?: any;
}

interface MCPToolsResponse {
  success: boolean;
  url?: string;
  containerName?: string;
  toolCount?: number;
  tools?: MCPTool[];
  error?: string;
}

class MCPServerManager {
  private mcpTools: MCPTool[] = [];
  private mcpUrl: string | null = null;
  private isConnected = false;
  private containerStatus: ContainerStatus | null = null;

  /**
   * Initialize MCP server by fetching tools list from server-side API
   * @param containerStatus - Container information from /api/containers/status
   */
  async initialize(containerStatus: ContainerStatus): Promise<MCPTool[]> {
    if (!containerStatus.running || !containerStatus.port) {
      console.warn('[MCPServerManager] Container is not running or port is not available');
      return [];
    }

    this.containerStatus = containerStatus;

    // Build public MCP URL for hostedMcpTool
    const publicDomain = typeof window !== 'undefined' ? window.location.hostname : 'rndaibot.ru';
    const protocol = typeof window !== 'undefined' && window.location.protocol === 'https:' ? 'https' : 'http';
    const containerName = containerStatus.container_name || 'mcpgoogle';
    const username = containerName.replace('mcpgoogle-', '');
    this.mcpUrl = `${protocol}://${publicDomain}/mcp/${username}`;

    console.log(`[MCPServerManager] MCP URL for hostedMcpTool: ${this.mcpUrl}`);
    console.log(`[MCPServerManager] Container: ${containerName}, Username: ${username}`);

    // Step 1: Verify MCP server is healthy
    try {
      console.log('[MCPServerManager] Verifying MCP server health...');
      const healthUrl = `${protocol}://${publicDomain}/mcp/${username}/health`;

      const healthResponse = await fetch(healthUrl, {
        method: 'GET',
        credentials: 'include',
      });

      if (!healthResponse.ok) {
        throw new Error(`MCP server health check failed: ${healthResponse.status} ${healthResponse.statusText}`);
      }

      const healthData = await healthResponse.json();
      console.log('[MCPServerManager] ✅ MCP server is healthy:', healthData);
    } catch (healthError) {
      console.error('[MCPServerManager] ❌ MCP server health check failed:', {
        error: healthError,
        message: healthError instanceof Error ? healthError.message : String(healthError),
      });
      this.isConnected = false;
      return [];
    }

    // Step 2: Fetch tools list from server-side API
    try {
      console.log('[MCPServerManager] Fetching MCP tools from server-side API...');

      const toolsResponse = await fetch(`/api/mcp/tools?container=${encodeURIComponent(containerName)}`, {
        method: 'GET',
        credentials: 'include',
      });

      if (!toolsResponse.ok) {
        const errorData = await toolsResponse.json();
        throw new Error(`Failed to fetch MCP tools: ${errorData.error || toolsResponse.statusText}`);
      }

      const toolsData: MCPToolsResponse = await toolsResponse.json();

      if (!toolsData.success || !toolsData.tools) {
        throw new Error(`MCP tools fetch unsuccessful: ${toolsData.error || 'Unknown error'}`);
      }

      this.mcpTools = toolsData.tools;
      this.isConnected = true;

      console.log(`[MCPServerManager] ✅ Successfully fetched ${this.mcpTools.length} MCP tools`);
      console.log('[MCPServerManager] Tools:', this.mcpTools.map(t => t.name));

      return this.mcpTools;
    } catch (toolsError) {
      console.error('[MCPServerManager] ❌ Failed to fetch MCP tools:', {
        error: toolsError,
        message: toolsError instanceof Error ? toolsError.message : String(toolsError),
      });
      this.isConnected = false;
      return [];
    }
  }

  /**
   * Get list of MCP tools
   */
  getTools(): MCPTool[] {
    return this.mcpTools;
  }

  /**
   * Get MCP URL for hostedMcpTool
   */
  getMcpUrl(): string | null {
    return this.mcpUrl;
  }

  /**
   * Check if MCP tools are available
   */
  isServerConnected(): boolean {
    return this.isConnected && this.mcpTools.length > 0;
  }

  /**
   * Disconnect and cleanup
   */
  async cleanup(): Promise<void> {
    console.log('[MCPServerManager] Cleaning up MCP tools...');
    this.isConnected = false;
    this.mcpTools = [];
    this.mcpUrl = null;
    this.containerStatus = null;
    console.log('[MCPServerManager] MCP tools cleaned up');
  }

  /**
   * Get container status
   */
  getContainerStatus(): ContainerStatus | null {
    return this.containerStatus;
  }

  /**
   * Fetch container status from API and initialize
   * @param accessToken - User access token for authentication (optional, uses cookies by default)
   */
  async fetchAndInitialize(accessToken?: string): Promise<MCPTool[]> {
    try {
      console.log('[MCPServerManager] Fetching container status...');
      const headers: HeadersInit = {};
      if (accessToken) {
        headers['Authorization'] = `Bearer ${accessToken}`;
      }

      const response = await fetch('/api/containers/status', {
        credentials: 'include',
        headers,
      });

      if (!response.ok) {
        console.warn('[MCPServerManager] Failed to fetch container status:', {
          status: response.status,
          statusText: response.statusText,
          url: response.url,
        });
        return [];
      }

      const containerStatus: ContainerStatus = await response.json();
      console.log('[MCPServerManager] Container status received:', {
        running: containerStatus.running,
        status: containerStatus.status,
        port: containerStatus.port,
        health: containerStatus.health,
        containerName: containerStatus.container_name,
      });

      return await this.initialize(containerStatus);
    } catch (error) {
      console.error('[MCPServerManager] Error fetching container status:', {
        error,
        message: error instanceof Error ? error.message : String(error),
        stack: error instanceof Error ? error.stack : undefined,
      });
      return [];
    }
  }
}

// Singleton instance
export const mcpServerManager = new MCPServerManager();

// Export types
export type { ContainerStatus, MCPTool };

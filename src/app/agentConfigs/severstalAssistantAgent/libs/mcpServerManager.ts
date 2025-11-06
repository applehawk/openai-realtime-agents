/**
 * MCP Server Manager
 *
 * Dynamically manages MCP server connection based on container status.
 * The MCP server is created and connected only when container info is available.
 */

import { MCPServerStreamableHttp } from '@openai/agents';

interface ContainerStatus {
  status: string;
  running: boolean;
  port?: number;
  health?: string;
  container_id?: string;
  container_name?: string;
}

class MCPServerManager {
  private mcpServer: MCPServerStreamableHttp | null = null;
  private isConnected = false;
  private containerStatus: ContainerStatus | null = null;

  /**
   * Initialize MCP server with container status
   * @param containerStatus - Container information from /api/containers/status
   */
  async initialize(containerStatus: ContainerStatus): Promise<MCPServerStreamableHttp | null> {
    if (!containerStatus.running || !containerStatus.port) {
      console.warn('[MCPServerManager] Container is not running or port is not available');
      return null;
    }

    this.containerStatus = containerStatus;

    // Create MCP server instance if not exists
    if (!this.mcpServer) {
      // MCP container binds to 0.0.0.0:8000 and is in the same oma-network
      // Use container name directly for inter-container communication
      const containerName = containerStatus.container_name || 'mcpgoogle';
      const url = `http://${containerName}:8000/mcp`; // FastMCP SSE endpoint
      console.log(`[MCPServerManager] Creating MCP server: ${url} (container: ${containerName})`);

      this.mcpServer = new MCPServerStreamableHttp({
        url,
        name: containerName,
        cacheToolsList: true, // Enable caching for better performance
      });
    }

    // Try to connect to MCP server
    // Note: In some versions, connect() might not be implemented for Streaming HTTP
    try {
      console.log('[MCPServerManager] Attempting to connect to MCP server...');
      // Check if connect method exists and is a function
      if (this.mcpServer.connect && typeof this.mcpServer.connect === 'function') {
        await this.mcpServer.connect();
        console.log('[MCPServerManager] Successfully connected to MCP server');
      } else {
        console.log('[MCPServerManager] connect() not available, using direct mode');
      }
      this.isConnected = true;
    } catch (error) {
      // If connect() throws "not implemented", just mark as connected
      // The server will work in direct HTTP mode
      const errorMsg = error instanceof Error ? error.message : String(error);
      if (errorMsg.includes('not implemented') || errorMsg.includes('Not implemented')) {
        console.log('[MCPServerManager] connect() not implemented, using direct HTTP mode');
        this.isConnected = true;
      } else {
        console.error('[MCPServerManager] Failed to connect to MCP server:', error);
        this.mcpServer = null;
        this.isConnected = false;
        return null;
      }
    }

    return this.mcpServer;
  }

  /**
   * Get current MCP server instance
   */
  getServer(): MCPServerStreamableHttp | null {
    return this.mcpServer;
  }

  /**
   * Check if MCP server is connected
   */
  isServerConnected(): boolean {
    return this.isConnected && this.mcpServer !== null;
  }

  /**
   * Disconnect and cleanup MCP server
   */
  async cleanup(): Promise<void> {
    // Streaming HTTP MCP doesn't need explicit close() call
    // Just clear the references
    console.log('[MCPServerManager] Cleaning up MCP server...');
    this.isConnected = false;
    this.mcpServer = null;
    this.containerStatus = null;
    console.log('[MCPServerManager] MCP server cleaned up');
  }

  /**
   * Get container status
   */
  getContainerStatus(): ContainerStatus | null {
    return this.containerStatus;
  }

  /**
   * Fetch container status from API and initialize MCP server
   * @param accessToken - User access token for authentication
   */
  async fetchAndInitialize(accessToken?: string): Promise<MCPServerStreamableHttp | null> {
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
        return null;
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
      return null;
    }
  }
}

// Singleton instance
export const mcpServerManager = new MCPServerManager();

// Export types
export type { ContainerStatus };

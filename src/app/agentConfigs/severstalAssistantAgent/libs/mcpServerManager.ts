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
      // Determine the correct host based on environment
      // - In Docker: use host.docker.internal to access host ports
      // - In development: use localhost
      // - In browser: MCP connection happens server-side, so this code runs in Node.js context
      const isDocker = process.env.DOCKER_ENV === 'true' || process.env.NODE_ENV === 'production';
      const host = isDocker ? 'host.docker.internal' : 'localhost';
      const url = `http://${host}:${containerStatus.port}`;
      console.log(`[MCPServerManager] Creating MCP server: ${url} (isDocker: ${isDocker}, NODE_ENV: ${process.env.NODE_ENV})`);

      this.mcpServer = new MCPServerStreamableHttp({
        url,
        name: containerStatus.container_name || 'mcpgoogle',
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
      const headers: HeadersInit = {};
      if (accessToken) {
        headers['Authorization'] = `Bearer ${accessToken}`;
      }

      const response = await fetch('/api/containers/status', {
        credentials: 'include',
        headers,
      });

      if (!response.ok) {
        console.warn('[MCPServerManager] Failed to fetch container status:', response.statusText);
        return null;
      }

      const containerStatus: ContainerStatus = await response.json();
      return await this.initialize(containerStatus);
    } catch (error) {
      console.error('[MCPServerManager] Error fetching container status:', error);
      return null;
    }
  }
}

// Singleton instance
export const mcpServerManager = new MCPServerManager();

// Export types
export type { ContainerStatus };

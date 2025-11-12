'use client';

import React, { useState, useEffect } from 'react';
import { useAuth } from '@/app/contexts/AuthContext';
import { cleanupMCPServer, initializeMCPServersBeforeAgent } from '@/app/agentConfigs/severstalAssistantAgent';
import styles from './UserProfile.module.css';

interface GoogleStatus {
  gmail_connected: boolean;
  calendar_connected: boolean;
}

interface ContainerStatus {
  status: string;
  running: boolean;
  port?: number;
  health?: string;
  container_id?: string;
  container_name?: string;
}

export default function UserProfile() {
  const { user, logout, refreshUser } = useAuth();
  const [showDropdown, setShowDropdown] = useState(false);
  const [googleStatus, setGoogleStatus] = useState<GoogleStatus | null>(null);
  const [containerStatus, setContainerStatus] = useState<ContainerStatus | null>(null);
  const [isConnecting, setIsConnecting] = useState(false);
  const [isContainerLoading, setIsContainerLoading] = useState(false);

  useEffect(() => {
    const skipGoogleConnectMcp = process.env.NEXT_PUBLIC_SKIP_GOOGLE_CONNECT_MCP === 'true';
    
    // Skip loading Google/container status if SKIP_GOOGLE_CONNECT_MCP is enabled
    if (skipGoogleConnectMcp) {
      console.log('[UserProfile] SKIP_GOOGLE_CONNECT_MCP=true: Skipping Google/container status loading');
      return;
    }
    
    if (user?.google_connected) {
      loadGoogleStatus();
      loadContainerStatus();
    }
  }, [user]);

  const loadGoogleStatus = async () => {
    try {
      const response = await fetch('/api/google/status', {
        credentials: 'include',
        headers: {
          'Content-Type': 'application/json',
        },
      }).catch((fetchError) => {
        // Network error (connection failed, CORS, etc.)
        console.error('Network error loading Google status:', fetchError);
        throw fetchError;
      });

      if (!response) {
        throw new Error('No response received');
      }

      if (response.ok) {
        try {
          const data = await response.json();
          setGoogleStatus(data);
        } catch (parseError) {
          console.error('Failed to parse Google status response:', parseError);
        }
      } else {
        // Handle non-OK responses
        try {
          const errorData = await response.json();
          console.error('Failed to load Google status:', {
            status: response.status,
            statusText: response.statusText,
            error: errorData,
          });
        } catch (parseError) {
          console.error('Failed to load Google status:', {
            status: response.status,
            statusText: response.statusText,
            parseError,
          });
        }
      }
    } catch (error) {
      console.error('Failed to load Google status:', error);
      // Error is already logged, component will handle gracefully
    }
  };

  const loadContainerStatus = async () => {
    try {
      const response = await fetch('/api/containers/status', {
        credentials: 'include',
        headers: {
          'Content-Type': 'application/json',
        },
      }).catch((fetchError) => {
        // Network error (connection failed, CORS, etc.)
        console.error('Network error loading container status:', fetchError);
        throw fetchError;
      });

      if (!response) {
        throw new Error('No response received');
      }

      if (response.ok) {
        try {
          const data = await response.json();
          setContainerStatus(data);
          // Note: MCP server initialization moved to App.tsx before connectToRealtime
        } catch (parseError) {
          console.error('Failed to parse container status response:', parseError);
        }
      } else {
        // Handle non-OK responses
        try {
          const errorData = await response.json();
          console.error('Failed to load container status:', {
            status: response.status,
            statusText: response.statusText,
            error: errorData,
          });
        } catch (parseError) {
          console.error('Failed to load container status:', {
            status: response.status,
            statusText: response.statusText,
            parseError,
          });
        }
      }
    } catch (error) {
      console.error('Failed to load container status:', error);
      // Error is already logged, component will handle gracefully
    }
  };

  const handleConnectGoogle = async () => {
    setIsConnecting(true);
    try {
      const response = await fetch('/api/google/auth-url', {
        credentials: 'include',
        headers: { 'X-Return-URL': window.location.href },
      });

      if (response.ok) {
        const data = await response.json();
        window.location.href = data.auth_url;
      } else {
        alert('Failed to get Google OAuth URL');
      }
    } catch (error) {
      console.error('Failed to connect Google:', error);
      alert('Failed to connect Google');
    } finally {
      setIsConnecting(false);
    }
  };

  const handleDisconnectGoogle = async () => {
    if (!confirm('Are you sure you want to disconnect your Google account?')) {
      return;
    }

    try {
      const response = await fetch('/api/google/disconnect', {
        method: 'DELETE',
        credentials: 'include',
      });

      if (response.ok) {
        // Cleanup MCP server when disconnecting Google
        console.log('[UserProfile] Google disconnected, cleaning up MCP server...');
        await cleanupMCPServer();

        alert('Google account disconnected');
        await refreshUser();
        setGoogleStatus(null);
        setContainerStatus(null);
      } else {
        alert('Failed to disconnect Google');
      }
    } catch (error) {
      console.error('Failed to disconnect Google:', error);
      alert('Failed to disconnect Google');
    }
  };

  const handleStartContainer = async () => {
    setIsContainerLoading(true);
    try {
      const response = await fetch('/api/containers/start', {
        method: 'POST',
        credentials: 'include',
      });

      if (!response.ok) {
        const error = await response.json().catch(() => ({ detail: 'Unknown error' }));
        alert(`Failed to start container: ${error.detail || 'Unknown error'}`);
        return;
      }

      // Ждём, пока контейнер поднимется и станет healthy (polling)
      const waitForReady = async (timeoutMs = 60_000, intervalMs = 2000): Promise<ContainerStatus> => {
        const start = Date.now();
        while (Date.now() - start < timeoutMs) {
          // Fetch fresh status directly, don't rely on state
          const response = await fetch('/api/containers/status', {
            credentials: 'include',
            headers: { 'Content-Type': 'application/json' },
          });

          if (response.ok) {
            const status: ContainerStatus = await response.json();

            // Update state for UI
            setContainerStatus(status);

            // Check if ready
            if (status.running && status.health === 'healthy' && status.port) {
              return status;
            }
          }

          // небольшой delay
          await new Promise((r) => setTimeout(r, intervalMs));
        }
        throw new Error('Container did not become healthy within timeout');
      };

      try {
        await waitForReady(120_000, 2000);
        alert('Container started and healthy. Initializing MCP client...');

        // вызываем initializeMCPServersBeforeAgent и ждём, пока MCP подключится
        // This will recreate the agent with connected MCP servers
        // Note: accessToken is not needed here - mcpServerManager will fetch it from cookies
        console.log('[UserProfile] 🚀 Initializing MCP servers and recreating agent...');
        const agentWithMcp = await initializeMCPServersBeforeAgent();

        if (!agentWithMcp) {
          throw new Error('initializeMCPServersBeforeAgent returned null - MCP initialization failed');
        }

        console.log('[UserProfile] ✅ MCP initialized and agent recreated successfully:', {
          agentName: agentWithMcp.name,
          mcpCount: agentWithMcp.mcpServers?.length || 0,
        });

        // Fetch and log available MCP tools via server endpoint
        try {
          console.log('[UserProfile] 🔍 Fetching available MCP tools...');
          const toolsResponse = await fetch('/api/mcp/tools', {
            credentials: 'include',
          });

          if (toolsResponse.ok) {
            const toolsData = await toolsResponse.json();
            console.log('[UserProfile] ✅ MCP tools available:', {
              count: toolsData.toolCount,
              tools: toolsData.tools?.map((t: any) => t.name) || []
            });
          } else {
            console.warn('[UserProfile] ⚠️ Failed to fetch MCP tools:', await toolsResponse.text());
          }
        } catch (toolsError) {
          console.error('[UserProfile] ⚠️ Error fetching MCP tools:', toolsError);
        }

        alert('MCP initialized successfully. Notifying app to connect to realtime.');
        window.dispatchEvent(new CustomEvent('mcp:ready'));
      } catch (err) {
        console.error('[UserProfile] MCP init failed:', err);
        alert('Container started but MCP initialization failed: ' + (err instanceof Error ? err.message : String(err)));
      }

    } catch (error) {
      console.error('Failed to start container:', error);
      alert('Failed to start container');
    } finally {
      setIsContainerLoading(false);
    }
  };

  const handleStopContainer = async () => {
    if (!confirm('Are you sure you want to stop the MCP container?')) {
      return;
    }

    setIsContainerLoading(true);
    try {
      const response = await fetch('/api/containers/stop', {
        method: 'POST',
        credentials: 'include',
      });

      if (response.ok) {
        // Cleanup MCP server connection before updating status
        console.log('[UserProfile] Container stopped, cleaning up MCP server...');
        await cleanupMCPServer();

        await loadContainerStatus();
        alert('Container stopped successfully');
      } else {
        const error = await response.json();
        alert(`Failed to stop container: ${error.detail || 'Unknown error'}`);
      }
    } catch (error) {
      console.error('Failed to stop container:', error);
      alert('Failed to stop container');
    } finally {
      setIsContainerLoading(false);
    }
  };

  if (!user) return null;

  return (
    <div className={styles.userProfile}>
      <button
        className={styles.userButton}
        onClick={() => setShowDropdown(!showDropdown)}
      >
        <span className={styles.userIcon}>👤</span>
        <span className={styles.username}>{user.username}</span>
      </button>

      {showDropdown && (
        <div className={styles.dropdown}>
          <div className={styles.userInfo}>
            <div className={styles.infoRow}>
              <span className={styles.label}>Email:</span>
              <span>{user.email}</span>
            </div>
            <div className={styles.infoRow}>
              <span className={styles.label}>Registered:</span>
              <span>{new Date(user.created_at).toLocaleDateString()}</span>
            </div>
          </div>

          <div className={styles.divider} />

          <div className={styles.googleSection}>
            <h4>Google Integration</h4>
            {user.google_connected ? (
              <>
                <div className={styles.googleServices}>
                  <div className={`${styles.serviceItem} ${googleStatus?.gmail_connected ? styles.connected : ''}`}>
                    📧 Gmail: <strong>{googleStatus?.gmail_connected ? 'Connected' : 'Not connected'}</strong>
                  </div>
                  <div className={`${styles.serviceItem} ${googleStatus?.calendar_connected ? styles.connected : ''}`}>
                    📅 Calendar: <strong>{googleStatus?.calendar_connected ? 'Connected' : 'Not connected'}</strong>
                  </div>
                </div>

                {/* MCP Container Status */}
                {containerStatus && (
                  <div className={styles.containerStatus} style={{ marginTop: '0.75rem' }}>
                    <div className={`${styles.serviceItem} ${containerStatus.running ? styles.connected : ''}`}>
                      🐳 MCP Container: <strong>{containerStatus.running ? 'Running' : 'Stopped'}</strong>
                      {containerStatus.running && containerStatus.port && (
                        <span style={{ fontSize: '0.85em', marginLeft: '0.5rem', opacity: 0.7 }}>
                          (port {containerStatus.port})
                        </span>
                      )}
                    </div>
                    {containerStatus.health && containerStatus.running && (
                      <div style={{ fontSize: '0.85em', marginTop: '0.25rem', opacity: 0.7, paddingLeft: '1.5rem' }}>
                        Health: {containerStatus.health}
                      </div>
                    )}
                    <div className={styles.containerControls} style={{ marginTop: '0.5rem', display: 'flex', gap: '0.5rem' }}>
                      {containerStatus.running ? (
                        <button
                          className={styles.btnDanger}
                          onClick={handleStopContainer}
                          disabled={isContainerLoading}
                          style={{ fontSize: '0.85em', padding: '0.4rem 0.8rem' }}
                        >
                          {isContainerLoading ? 'Stopping...' : 'Stop Container'}
                        </button>
                      ) : (
                        <button
                          className={styles.btnGoogle}
                          onClick={handleStartContainer}
                          disabled={isContainerLoading}
                          style={{ fontSize: '0.85em', padding: '0.4rem 0.8rem' }}
                        >
                          {isContainerLoading ? 'Starting...' : 'Start Container'}
                        </button>
                      )}
                    </div>
                  </div>
                )}
                <div className={styles.buttonGroup}>
                  <button
                    className={styles.btnGoogle}
                    onClick={handleConnectGoogle}
                    disabled={isConnecting}
                  >
                    Reconnect
                  </button>
                  <button
                    className={styles.btnDanger}
                    onClick={handleDisconnectGoogle}
                  >
                    Disconnect
                  </button>
                </div>
              </>
            ) : (
              <button
                className={styles.btnGoogle}
                onClick={handleConnectGoogle}
                disabled={isConnecting}
              >
                <svg width="18" height="18" viewBox="0 0 18 18">
                  <path fill="#4285F4" d="M17.64 9.2c0-.637-.057-1.251-.164-1.84H9v3.481h4.844c-.209 1.125-.843 2.078-1.796 2.717v2.258h2.908c1.702-1.567 2.684-3.875 2.684-6.615z"/>
                  <path fill="#34A853" d="M9.003 18c2.43 0 4.467-.806 5.956-2.18L12.05 13.56c-.806.54-1.836.86-3.047.86-2.344 0-4.328-1.584-5.036-3.711H.96v2.332C2.438 15.983 5.482 18 9.003 18z"/>
                  <path fill="#FBBC05" d="M3.964 10.712c-.18-.54-.282-1.117-.282-1.71 0-.593.102-1.17.282-1.71V4.96H.957C.347 6.175 0 7.55 0 9.002c0 1.452.348 2.827.957 4.042l3.007-2.332z"/>
                  <path fill="#EA4335" d="M9.003 3.58c1.321 0 2.508.454 3.44 1.345l2.582-2.58C13.464.891 11.426 0 9.003 0 5.482 0 2.438 2.017.96 4.958L3.967 7.29c.708-2.127 2.692-3.71 5.036-3.71z"/>
                </svg>
                {isConnecting ? 'Connecting...' : 'Connect Google'}
              </button>
            )}
          </div>

          <div className={styles.divider} />

          <button className={styles.logoutButton} onClick={logout}>
            Logout
          </button>
        </div>
      )}
    </div>
  );
}

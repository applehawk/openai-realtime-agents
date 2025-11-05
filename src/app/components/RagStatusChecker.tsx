'use client';

import React, { useState, useEffect } from 'react';

interface RagStatus {
  ragApi: boolean;
  ragMcp: boolean;
  ragProxy: boolean;
  loading: boolean;
  error?: string;
}

export default function RagStatusChecker() {
  const [status, setStatus] = useState<RagStatus>({
    ragApi: false,
    ragMcp: false,
    ragProxy: false,
    loading: true,
  });

  const checkRagStatus = async () => {
    setStatus(prev => ({ ...prev, loading: true, error: undefined }));

    try {
      // Check RAG API directly
      const ragApiResponse = await fetch('/api/test-mcp', {
        method: 'GET',
        signal: AbortSignal.timeout(5000),
      });
      const ragApiOk = ragApiResponse.ok;

      // Check RAG MCP tools
      const ragMcpResponse = await fetch('/api/test-mcp-tools', {
        method: 'GET',
        signal: AbortSignal.timeout(10000),
      });
      const ragMcpOk = ragMcpResponse.ok;

      // Check RAG Proxy
      const ragProxyResponse = await fetch('/api/rag', {
        method: 'GET',
        signal: AbortSignal.timeout(5000),
      });
      const ragProxyOk = ragProxyResponse.ok;

      setStatus({
        ragApi: ragApiOk,
        ragMcp: ragMcpOk,
        ragProxy: ragProxyOk,
        loading: false,
      });
    } catch (error: any) {
      setStatus(prev => ({
        ...prev,
        loading: false,
        error: error.message,
      }));
    }
  };

  useEffect(() => {
    checkRagStatus();
  }, []);

  const getStatusIcon = (isOk: boolean) => isOk ? '✅' : '❌';
  const getStatusColor = (isOk: boolean) => isOk ? '#28a745' : '#dc3545';

  return (
    <div style={{
      padding: '15px',
      border: '1px solid #ddd',
      borderRadius: '8px',
      backgroundColor: '#f8f9fa',
      fontFamily: 'monospace',
      fontSize: '14px',
    }}>
      <h3 style={{ margin: '0 0 15px 0', fontSize: '16px' }}>
        RAG Connection Status
        <button
          onClick={checkRagStatus}
          disabled={status.loading}
          style={{
            marginLeft: '10px',
            padding: '5px 10px',
            fontSize: '12px',
            backgroundColor: '#007bff',
            color: 'white',
            border: 'none',
            borderRadius: '4px',
            cursor: status.loading ? 'not-allowed' : 'pointer',
          }}
        >
          {status.loading ? 'Checking...' : 'Refresh'}
        </button>
      </h3>

      {status.error && (
        <div style={{ color: '#dc3545', marginBottom: '10px' }}>
          Error: {status.error}
        </div>
      )}

      <div style={{ display: 'grid', gap: '8px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <span>{getStatusIcon(status.ragApi)}</span>
          <span style={{ color: getStatusColor(status.ragApi) }}>
            RAG API Direct
          </span>
          <span style={{ fontSize: '12px', color: '#666' }}>
            (/api/test-mcp)
          </span>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <span>{getStatusIcon(status.ragMcp)}</span>
          <span style={{ color: getStatusColor(status.ragMcp) }}>
            RAG MCP Tools
          </span>
          <span style={{ fontSize: '12px', color: '#666' }}>
            (/api/test-mcp-tools)
          </span>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <span>{getStatusIcon(status.ragProxy)}</span>
          <span style={{ color: getStatusColor(status.ragProxy) }}>
            RAG Proxy
          </span>
          <span style={{ fontSize: '12px', color: '#666' }}>
            (/api/rag)
          </span>
        </div>
      </div>

      <div style={{ marginTop: '15px', fontSize: '12px', color: '#666' }}>
        <div>Last checked: {new Date().toLocaleTimeString()}</div>
        <div style={{ marginTop: '5px' }}>
          <a href="/test-mcp" target="_blank" style={{ color: '#007bff' }}>
            Open detailed MCP test page →
          </a>
        </div>
      </div>
    </div>
  );
}

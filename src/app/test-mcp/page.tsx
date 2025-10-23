'use client';

import React, { useEffect, useState } from 'react';
import { verifyMcpToolsConnection, type McpToolVerification } from '@/app/agentConfigs/severstalAssistantAgent/libs/verifyMcpTools';

/**
 * Test page to verify MCP tools are connected to severstalAssistant
 *
 * Navigate to http://localhost:3000/test-mcp to view this page
 */
export default function TestMcpPage() {
  const [verification, setVerification] = useState<McpToolVerification | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Run verification when component mounts
    try {
      const result = verifyMcpToolsConnection();
      setVerification(result);
    } catch (error) {
      console.error('Failed to verify MCP tools:', error);
    } finally {
      setLoading(false);
    }
  }, []);

  if (loading) {
    return (
      <div style={{ padding: '20px', fontFamily: 'monospace' }}>
        <h1>MCP Tools Verification</h1>
        <p>Loading...</p>
      </div>
    );
  }

  if (!verification) {
    return (
      <div style={{ padding: '20px', fontFamily: 'monospace' }}>
        <h1>MCP Tools Verification</h1>
        <p style={{ color: 'red' }}>Failed to run verification</p>
      </div>
    );
  }

  return (
    <div style={{ padding: '20px', fontFamily: 'monospace', maxWidth: '1200px' }}>
      <h1>MCP Tools Verification for severstalAssistant</h1>

      <section style={{ marginBottom: '30px' }}>
        <h2>Connection Status</h2>
        <div style={{
          padding: '10px',
          borderRadius: '5px',
          backgroundColor: verification.isConnected ? '#d4edda' : '#f8d7da',
          border: `1px solid ${verification.isConnected ? '#c3e6cb' : '#f5c6cb'}`,
          color: verification.isConnected ? '#155724' : '#721c24',
          fontWeight: 'bold',
        }}>
          {verification.isConnected ? '✅ MCP Tools Connected' : '❌ MCP Tools Not Connected'}
        </div>
      </section>

      <section style={{ marginBottom: '30px' }}>
        <h2>Summary</h2>
        <ul>
          <li><strong>Total Tools:</strong> {verification.toolCount}</li>
          <li><strong>MCP Tools Detected:</strong> {verification.mcpTools.length}</li>
          <li><strong>Errors:</strong> {verification.errors.length}</li>
          <li><strong>Warnings:</strong> {verification.warnings.length}</li>
        </ul>
      </section>

      {verification.errors.length > 0 && (
        <section style={{ marginBottom: '30px' }}>
          <h2 style={{ color: '#dc3545' }}>Errors</h2>
          <ul>
            {verification.errors.map((error, index) => (
              <li key={index} style={{ color: '#dc3545' }}>{error}</li>
            ))}
          </ul>
        </section>
      )}

      {verification.warnings.length > 0 && (
        <section style={{ marginBottom: '30px' }}>
          <h2 style={{ color: '#ffc107' }}>Warnings</h2>
          <ul>
            {verification.warnings.map((warning, index) => (
              <li key={index} style={{ color: '#856404' }}>{warning}</li>
            ))}
          </ul>
        </section>
      )}

      <section style={{ marginBottom: '30px' }}>
        <h2>MCP Tools Details</h2>
        {verification.mcpTools.length === 0 ? (
          <p style={{ fontStyle: 'italic' }}>No MCP tools detected</p>
        ) : (
          <table style={{ width: '100%', borderCollapse: 'collapse', border: '1px solid #ddd' }}>
            <thead>
              <tr style={{ backgroundColor: '#f8f9fa' }}>
                <th style={{ border: '1px solid #ddd', padding: '8px', textAlign: 'left' }}>Server Label</th>
                <th style={{ border: '1px solid #ddd', padding: '8px', textAlign: 'left' }}>Server URL</th>
                <th style={{ border: '1px solid #ddd', padding: '8px', textAlign: 'left' }}>Type</th>
                <th style={{ border: '1px solid #ddd', padding: '8px', textAlign: 'left' }}>Name</th>
              </tr>
            </thead>
            <tbody>
              {verification.mcpTools.map((tool, index) => (
                <tr key={index}>
                  <td style={{ border: '1px solid #ddd', padding: '8px' }}>{tool.serverLabel || '-'}</td>
                  <td style={{ border: '1px solid #ddd', padding: '8px', fontSize: '12px' }}>
                    {tool.serverUrl || '-'}
                  </td>
                  <td style={{ border: '1px solid #ddd', padding: '8px' }}>{tool.type || '-'}</td>
                  <td style={{ border: '1px solid #ddd', padding: '8px' }}>{tool.name || '-'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>

      <section style={{ marginBottom: '30px' }}>
        <h2>Next Steps</h2>
        <ol>
          <li>Check the browser console for detailed logs</li>
          <li>If MCP tools are detected, try running the main app and triggering a tool call</li>
          <li>Monitor the network tab for requests to the MCP server URLs</li>
          <li>Check the event logs in the main app for tool execution events</li>
        </ol>
      </section>

      <section style={{
        marginTop: '40px',
        padding: '15px',
        backgroundColor: '#e7f3ff',
        border: '1px solid #b3d7ff',
        borderRadius: '5px'
      }}>
        <h3>How to Verify in Production</h3>
        <p>When running the main app:</p>
        <ol>
          <li>Start the dev server: <code>npm run dev</code></li>
          <li>Select &ldquo;Severstal Assistant&rdquo; scenario from the dropdown</li>
          <li>Open browser DevTools console</li>
          <li>Look for logs starting with <code>[severstalAssistant]</code></li>
          <li>Connect to the session and try asking: &ldquo;Прочитай последнее письмо&rdquo;</li>
          <li>Check the Events pane (right side) for tool execution events</li>
          <li>Look for <code>session.update</code> events showing available tools</li>
        </ol>
      </section>
    </div>
  );
}

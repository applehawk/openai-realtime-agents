'use client';

import React, { useState } from 'react';

export default function WorkspaceDebugPage() {
  const [userId, setUserId] = useState('ddc27713-ad98-4caa-9fd1-546c720228f7');
  const [results, setResults] = useState<any>({});
  const [loading, setLoading] = useState(false);

  const testWorkspaceBehavior = async () => {
    setLoading(true);
    setResults({});

    const workspaceName = `${userId}_user_key_preferences`;
    
    try {
      // Test 1: Query with specific workspace
      console.log('=== Test 1: Query with specific workspace ===');
      const response1 = await fetch('/api/rag', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          jsonrpc: '2.0',
          id: 1,
          method: 'tools/call',
          params: {
            name: 'lightrag_query',
            arguments: {
              query: `компетенции пользователя ${userId}`,
              mode: 'local',
              top_k: 3,
              workspace: workspaceName,
              include_references: true,
            },
          },
        }),
      });
      const data1 = await response1.json();

      // Test 2: Query without workspace (should use default)
      console.log('=== Test 2: Query without workspace (default) ===');
      const response2 = await fetch('/api/rag', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          jsonrpc: '2.0',
          id: 2,
          method: 'tools/call',
          params: {
            name: 'lightrag_query',
            arguments: {
              query: `компетенции пользователя ${userId}`,
              mode: 'local',
              top_k: 3,
              include_references: true,
            },
          },
        }),
      });
      const data2 = await response2.json();

      // Test 3: Query with different workspace name
      console.log('=== Test 3: Query with different workspace ===');
      const response3 = await fetch('/api/rag', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          jsonrpc: '2.0',
          id: 3,
          method: 'tools/call',
          params: {
            name: 'lightrag_query',
            arguments: {
              query: `компетенции пользователя ${userId}`,
              mode: 'local',
              top_k: 3,
              workspace: 'test_workspace_123',
              include_references: true,
            },
          },
        }),
      });
      const data3 = await response3.json();

      setResults({
        workspaceName,
        test1_withWorkspace: {
          request: { workspace: workspaceName },
          response: data1,
          content: data1.result?.content?.[0]?.text?.substring(0, 200),
        },
        test2_withoutWorkspace: {
          request: { workspace: 'default' },
          response: data2,
          content: data2.result?.content?.[0]?.text?.substring(0, 200),
        },
        test3_differentWorkspace: {
          request: { workspace: 'test_workspace_123' },
          response: data3,
          content: data3.result?.content?.[0]?.text?.substring(0, 200),
        },
      });

    } catch (error: any) {
      setResults({ error: error.message });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{ padding: '20px', fontFamily: 'monospace' }}>
      <h1>Workspace Debug Test</h1>
      
      <div style={{ marginBottom: '20px' }}>
        <label>
          User ID:
          <input
            type="text"
            value={userId}
            onChange={(e) => setUserId(e.target.value)}
            style={{ marginLeft: '10px', padding: '5px', width: '300px' }}
          />
        </label>
        <div style={{ marginTop: '5px', fontSize: '12px', color: '#666' }}>
          Testing workspace: {userId}_user_key_preferences
        </div>
      </div>

      <button
        onClick={testWorkspaceBehavior}
        disabled={loading}
        style={{
          padding: '10px 20px',
          fontSize: '16px',
          backgroundColor: loading ? '#6c757d' : '#007bff',
          color: 'white',
          border: 'none',
          borderRadius: '5px',
          cursor: loading ? 'not-allowed' : 'pointer',
        }}
      >
        {loading ? 'Testing...' : 'Test Workspace Behavior'}
      </button>

      {Object.keys(results).length > 0 && (
        <div style={{ marginTop: '20px' }}>
          <h2>Test Results:</h2>
          
          {results.workspaceName && (
            <div style={{ marginBottom: '15px', padding: '10px', backgroundColor: '#e7f3ff', borderRadius: '5px' }}>
              <strong>Testing workspace:</strong> {results.workspaceName}
            </div>
          )}

          {results.test1_withWorkspace && (
            <div style={{ marginBottom: '20px', padding: '15px', border: '1px solid #ddd', borderRadius: '5px' }}>
              <h3>Test 1: With User Workspace</h3>
              <div style={{ fontSize: '12px', color: '#666', marginBottom: '10px' }}>
                Request: workspace = &quot;{results.test1_withWorkspace.request.workspace}&quot;
              </div>
              <div style={{ fontSize: '12px', marginBottom: '10px' }}>
                Content: {results.test1_withWorkspace.content || 'No content'}
              </div>
              <details>
                <summary>Full Response</summary>
                <pre style={{ fontSize: '10px', maxHeight: '200px', overflow: 'auto' }}>
                  {JSON.stringify(results.test1_withWorkspace.response, null, 2)}
                </pre>
              </details>
            </div>
          )}

          {results.test2_withoutWorkspace && (
            <div style={{ marginBottom: '20px', padding: '15px', border: '1px solid #ddd', borderRadius: '5px' }}>
              <h3>Test 2: Without Workspace (Default)</h3>
              <div style={{ fontSize: '12px', color: '#666', marginBottom: '10px' }}>
                Request: workspace = &quot;default&quot;
              </div>
              <div style={{ fontSize: '12px', marginBottom: '10px' }}>
                Content: {results.test2_withoutWorkspace.content || 'No content'}
              </div>
              <details>
                <summary>Full Response</summary>
                <pre style={{ fontSize: '10px', maxHeight: '200px', overflow: 'auto' }}>
                  {JSON.stringify(results.test2_withoutWorkspace.response, null, 2)}
                </pre>
              </details>
            </div>
          )}

          {results.test3_differentWorkspace && (
            <div style={{ marginBottom: '20px', padding: '15px', border: '1px solid #ddd', borderRadius: '5px' }}>
              <h3>Test 3: Different Workspace</h3>
              <div style={{ fontSize: '12px', color: '#666', marginBottom: '10px' }}>
                Request: workspace = &quot;test_workspace_123&quot;
              </div>
              <div style={{ fontSize: '12px', marginBottom: '10px' }}>
                Content: {results.test3_differentWorkspace.content || 'No content'}
              </div>
              <details>
                <summary>Full Response</summary>
                <pre style={{ fontSize: '10px', maxHeight: '200px', overflow: 'auto' }}>
                  {JSON.stringify(results.test3_differentWorkspace.response, null, 2)}
                </pre>
              </details>
            </div>
          )}

          {results.error && (
            <div style={{ color: '#dc3545', padding: '15px', backgroundColor: '#f8d7da', borderRadius: '5px' }}>
              Error: {results.error}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

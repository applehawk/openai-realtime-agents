'use client';

import React, { useState } from 'react';

export default function WorkspaceTestPage() {
  const [userId, setUserId] = useState('ddc27713-ad98-4caa-9fd1-546c720228f7');
  const [result, setResult] = useState<any>(null);
  const [loading, setLoading] = useState(false);

  const testWorkspaceQuery = async () => {
    setLoading(true);
    setResult(null);

    try {
      const workspaceName = `${userId}_user_key_preferences`;
      
      const response = await fetch('/api/rag', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          jsonrpc: '2.0',
          id: Date.now(),
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

      const data = await response.json();
      setResult({
        workspaceName,
        requestBody: {
          query: `компетенции пользователя ${userId}`,
          workspace: workspaceName,
        },
        response: data,
      });
    } catch (error: any) {
      setResult({ error: error.message });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{ padding: '20px', fontFamily: 'monospace' }}>
      <h1>Workspace Test</h1>
      
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
          Workspace will be: {userId}_user_key_preferences
        </div>
      </div>

      <button
        onClick={testWorkspaceQuery}
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
        {loading ? 'Testing...' : 'Test Workspace Query'}
      </button>

      {result && (
        <div style={{ marginTop: '20px' }}>
          <h2>Result:</h2>
          <pre style={{
            padding: '15px',
            backgroundColor: '#f8f9fa',
            border: '1px solid #e9ecef',
            borderRadius: '5px',
            overflow: 'auto',
            maxHeight: '500px',
          }}>
            {JSON.stringify(result, null, 2)}
          </pre>
        </div>
      )}
    </div>
  );
}

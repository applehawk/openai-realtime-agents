'use client';

import React, { useState } from 'react';

export default function RagToolsPage() {
  const [tools, setTools] = useState<any>(null);
  const [loading, setLoading] = useState(false);

  const getRagTools = async () => {
    setLoading(true);
    setTools(null);

    try {
      const response = await fetch('/api/rag', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          jsonrpc: '2.0',
          id: 1,
          method: 'tools/list',
          params: {},
        }),
      });

      const data = await response.json();
      setTools(data);
    } catch (error: any) {
      setTools({ error: error.message });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{ padding: '20px', fontFamily: 'monospace' }}>
      <h1>RAG Tools List</h1>
      
      <button
        onClick={getRagTools}
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
        {loading ? 'Loading...' : 'Get RAG Tools'}
      </button>

      {tools && (
        <div style={{ marginTop: '20px' }}>
          <h2>Available RAG Tools:</h2>
          <pre style={{
            padding: '15px',
            backgroundColor: '#f8f9fa',
            border: '1px solid #e9ecef',
            borderRadius: '5px',
            overflow: 'auto',
            maxHeight: '600px',
          }}>
            {JSON.stringify(tools, null, 2)}
          </pre>
        </div>
      )}
    </div>
  );
}

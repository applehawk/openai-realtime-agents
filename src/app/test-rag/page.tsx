'use client';

import React, { useState, useEffect } from 'react';

interface RagTestResult {
  endpoint: string;
  success: boolean;
  status?: number;
  data?: any;
  error?: string;
  responseTime?: number;
}

export default function RagTestPage() {
  const [results, setResults] = useState<RagTestResult[]>([]);
  const [loading, setLoading] = useState(false);

  const testEndpoint = async (endpoint: string, method: string = 'GET'): Promise<RagTestResult> => {
    const startTime = Date.now();
    
    try {
      const response = await fetch(endpoint, {
        method,
        signal: AbortSignal.timeout(10000),
      });

      const responseTime = Date.now() - startTime;
      let data;
      
      try {
        data = await response.json();
      } catch {
        data = await response.text();
      }

      return {
        endpoint,
        success: response.ok,
        status: response.status,
        data,
        responseTime,
      };
    } catch (error: any) {
      return {
        endpoint,
        success: false,
        error: error.message,
        responseTime: Date.now() - startTime,
      };
    }
  };

  const runAllTests = async () => {
    setLoading(true);
    setResults([]);

    const endpoints = [
      { url: '/api/test-mcp', name: 'RAG API Direct' },
      { url: '/api/test-mcp-tools', name: 'RAG MCP Tools' },
      { url: '/api/rag', name: 'RAG Proxy Health' },
      { url: '/api/interview', name: 'Interview API' },
    ];

    const testResults: RagTestResult[] = [];

    for (const endpoint of endpoints) {
      const result = await testEndpoint(endpoint.url);
      testResults.push(result);
      setResults([...testResults]); // Update UI progressively
    }

    setLoading(false);
  };

  useEffect(() => {
    runAllTests();
  }, []);

  const getStatusIcon = (success: boolean) => success ? '✅' : '❌';
  const getStatusColor = (success: boolean) => success ? '#28a745' : '#dc3545';

  return (
    <div style={{
      padding: '20px',
      fontFamily: 'monospace',
      maxWidth: '1000px',
      margin: '0 auto',
    }}>
      <h1>RAG Connection Test Dashboard</h1>
      
      <div style={{ marginBottom: '20px' }}>
        <button
          onClick={runAllTests}
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
          {loading ? 'Testing...' : 'Run All Tests'}
        </button>
      </div>

      {results.length > 0 && (
        <div style={{ marginBottom: '20px' }}>
          <h2>Test Results</h2>
          {results.map((result, index) => (
            <div
              key={index}
              style={{
                marginBottom: '15px',
                padding: '15px',
                border: '1px solid #ddd',
                borderRadius: '5px',
                backgroundColor: result.success ? '#d4edda' : '#f8d7da',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '10px' }}>
                <span style={{ fontSize: '18px' }}>{getStatusIcon(result.success)}</span>
                <span style={{ fontWeight: 'bold', color: getStatusColor(result.success) }}>
                  {result.endpoint}
                </span>
                {result.responseTime && (
                  <span style={{ fontSize: '12px', color: '#666' }}>
                    ({result.responseTime}ms)
                  </span>
                )}
              </div>

              {result.status && (
                <div style={{ fontSize: '12px', color: '#666', marginBottom: '5px' }}>
                  Status: {result.status}
                </div>
              )}

              {result.error && (
                <div style={{ color: '#dc3545', fontSize: '12px' }}>
                  Error: {result.error}
                </div>
              )}

              {result.data && (
                <details style={{ marginTop: '10px' }}>
                  <summary style={{ cursor: 'pointer', fontSize: '12px' }}>
                    Response Data
                  </summary>
                  <pre style={{
                    marginTop: '10px',
                    padding: '10px',
                    backgroundColor: '#f8f9fa',
                    border: '1px solid #e9ecef',
                    borderRadius: '3px',
                    fontSize: '11px',
                    overflow: 'auto',
                    maxHeight: '200px',
                  }}>
                    {JSON.stringify(result.data, null, 2)}
                  </pre>
                </details>
              )}
            </div>
          ))}
        </div>
      )}

      <div style={{
        marginTop: '30px',
        padding: '15px',
        backgroundColor: '#e7f3ff',
        border: '1px solid #b3d7ff',
        borderRadius: '5px',
      }}>
        <h3>Available Test Endpoints:</h3>
        <ul>
          <li><code>/api/test-mcp</code> - Direct RAG API health check</li>
          <li><code>/api/test-mcp-tools</code> - RAG MCP tools test with actual query</li>
          <li><code>/api/rag</code> - RAG proxy health check</li>
          <li><code>/api/interview</code> - Interview API test</li>
        </ul>
        
        <div style={{ marginTop: '15px' }}>
          <a href="/test-mcp" target="_blank" style={{ color: '#007bff' }}>
            Open detailed MCP test page →
          </a>
        </div>
      </div>
    </div>
  );
}

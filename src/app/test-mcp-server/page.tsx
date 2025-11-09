'use client';

import React, { useState, useEffect } from 'react';

interface ContainerStatus {
  status: string;
  running: boolean;
  port?: number;
  health?: string;
  container_id?: string;
  container_name?: string;
}

interface TestResult {
  timestamp: string;
  action: string;
  success: boolean;
  message: string;
  data?: any;
}

export default function TestMCPServer() {
  const [containerStatus, setContainerStatus] = useState<ContainerStatus | null>(null);
  const [mcpConnected, setMcpConnected] = useState<boolean>(false);
  const [testResults, setTestResults] = useState<TestResult[]>([]);
  const [loading, setLoading] = useState<Record<string, boolean>>({});
  const [emailTo, setEmailTo] = useState<string>('');
  const [emailSubject, setEmailSubject] = useState<string>('Test Email from MCP');
  const [emailBody, setEmailBody] = useState<string>('This is a test email sent via MCP server.');

  useEffect(() => {
    loadContainerStatus();
    checkMCPConnection();
  }, []);

  const addTestResult = (action: string, success: boolean, message: string, data?: any) => {
    const result: TestResult = {
      timestamp: new Date().toISOString(),
      action,
      success,
      message,
      data,
    };
    setTestResults(prev => [result, ...prev]);
  };

  const loadContainerStatus = async () => {
    setLoading(prev => ({ ...prev, status: true }));
    try {
      const response = await fetch('/api/containers/status', {
        credentials: 'include',
      });

      if (response.ok) {
        const data = await response.json();
        setContainerStatus(data);
        addTestResult('Load Status', true, `Container status: ${data.status}`, data);
      } else {
        const error = await response.text();
        addTestResult('Load Status', false, `Failed: ${error}`);
      }
    } catch (error: any) {
      addTestResult('Load Status', false, `Error: ${error.message}`);
    } finally {
      setLoading(prev => ({ ...prev, status: false }));
    }
  };

  const checkMCPConnection = async () => {
    try {
      const response = await fetch('/api/mcp/status', {
        credentials: 'include',
      });

      if (response.ok) {
        const data = await response.json();
        setMcpConnected(data.connected);
        addTestResult('Check MCP Connection', data.connected, data.connected ? 'MCP is connected' : 'MCP is not connected', data);
      } else {
        setMcpConnected(false);
        addTestResult('Check MCP Connection', false, 'Failed to check MCP status');
      }
    } catch (error: any) {
      setMcpConnected(false);
      addTestResult('Check MCP Connection', false, `Error: ${error.message}`);
    }
  };

  const handleStartContainer = async () => {
    setLoading(prev => ({ ...prev, start: true }));
    try {
      const response = await fetch('/api/containers/start', {
        method: 'POST',
        credentials: 'include',
      });

      if (response.ok) {
        const data = await response.json();
        addTestResult('Start Container', true, 'Container started successfully', data);
        await loadContainerStatus();
      } else {
        const error = await response.text();
        addTestResult('Start Container', false, `Failed: ${error}`);
      }
    } catch (error: any) {
      addTestResult('Start Container', false, `Error: ${error.message}`);
    } finally {
      setLoading(prev => ({ ...prev, start: false }));
    }
  };

  const handleStopContainer = async () => {
    setLoading(prev => ({ ...prev, stop: true }));
    try {
      const response = await fetch('/api/containers/stop', {
        method: 'POST',
        credentials: 'include',
      });

      if (response.ok) {
        const data = await response.json();
        addTestResult('Stop Container', true, 'Container stopped successfully', data);
        await loadContainerStatus();
      } else {
        const error = await response.text();
        addTestResult('Stop Container', false, `Failed: ${error}`);
      }
    } catch (error: any) {
      addTestResult('Stop Container', false, `Error: ${error.message}`);
    } finally {
      setLoading(prev => ({ ...prev, stop: false }));
    }
  };

  const handleInitializeMCP = async () => {
    setLoading(prev => ({ ...prev, init: true }));
    try {
      const response = await fetch('/api/mcp/initialize', {
        method: 'POST',
        credentials: 'include',
      });

      if (response.ok) {
        const data = await response.json();
        addTestResult('Initialize MCP', true, 'MCP server initialized successfully', data);
        await checkMCPConnection();
      } else {
        const error = await response.json();
        addTestResult('Initialize MCP', false, `Failed: ${error.error || 'Unknown error'}`, error);
      }
    } catch (error: any) {
      addTestResult('Initialize MCP', false, `Error: ${error.message}`);
    } finally {
      setLoading(prev => ({ ...prev, init: false }));
    }
  };

  const handleCheckMCPTools = async () => {
    setLoading(prev => ({ ...prev, tools: true }));
    try {
      const containerName = containerStatus?.container_name || 'mcpgoogle';
      const response = await fetch(`/api/mcp/tools?container=${containerName}`, {
        credentials: 'include',
      });

      if (response.ok) {
        const data = await response.json();
        addTestResult('Check MCP Tools', true, `Found ${data.toolCount || 0} tools`, data);
      } else {
        const error = await response.json();
        addTestResult('Check MCP Tools', false, `Failed: ${error.error || 'Unknown error'}`, error);
      }
    } catch (error: any) {
      addTestResult('Check MCP Tools', false, `Error: ${error.message}`);
    } finally {
      setLoading(prev => ({ ...prev, tools: false }));
    }
  };

  const handleSendTestEmail = async () => {
    if (!emailTo) {
      alert('Please enter recipient email');
      return;
    }

    setLoading(prev => ({ ...prev, email: true }));
    try {
      // Use MCP server to send email via Gmail
      const response = await fetch('/api/test-mcp-email', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        credentials: 'include',
        body: JSON.stringify({
          to: emailTo,
          subject: emailSubject,
          body: emailBody,
        }),
      });

      if (response.ok) {
        const data = await response.json();
        addTestResult('Send Email', true, 'Email sent successfully via MCP', data);
      } else {
        const error = await response.text();
        addTestResult('Send Email', false, `Failed: ${error}`);
      }
    } catch (error: any) {
      addTestResult('Send Email', false, `Error: ${error.message}`);
    } finally {
      setLoading(prev => ({ ...prev, email: false }));
    }
  };

  const clearResults = () => {
    setTestResults([]);
  };

  return (
    <div className="min-h-screen bg-gray-100 p-8">
      <div className="max-w-6xl mx-auto">
        <h1 className="text-3xl font-bold mb-8 text-gray-800">MCP Server Test Panel</h1>

        {/* Status Panel */}
        <div className="bg-white rounded-lg shadow-md p-6 mb-6">
          <h2 className="text-xl font-semibold mb-4">Status</h2>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <p className="text-sm text-gray-600">Container Status</p>
              <p className="text-lg font-semibold">
                {containerStatus ? (
                  <span className={containerStatus.running ? 'text-green-600' : 'text-red-600'}>
                    {containerStatus.status}
                  </span>
                ) : (
                  'Loading...'
                )}
              </p>
            </div>
            <div>
              <p className="text-sm text-gray-600">MCP Connection</p>
              <p className="text-lg font-semibold">
                <span className={mcpConnected ? 'text-green-600' : 'text-red-600'}>
                  {mcpConnected ? 'Connected' : 'Not Connected'}
                </span>
              </p>
            </div>
            {containerStatus?.port && (
              <div>
                <p className="text-sm text-gray-600">Port</p>
                <p className="text-lg font-semibold">{containerStatus.port}</p>
              </div>
            )}
            {containerStatus?.container_name && (
              <div>
                <p className="text-sm text-gray-600">Container Name</p>
                <p className="text-lg font-semibold">{containerStatus.container_name}</p>
              </div>
            )}
          </div>
        </div>

        {/* Control Panel */}
        <div className="bg-white rounded-lg shadow-md p-6 mb-6">
          <h2 className="text-xl font-semibold mb-4">Controls</h2>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-4">
            <button
              onClick={loadContainerStatus}
              disabled={loading.status}
              className="bg-blue-500 hover:bg-blue-600 text-white font-semibold py-2 px-4 rounded disabled:opacity-50"
            >
              {loading.status ? 'Loading...' : 'Refresh Status'}
            </button>
            <button
              onClick={handleStartContainer}
              disabled={loading.start || containerStatus?.running}
              className="bg-green-500 hover:bg-green-600 text-white font-semibold py-2 px-4 rounded disabled:opacity-50"
            >
              {loading.start ? 'Starting...' : 'Start Container'}
            </button>
            <button
              onClick={handleStopContainer}
              disabled={loading.stop || !containerStatus?.running}
              className="bg-red-500 hover:bg-red-600 text-white font-semibold py-2 px-4 rounded disabled:opacity-50"
            >
              {loading.stop ? 'Stopping...' : 'Stop Container'}
            </button>
            <button
              onClick={handleInitializeMCP}
              disabled={loading.init || !containerStatus?.running}
              className="bg-purple-500 hover:bg-purple-600 text-white font-semibold py-2 px-4 rounded disabled:opacity-50"
            >
              {loading.init ? 'Initializing...' : 'Initialize MCP'}
            </button>
          </div>
          <div className="grid grid-cols-1 gap-4">
            <button
              onClick={handleCheckMCPTools}
              disabled={loading.tools || !containerStatus?.running}
              className="bg-cyan-500 hover:bg-cyan-600 text-white font-semibold py-2 px-4 rounded disabled:opacity-50"
            >
              {loading.tools ? 'Checking...' : 'Check MCP Tools (Direct HTTP)'}
            </button>
          </div>
        </div>

        {/* Email Test Panel */}
        <div className="bg-white rounded-lg shadow-md p-6 mb-6">
          <h2 className="text-xl font-semibold mb-4">Send Test Email</h2>
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Recipient Email
              </label>
              <input
                type="email"
                value={emailTo}
                onChange={(e) => setEmailTo(e.target.value)}
                placeholder="recipient@example.com"
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Subject
              </label>
              <input
                type="text"
                value={emailSubject}
                onChange={(e) => setEmailSubject(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Body
              </label>
              <textarea
                value={emailBody}
                onChange={(e) => setEmailBody(e.target.value)}
                rows={4}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <button
              onClick={handleSendTestEmail}
              disabled={loading.email || !mcpConnected}
              className="bg-indigo-500 hover:bg-indigo-600 text-white font-semibold py-2 px-6 rounded disabled:opacity-50"
            >
              {loading.email ? 'Sending...' : 'Send Test Email'}
            </button>
          </div>
        </div>

        {/* Test Results */}
        <div className="bg-white rounded-lg shadow-md p-6">
          <div className="flex justify-between items-center mb-4">
            <h2 className="text-xl font-semibold">Test Results</h2>
            <button
              onClick={clearResults}
              className="bg-gray-500 hover:bg-gray-600 text-white font-semibold py-1 px-4 rounded text-sm"
            >
              Clear
            </button>
          </div>
          <div className="space-y-2 max-h-96 overflow-y-auto">
            {testResults.length === 0 ? (
              <p className="text-gray-500 text-center py-4">No test results yet</p>
            ) : (
              testResults.map((result, index) => (
                <div
                  key={index}
                  className={`p-3 rounded border ${
                    result.success
                      ? 'bg-green-50 border-green-200'
                      : 'bg-red-50 border-red-200'
                  }`}
                >
                  <div className="flex justify-between items-start">
                    <div className="flex-1">
                      <p className="font-semibold">
                        {result.action}
                        <span
                          className={`ml-2 text-sm ${
                            result.success ? 'text-green-600' : 'text-red-600'
                          }`}
                        >
                          {result.success ? '✓' : '✗'}
                        </span>
                      </p>
                      <p className="text-sm text-gray-700">{result.message}</p>
                      {result.data && (
                        <details className="mt-2">
                          <summary className="text-xs text-gray-600 cursor-pointer">
                            Show details
                          </summary>
                          <pre className="mt-1 text-xs bg-gray-100 p-2 rounded overflow-x-auto">
                            {JSON.stringify(result.data, null, 2)}
                          </pre>
                        </details>
                      )}
                    </div>
                    <p className="text-xs text-gray-500 ml-4">
                      {new Date(result.timestamp).toLocaleTimeString()}
                    </p>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

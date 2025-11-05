'use client';

import React, { useState } from 'react';
import { useAuth } from '@/app/contexts/AuthContext';

export default function TestGooglePage() {
  const { user, googleConnected, connectGoogle, disconnectGoogle, checkGoogleStatus } = useAuth();
  const [containerStatus, setContainerStatus] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const checkContainer = async () => {
    setLoading(true);
    setError(null);

    try {
      const response = await fetch('/api/containers/status', {
        credentials: 'include',
      });

      if (!response.ok) {
        throw new Error('Failed to get container status');
      }

      const data = await response.json();
      setContainerStatus(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setLoading(false);
    }
  };

  const testGmail = async () => {
    setLoading(true);
    setError(null);

    try {
      // Call MCP Server to send test email
      const response = await fetch(`http://localhost:${containerStatus?.port}/tools/gmail_send_message`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          to: user?.email,
          subject: 'Test from MCP Hub',
          body: 'This is a test email!',
        }),
      });

      if (!response.ok) {
        throw new Error('Failed to send email');
      }

      alert('Email sent successfully!');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to send email');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{ padding: '2rem', maxWidth: '800px', margin: '0 auto' }}>
      <h1>Google Services Test Page</h1>

      <div style={{ marginTop: '2rem', padding: '1rem', border: '1px solid #ccc', borderRadius: '8px' }}>
        <h2>User Info</h2>
        {user && (
          <div>
            <p><strong>Username:</strong> {user.username}</p>
            <p><strong>Email:</strong> {user.email}</p>
          </div>
        )}
      </div>

      <div style={{ marginTop: '2rem', padding: '1rem', border: '1px solid #ccc', borderRadius: '8px' }}>
        <h2>Google Connection</h2>
        <p>
          <strong>Status:</strong>{' '}
          {googleConnected ? (
            <span style={{ color: 'green' }}>✅ Connected</span>
          ) : (
            <span style={{ color: 'red' }}>❌ Not Connected</span>
          )}
        </p>

        {!googleConnected ? (
          <button onClick={connectGoogle} disabled={loading}>
            Connect Google Account
          </button>
        ) : (
          <button onClick={disconnectGoogle} disabled={loading}>
            Disconnect Google
          </button>
        )}

        <button onClick={checkGoogleStatus} disabled={loading} style={{ marginLeft: '1rem' }}>
          Refresh Status
        </button>
      </div>

      <div style={{ marginTop: '2rem', padding: '1rem', border: '1px solid #ccc', borderRadius: '8px' }}>
        <h2>Container Status</h2>

        <button onClick={checkContainer} disabled={loading}>
          Check Container
        </button>

        {containerStatus && (
          <div style={{ marginTop: '1rem' }}>
            <p><strong>Status:</strong> {containerStatus.status}</p>
            <p><strong>Running:</strong> {containerStatus.running ? 'Yes' : 'No'}</p>
            <p><strong>Port:</strong> {containerStatus.port}</p>
            <p><strong>Health:</strong> {containerStatus.health}</p>
            <p><strong>Container ID:</strong> {containerStatus.container_id}</p>
          </div>
        )}
      </div>

      <div style={{ marginTop: '2rem', padding: '1rem', border: '1px solid #ccc', borderRadius: '8px' }}>
        <h2>Gmail Test</h2>

        <button onClick={testGmail} disabled={loading || !containerStatus}>
          Send Test Email
        </button>

        <p style={{ marginTop: '1rem', fontSize: '0.875rem', color: '#666' }}>
          Note: Check container status first to get the port
        </p>
      </div>

      {error && (
        <div style={{ marginTop: '2rem', padding: '1rem', backgroundColor: '#fee', borderRadius: '8px' }}>
          <strong>Error:</strong> {error}
        </div>
      )}
    </div>
  );
}

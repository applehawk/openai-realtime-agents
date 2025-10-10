'use client';

import React, { useState, useEffect } from 'react';
import { useAuth } from '@/app/contexts/AuthContext';
import styles from './UserProfile.module.css';

interface GoogleStatus {
  gmail_connected: boolean;
  calendar_connected: boolean;
}

export default function UserProfile() {
  const { user, logout, refreshUser } = useAuth();
  const [showDropdown, setShowDropdown] = useState(false);
  const [googleStatus, setGoogleStatus] = useState<GoogleStatus | null>(null);
  const [isConnecting, setIsConnecting] = useState(false);

  useEffect(() => {
    if (user?.google_connected) {
      loadGoogleStatus();
    }
  }, [user]);

  const loadGoogleStatus = async () => {
    try {
      const response = await fetch('/api/google/status', {
        credentials: 'include',
      });

      if (response.ok) {
        const data = await response.json();
        setGoogleStatus(data);
      }
    } catch (error) {
      console.error('Failed to load Google status:', error);
    }
  };

  const handleConnectGoogle = async () => {
    setIsConnecting(true);
    try {
      const response = await fetch('/api/google/auth-url', {
        credentials: 'include',
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
        alert('Google account disconnected');
        await refreshUser();
        setGoogleStatus(null);
      } else {
        alert('Failed to disconnect Google');
      }
    } catch (error) {
      console.error('Failed to disconnect Google:', error);
      alert('Failed to disconnect Google');
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

'use client';

import React, { useState, useEffect } from 'react';
import { useAuth } from '@/app/contexts/AuthContext';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import '../auth.css';

export default function LoginPage() {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [message, setMessage] = useState<{ text: string; type: 'success' | 'error' } | null>(null);

  const { login, user, error, clearError } = useAuth();
  const router = useRouter();

  useEffect(() => {
    // If already logged in, redirect to home
    if (user) {
      router.push('/');
    }
  }, [user, router]);

  useEffect(() => {
    if (error) {
      setMessage({ text: error, type: 'error' });
      clearError();
    }
  }, [error, clearError]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setMessage(null);
    setIsLoading(true);

    try {
      await login(username, password);
      // Redirect happens in AuthContext
    } catch (_err) {
      // Error is handled by AuthContext
    } finally {
      setIsLoading(false);
    }
  };

  if (user) {
    return null; // Will redirect
  }

  return (
    <div className="auth-container">
      <div className="auth-card">
        <div className="auth-header">
          <h1>🤖 Multiagent Auth</h1>
          <p className="auth-subtitle">Сервис авторизации для AI-ассистента</p>
        </div>

        {/* Tabs */}
        <div className="auth-tabs">
          <Link href="/auth/login" className="auth-tab active">
            Вход
          </Link>
          <Link href="/auth/register" className="auth-tab">
            Регистрация
          </Link>
        </div>

        {/* Login Form */}
        <form onSubmit={handleSubmit} className="auth-form">
          <div className="form-group">
            <label htmlFor="username">Имя пользователя</label>
            <input
              type="text"
              id="username"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              required
              disabled={isLoading}
            />
          </div>

          <div className="form-group">
            <label htmlFor="password">Пароль</label>
            <input
              type="password"
              id="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              disabled={isLoading}
            />
          </div>

          <button
            type="submit"
            className={`auth-btn auth-btn-primary ${isLoading ? 'loading' : ''}`}
            disabled={isLoading}
          >
            {!isLoading && 'Войти'}
          </button>
        </form>

        {/* Message */}
        {message && (
          <div className={`auth-message ${message.type}`}>
            {message.text}
          </div>
        )}
      </div>
    </div>
  );
}

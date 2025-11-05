'use client';

import React, { useState, useEffect } from 'react';
import { useAuth } from '@/app/contexts/AuthContext';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import '../auth.css';

export default function RegisterPage() {
  const [username, setUsername] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [message, setMessage] = useState<{ text: string; type: 'success' | 'error' } | null>(null);

  const { register, user, error, clearError } = useAuth();
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
      await register(username, email, password);

      // Show success message
      setMessage({ text: 'Регистрация успешна! Войдите в систему', type: 'success' });

      // Redirect to login page after 1.5 seconds
      setTimeout(() => {
        router.push('/auth/login');
      }, 1500);
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
          <Link href="/auth/login" className="auth-tab">
            Вход
          </Link>
          <Link href="/auth/register" className="auth-tab active">
            Регистрация
          </Link>
        </div>

        {/* Register Form */}
        <form onSubmit={handleSubmit} className="auth-form">
          <div className="form-group">
            <label htmlFor="username">Имя пользователя</label>
            <input
              type="text"
              id="username"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              required
              minLength={3}
              disabled={isLoading}
            />
          </div>

          <div className="form-group">
            <label htmlFor="email">Email</label>
            <input
              type="email"
              id="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
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
              minLength={6}
              disabled={isLoading}
            />
          </div>

          <button
            type="submit"
            className={`auth-btn auth-btn-primary ${isLoading ? 'loading' : ''}`}
            disabled={isLoading}
          >
            {!isLoading && 'Зарегистрироваться'}
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

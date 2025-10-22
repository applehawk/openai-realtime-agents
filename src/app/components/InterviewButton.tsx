"use client";
import React, { useState, useEffect } from 'react';
import styles from './InterviewButton.module.css';

interface InterviewButtonProps {
  onStartInterview: () => void;
}

interface InterviewStatus {
  hasInterview: boolean;
  status: 'loading' | 'completed' | 'not_started' | 'error';
}

export default function InterviewButton({ onStartInterview }: InterviewButtonProps) {
  const [isLoading, setIsLoading] = useState(false);
  const [interviewStatus, setInterviewStatus] = useState<InterviewStatus>({
    hasInterview: false,
    status: 'loading'
  });

  // Проверяем статус интервью при загрузке компонента
  useEffect(() => {
    checkInterviewStatus();
  }, []);

  const checkInterviewStatus = async () => {
    try {
      const response = await fetch('/api/interview', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'check_status' }),
        credentials: 'include',
      });

      if (response.ok) {
        const result = await response.json();
        setInterviewStatus({
          hasInterview: result.hasInterview || false,
          status: result.hasInterview ? 'completed' : 'not_started'
        });
      } else {
        setInterviewStatus({ hasInterview: false, status: 'error' });
      }
    } catch (error) {
      console.error('Failed to check interview status:', error);
      setInterviewStatus({ hasInterview: false, status: 'error' });
    }
  };

  const handleStartInterview = async () => {
    setIsLoading(true);
    try {
      // Отправляем сообщение агенту для запуска интервью
      onStartInterview();
      // Обновляем статус после запуска
      setTimeout(() => {
        setInterviewStatus({ hasInterview: false, status: 'not_started' });
      }, 1000);
    } catch (error) {
      console.error('Failed to start interview:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const getButtonText = () => {
    if (isLoading) return 'Загрузка...';
    if (interviewStatus.status === 'completed') return 'Интервью ✓';
    if (interviewStatus.status === 'error') return 'Интервью ?';
    return 'Интервью';
  };

  const getButtonClass = () => {
    if (interviewStatus.status === 'completed') return styles.interviewButtonCompleted;
    if (interviewStatus.status === 'error') return styles.interviewButtonError;
    return styles.interviewButton;
  };

  return (
    <button
      className={getButtonClass()}
      onClick={handleStartInterview}
      disabled={isLoading}
      title={
        interviewStatus.status === 'completed' 
          ? 'Интервью уже проведено. Нажмите для повторного интервью'
          : 'Начать первичное интервью для настройки предпочтений'
      }
    >
      <span className={styles.interviewIcon}>
        {interviewStatus.status === 'completed' ? '✅' : '🎤'}
      </span>
      <span className={styles.interviewText}>
        {getButtonText()}
      </span>
    </button>
  );
}

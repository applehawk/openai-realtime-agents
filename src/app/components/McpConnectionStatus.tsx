'use client';

import { useState, useEffect } from 'react';

interface McpStatus {
  isConnected: boolean;
  isChecking: boolean;
  lastChecked: Date | null;
  error: string | null;
  responseTime: number | null;
}

export default function McpConnectionStatus() {
  const [status, setStatus] = useState<McpStatus>({
    isConnected: false,
    isChecking: true,
    lastChecked: null,
    error: null,
    responseTime: null,
  });

  const checkMcpConnection = async () => {
    setStatus(prev => ({ ...prev, isChecking: true, error: null }));
    
    const startTime = Date.now();
    
    try {
      // Проверяем через Next.js API прокси
      const response = await fetch('/api/preferences-mcp', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          tool_name: 'get_user_preferences',
          parameters: {},
          user_id: 'health-check'
        })
      });

      const responseTime = Date.now() - startTime;
      
      if (response.ok) {
        setStatus({
          isConnected: true,
          isChecking: false,
          lastChecked: new Date(),
          error: null,
          responseTime,
        });
      } else {
        const errorData = await response.json();
        setStatus({
          isConnected: false,
          isChecking: false,
          lastChecked: new Date(),
          error: errorData.message || `HTTP ${response.status}`,
          responseTime,
        });
      }
    } catch (error: any) {
      const responseTime = Date.now() - startTime;
      setStatus({
        isConnected: false,
        isChecking: false,
        lastChecked: new Date(),
        error: error.message || 'Connection failed',
        responseTime,
      });
    }
  };

  useEffect(() => {
    // Проверяем при загрузке
    checkMcpConnection();
    
    // Проверяем каждые 30 секунд
    const interval = setInterval(checkMcpConnection, 30000);
    
    return () => clearInterval(interval);
  }, []);

  const getStatusColor = () => {
    if (status.isChecking) return 'text-yellow-500';
    if (status.isConnected) return 'text-green-500';
    return 'text-red-500';
  };

  const getStatusText = () => {
    if (status.isChecking) return 'Проверка...';
    if (status.isConnected) return 'Подключен';
    return 'Отключен';
  };

  const getStatusIcon = () => {
    if (status.isChecking) return '⏳';
    if (status.isConnected) return '✅';
    return '❌';
  };

  return (
    <div className="fixed bottom-4 right-4 bg-white dark:bg-gray-800 rounded-lg shadow-lg p-4 border border-gray-200 dark:border-gray-700 min-w-[280px]">
      <div className="flex items-center justify-between mb-2">
        <h3 className="text-sm font-medium text-gray-900 dark:text-gray-100">
          MCP Preferences Status
        </h3>
        <button
          onClick={checkMcpConnection}
          disabled={status.isChecking}
          className="text-xs px-2 py-1 bg-blue-500 text-white rounded hover:bg-blue-600 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {status.isChecking ? 'Проверка...' : 'Обновить'}
        </button>
      </div>
      
      <div className="space-y-1">
        <div className="flex items-center space-x-2">
          <span className="text-lg">{getStatusIcon()}</span>
          <span className={`text-sm font-medium ${getStatusColor()}`}>
            {getStatusText()}
          </span>
        </div>
        
        {status.lastChecked && (
          <div className="text-xs text-gray-500 dark:text-gray-400">
            Последняя проверка: {status.lastChecked.toLocaleTimeString()}
          </div>
        )}
        
        {status.responseTime && (
          <div className="text-xs text-gray-500 dark:text-gray-400">
            Время ответа: {status.responseTime}ms
          </div>
        )}
        
        {status.error && (
          <div className="text-xs text-red-500 dark:text-red-400 mt-1">
            Ошибка: {status.error}
          </div>
        )}
      </div>
      
      <div className="mt-3 text-xs text-gray-500 dark:text-gray-400">
        <div>Сервер: preferences-mcp</div>
        <div>Порт: 7001</div>
        <div>Протокол: MCP</div>
      </div>
    </div>
  );
}

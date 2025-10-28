'use client';

import { useState, useEffect } from 'react';

interface RagServerStatus {
  status: 'healthy' | 'degraded' | 'error';
  timestamp: string;
  servers: {
    api: {
      url: string;
      accessible: boolean;
      error?: string;
      responseTime?: number;
    };
    mcp: {
      url: string;
      accessible: boolean;
      error?: string;
      responseTime?: number;
    };
  };
  summary: {
    api: string;
    mcp: string;
    overall: string;
  };
}

/**
 * RAG Server Status Component
 * 
 * Отображает статус RAG сервера в UI
 * Можно скрыть через переменную окружения RAG_HEALTH_CHECK_ENABLED=false
 */
export function RagServerStatusComponent() {
  const [status, setStatus] = useState<RagServerStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const checkStatus = async () => {
      try {
        setLoading(true);
        const response = await fetch('/api/rag-health');
        const data = await response.json();
        setStatus(data);
        setError(null);
      } catch (err: any) {
        setError(err.message);
        setStatus(null);
      } finally {
        setLoading(false);
      }
    };

    checkStatus();
    
    // Проверяем статус каждые 30 секунд
    const interval = setInterval(checkStatus, 30000);
    
    return () => clearInterval(interval);
  }, []);

  // Не показываем компонент если проверка отключена
  if (process.env.NODE_ENV === 'production' && process.env.NEXT_PUBLIC_RAG_HEALTH_CHECK_ENABLED === 'false') {
    return null;
  }

  if (loading) {
    return (
      <div className="fixed bottom-4 right-4 bg-blue-100 border border-blue-300 rounded-lg p-3 shadow-lg">
        <div className="flex items-center space-x-2">
          <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-blue-600"></div>
          <span className="text-sm text-blue-800">Checking RAG servers...</span>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="fixed bottom-4 right-4 bg-red-100 border border-red-300 rounded-lg p-3 shadow-lg">
        <div className="flex items-center space-x-2">
          <div className="text-red-600">❌</div>
          <span className="text-sm text-red-800">RAG check failed: {error}</span>
        </div>
      </div>
    );
  }

  if (!status) {
    return null;
  }

  const isHealthy = status.status === 'healthy';
  const bgColor = isHealthy ? 'bg-green-100 border-green-300' : 'bg-yellow-100 border-yellow-300';
  const textColor = isHealthy ? 'text-green-800' : 'text-yellow-800';
  const icon = isHealthy ? '✅' : '⚠️';

  return (
    <div className={`fixed bottom-4 right-4 ${bgColor} border rounded-lg p-3 shadow-lg max-w-sm`}>
      <div className="flex items-center space-x-2 mb-2">
        <div className="text-lg">{icon}</div>
        <span className={`text-sm font-medium ${textColor}`}>
          RAG Servers: {status.summary.overall}
        </span>
      </div>
      
      <div className="text-xs space-y-1">
        <div className={`${textColor}`}>
          API: {status.servers.api.accessible ? '✅' : '❌'} 
          {status.servers.api.responseTime && ` (${status.servers.api.responseTime}ms)`}
        </div>
        <div className={`${textColor}`}>
          MCP: {status.servers.mcp.accessible ? '✅' : '❌'} 
          {status.servers.mcp.responseTime && ` (${status.servers.mcp.responseTime}ms)`}
        </div>
        <div className={`${textColor} opacity-75`}>
          Updated: {new Date(status.timestamp).toLocaleTimeString()}
        </div>
      </div>
    </div>
  );
}

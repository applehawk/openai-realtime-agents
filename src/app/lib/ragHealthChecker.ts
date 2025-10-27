/**
 * RAG Server Health Check Module
 * 
 * Проверяет доступность RAG сервера при старте приложения
 * Поддерживает отключение через переменные окружения
 */

interface RagHealthCheckConfig {
  enabled: boolean;
  timeout: number;
  retries: number;
  retryDelay: number;
}

interface RagServerStatus {
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
}

class RagHealthChecker {
  private config: RagHealthCheckConfig;
  private ragApiUrl: string;
  private ragMcpUrl: string;

  constructor() {
    this.config = {
      enabled: process.env.RAG_HEALTH_CHECK_ENABLED !== 'false',
      timeout: parseInt(process.env.RAG_HEALTH_CHECK_TIMEOUT || '10000'),
      retries: parseInt(process.env.RAG_HEALTH_CHECK_RETRIES || '3'),
      retryDelay: parseInt(process.env.RAG_HEALTH_CHECK_RETRY_DELAY || '1000'),
    };

    this.ragApiUrl = process.env.RAG_API_BASE_URL || 'http://79.132.139.57:9621';
    this.ragMcpUrl = process.env.RAG_SERVER_URL || 'http://79.132.139.57:8000/mcp';
  }

  /**
   * Проверяет доступность RAG API сервера
   */
  private async checkRagApi(): Promise<{ accessible: boolean; error?: string; responseTime?: number }> {
    const startTime = Date.now();
    
    try {
      const response = await fetch(`${this.ragApiUrl}/workspaces`, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
        },
        signal: AbortSignal.timeout(this.config.timeout),
      });

      const responseTime = Date.now() - startTime;

      if (response.ok) {
        const data = await response.json();
        console.log(`✅ RAG API (${this.ragApiUrl}) is accessible (${responseTime}ms)`);
        return { accessible: true, responseTime };
      } else {
        const error = `HTTP ${response.status}`;
        console.log(`❌ RAG API (${this.ragApiUrl}) returned ${response.status}`);
        return { accessible: false, error, responseTime };
      }
    } catch (error: any) {
      const responseTime = Date.now() - startTime;
      console.log(`❌ RAG API (${this.ragApiUrl}) connection failed: ${error.message}`);
      return { accessible: false, error: error.message, responseTime };
    }
  }

  /**
   * Проверяет доступность RAG MCP сервера
   */
  private async checkRagMcp(): Promise<{ accessible: boolean; error?: string; responseTime?: number }> {
    const startTime = Date.now();
    
    try {
      // MCP сервер ожидает JSON-RPC запрос
      const mcpRequest = {
        jsonrpc: '2.0',
        id: 1,
        method: 'tools/list',
        params: {}
      };

      const response = await fetch(this.ragMcpUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(mcpRequest),
        signal: AbortSignal.timeout(this.config.timeout),
      });

      const responseTime = Date.now() - startTime;

      if (response.ok) {
        const data = await response.json();
        console.log(`✅ RAG MCP (${this.ragMcpUrl}) is accessible (${responseTime}ms)`);
        return { accessible: true, responseTime };
      } else {
        const error = `HTTP ${response.status}`;
        console.log(`❌ RAG MCP (${this.ragMcpUrl}) returned ${response.status}`);
        return { accessible: false, error, responseTime };
      }
    } catch (error: any) {
      const responseTime = Date.now() - startTime;
      console.log(`❌ RAG MCP (${this.ragMcpUrl}) connection failed: ${error.message}`);
      return { accessible: false, error: error.message, responseTime };
    }
  }

  /**
   * Выполняет проверку с повторными попытками
   */
  private async checkWithRetry<T>(
    checkFunction: () => Promise<T>,
    name: string
  ): Promise<T> {
    let lastError: any;

    for (let attempt = 1; attempt <= this.config.retries; attempt++) {
      try {
        console.log(`🔍 Checking ${name} (attempt ${attempt}/${this.config.retries})`);
        const result = await checkFunction();
        return result;
      } catch (error) {
        lastError = error;
        console.log(`⚠️  ${name} check failed (attempt ${attempt}/${this.config.retries}): ${error}`);
        
        if (attempt < this.config.retries) {
          console.log(`⏳ Retrying in ${this.config.retryDelay}ms...`);
          await new Promise(resolve => setTimeout(resolve, this.config.retryDelay));
        }
      }
    }

    throw lastError;
  }

  /**
   * Выполняет полную проверку здоровья RAG сервера
   */
  async checkHealth(): Promise<RagServerStatus> {
    if (!this.config.enabled) {
      console.log('🚫 RAG health check is disabled via RAG_HEALTH_CHECK_ENABLED=false');
      return {
        api: { url: this.ragApiUrl, accessible: true },
        mcp: { url: this.ragMcpUrl, accessible: true },
      };
    }

    console.log('🏥 Starting RAG server health check...');
    console.log(`📋 Configuration:`, {
      enabled: this.config.enabled,
      timeout: `${this.config.timeout}ms`,
      retries: this.config.retries,
      retryDelay: `${this.config.retryDelay}ms`,
    });

    const startTime = Date.now();

    try {
      // Проверяем оба сервера параллельно
      const [apiResult, mcpResult] = await Promise.all([
        this.checkWithRetry(() => this.checkRagApi(), 'RAG API'),
        this.checkWithRetry(() => this.checkRagMcp(), 'RAG MCP'),
      ]);

      const totalTime = Date.now() - startTime;

      const status: RagServerStatus = {
        api: {
          url: this.ragApiUrl,
          accessible: apiResult.accessible,
          error: apiResult.error,
          responseTime: apiResult.responseTime,
        },
        mcp: {
          url: this.ragMcpUrl,
          accessible: mcpResult.accessible,
          error: mcpResult.error,
          responseTime: mcpResult.responseTime,
        },
      };

      // Выводим итоговый результат
      const allAccessible = status.api.accessible && status.mcp.accessible;
      const icon = allAccessible ? '✅' : '⚠️';
      const message = allAccessible ? 'All RAG servers are accessible' : 'Some RAG servers are not accessible';

      console.log(`${icon} RAG Health Check Complete (${totalTime}ms): ${message}`);
      
      if (!allAccessible) {
        console.log('📊 Detailed Status:');
        console.log(`   API (${status.api.url}): ${status.api.accessible ? '✅' : '❌'} ${status.api.error || ''}`);
        console.log(`   MCP (${status.mcp.url}): ${status.mcp.accessible ? '✅' : '❌'} ${status.mcp.error || ''}`);
      }

      return status;
    } catch (error: any) {
      console.error('💥 RAG health check failed:', error.message);
      throw error;
    }
  }

  /**
   * Проверяет конфигурацию переменных окружения
   */
  logConfiguration(): void {
    console.log('🔧 RAG Health Check Configuration:');
    console.log(`   Enabled: ${this.config.enabled}`);
    console.log(`   Timeout: ${this.config.timeout}ms`);
    console.log(`   Retries: ${this.config.retries}`);
    console.log(`   Retry Delay: ${this.config.retryDelay}ms`);
    console.log(`   API URL: ${this.ragApiUrl}`);
    console.log(`   MCP URL: ${this.ragMcpUrl}`);
    console.log('');
  }
}

// Экспортируем singleton instance
export const ragHealthChecker = new RagHealthChecker();

// Экспортируем типы для использования в других модулях
export type { RagServerStatus, RagHealthCheckConfig };

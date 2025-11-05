/**
 * RAG Health Check Middleware
 * 
 * Выполняет проверку доступности RAG сервера при старте приложения
 * Можно отключить через переменную окружения RAG_HEALTH_CHECK_ENABLED=false
 */

import { ragHealthChecker } from '@/app/lib/ragHealthChecker';

let healthCheckCompleted = false;
let healthCheckPromise: Promise<any> | null = null;

/**
 * Выполняет проверку здоровья RAG сервера при старте
 */
export async function performStartupHealthCheck(): Promise<void> {
  // Если проверка уже выполнена, не повторяем
  if (healthCheckCompleted) {
    return;
  }

  // Если проверка уже выполняется, ждем ее завершения
  if (healthCheckPromise) {
    await healthCheckPromise;
    return;
  }

  // Запускаем проверку
  healthCheckPromise = (async () => {
    try {
      console.log('🚀 Performing RAG server health check on startup...');
      ragHealthChecker.logConfiguration();
      
      const status = await ragHealthChecker.checkHealth();
      
      const allAccessible = status.api.accessible && status.mcp.accessible;
      
      if (allAccessible) {
        console.log('✅ RAG servers are ready for use');
      } else {
        console.log('⚠️  RAG servers have issues, but application will continue');
        console.log('💡 You can disable this check by setting RAG_HEALTH_CHECK_ENABLED=false');
      }
      
      healthCheckCompleted = true;
    } catch (error: any) {
      console.error('💥 Startup RAG health check failed:', error.message);
      console.log('⚠️  Application will continue, but RAG features may not work properly');
      healthCheckCompleted = true;
    }
  })();

  await healthCheckPromise;
}

/**
 * Возвращает статус проверки здоровья
 */
export function getHealthCheckStatus(): { completed: boolean; inProgress: boolean } {
  return {
    completed: healthCheckCompleted,
    inProgress: healthCheckPromise !== null && !healthCheckCompleted,
  };
}

/**
 * Принудительно выполняет проверку здоровья (для тестирования)
 */
export async function forceHealthCheck(): Promise<any> {
  console.log('🔄 Forcing RAG health check...');
  return await ragHealthChecker.checkHealth();
}

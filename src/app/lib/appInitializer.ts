/**
 * Application Startup Module
 * 
 * Выполняет инициализацию приложения при старте
 * Включает проверку здоровья RAG сервера
 */

import { performStartupHealthCheck } from '@/app/lib/startupHealthCheck';

let startupInitialized = false;

/**
 * Инициализирует приложение при старте
 */
export async function initializeApplication(): Promise<void> {
  if (startupInitialized) {
    return;
  }

  console.log('🚀 Initializing application...');
  
  try {
    // Выполняем проверку здоровья RAG сервера
    await performStartupHealthCheck();
    
    console.log('✅ Application initialization completed');
    startupInitialized = true;
  } catch (error: any) {
    console.error('💥 Application initialization failed:', error.message);
    // Не блокируем запуск приложения из-за ошибок инициализации
    startupInitialized = true;
  }
}

/**
 * Возвращает статус инициализации
 */
export function isInitialized(): boolean {
  return startupInitialized;
}

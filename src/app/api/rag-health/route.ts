import { NextRequest, NextResponse } from 'next/server';
import { ragHealthChecker } from '@/app/lib/ragHealthChecker';

/**
 * RAG Health Check API Endpoint
 * 
 * GET /api/rag-health - проверяет доступность RAG сервера
 * 
 * Переменные окружения для управления:
 * - RAG_HEALTH_CHECK_ENABLED=false - отключить проверку
 * - RAG_HEALTH_CHECK_TIMEOUT=10000 - таймаут в мс
 * - RAG_HEALTH_CHECK_RETRIES=3 - количество попыток
 * - RAG_HEALTH_CHECK_RETRY_DELAY=1000 - задержка между попытками
 */
export async function GET(request: NextRequest) {
  try {
    console.log('🏥 RAG Health Check API called');
    
    const status = await ragHealthChecker.checkHealth();
    
    const allAccessible = status.api.accessible && status.mcp.accessible;
    const httpStatus = allAccessible ? 200 : 503; // Service Unavailable если что-то недоступно
    
    return NextResponse.json({
      status: allAccessible ? 'healthy' : 'degraded',
      timestamp: new Date().toISOString(),
      servers: status,
      summary: {
        api: status.api.accessible ? 'accessible' : 'unavailable',
        mcp: status.mcp.accessible ? 'accessible' : 'unavailable',
        overall: allAccessible ? 'healthy' : 'degraded',
      },
    }, { status: httpStatus });
    
  } catch (error: any) {
    console.error('💥 RAG Health Check API error:', error);
    
    return NextResponse.json({
      status: 'error',
      timestamp: new Date().toISOString(),
      error: error.message,
      servers: {
        api: { url: 'unknown', accessible: false, error: error.message },
        mcp: { url: 'unknown', accessible: false, error: error.message },
      },
      summary: {
        api: 'error',
        mcp: 'error',
        overall: 'error',
      },
    }, { status: 500 });
  }
}

/**
 * POST /api/rag-health - принудительная проверка с конфигурацией
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json().catch(() => ({}));
    
    console.log('🏥 RAG Health Check API (POST) called with config:', body);
    
    // Временно переопределяем конфигурацию если передана
    if (body.timeout) {
      process.env.RAG_HEALTH_CHECK_TIMEOUT = body.timeout.toString();
    }
    if (body.retries) {
      process.env.RAG_HEALTH_CHECK_RETRIES = body.retries.toString();
    }
    if (body.retryDelay) {
      process.env.RAG_HEALTH_CHECK_RETRY_DELAY = body.retryDelay.toString();
    }
    
    const status = await ragHealthChecker.checkHealth();
    
    const allAccessible = status.api.accessible && status.mcp.accessible;
    const httpStatus = allAccessible ? 200 : 503;
    
    return NextResponse.json({
      status: allAccessible ? 'healthy' : 'degraded',
      timestamp: new Date().toISOString(),
      servers: status,
      summary: {
        api: status.api.accessible ? 'accessible' : 'unavailable',
        mcp: status.mcp.accessible ? 'accessible' : 'unavailable',
        overall: allAccessible ? 'healthy' : 'degraded',
      },
      configuration: {
        timeout: parseInt(process.env.RAG_HEALTH_CHECK_TIMEOUT || '10000'),
        retries: parseInt(process.env.RAG_HEALTH_CHECK_RETRIES || '3'),
        retryDelay: parseInt(process.env.RAG_HEALTH_CHECK_RETRY_DELAY || '1000'),
      },
    }, { status: httpStatus });
    
  } catch (error: any) {
    console.error('💥 RAG Health Check API (POST) error:', error);
    
    return NextResponse.json({
      status: 'error',
      timestamp: new Date().toISOString(),
      error: error.message,
    }, { status: 500 });
  }
}

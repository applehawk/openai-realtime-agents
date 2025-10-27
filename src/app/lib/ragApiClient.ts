// RAG API configuration
const RAG_API_BASE_URL = process.env.RAG_API_BASE_URL || 'http://79.132.139.57:9621';
const RAG_API_TIMEOUT = parseInt(process.env.RAG_API_TIMEOUT || '30000');

/**
 * Helper function to call RAG API directly (server-side)
 * This function will be used by both server-side API endpoints and realtime agent tools
 */
export async function callRagApiDirect(endpoint: string, method: string, data?: any) {
  try {
    const url = `${RAG_API_BASE_URL}${endpoint}`;
    console.log(`[RAG API] Calling ${method} ${url}`, data ? { dataKeys: Object.keys(data) } : {});

    const response = await fetch(url, {
      method,
      headers: {
        'Content-Type': 'application/json',
      },
      body: data ? JSON.stringify(data) : undefined,
      signal: AbortSignal.timeout(RAG_API_TIMEOUT),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error(`[RAG API] Error ${response.status}:`, errorText);
      throw new Error(`RAG API error: ${response.status} - ${errorText}`);
    }

    const result = await response.json();
    console.log(`[RAG API] Success:`, { endpoint, hasData: !!result });
    return result;
  } catch (error: any) {
    console.error(`[RAG API] Network error:`, error);
    throw new Error(`RAG API connection failed: ${error.message}`);
  }
}

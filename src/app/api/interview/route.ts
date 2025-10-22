import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { authClient } from '@/app/lib/authClient';

// RAG API configuration
const RAG_SERVER_URL = process.env.RAG_SERVER_URL || 'http://79.132.139.57:8000/mcp'; // MCP endpoint
const RAG_API_BASE_URL = process.env.RAG_API_BASE_URL || 'http://79.132.139.57:9621'; // Direct API endpoint
const RAG_API_TIMEOUT = parseInt(process.env.RAG_API_TIMEOUT || '30000');
const RAG_API_RETRY_ATTEMPTS = parseInt(process.env.RAG_API_RETRY_ATTEMPTS || '3');

/**
 * Helper function to call RAG API directly
 */
async function callRagApiDirect(endpoint: string, method: string, data?: any) {
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

/**
 * Create user workspace for interview data
 */
async function createUserWorkspace(userId: string): Promise<void> {
  const workspaceName = `${userId}_user_key_preferences`;
  
  try {
    // Check if workspace exists first
    const workspaces = await callRagApiDirect('/workspaces', 'GET');
    const existingWorkspace = workspaces.find((ws: any) => ws.name === workspaceName);
    
    if (existingWorkspace) {
      console.log(`[Interview] Workspace ${workspaceName} already exists`);
      return;
    }

    // Create new workspace
    await callRagApiDirect('/workspaces', 'POST', { name: workspaceName });
    console.log(`[Interview] Created workspace: ${workspaceName}`);
  } catch (error: any) {
    console.error(`[Interview] Failed to create workspace:`, error);
    throw new Error(`Не удалось создать рабочее пространство: ${error.message}`);
  }
}

/**
 * Save interview data to RAG
 */
async function saveInterviewDataToRag(userId: string, interviewData: string): Promise<void> {
  const workspaceName = `${userId}_user_key_preferences`;
  
  try {
    await callRagApiDirect('/documents/text', 'POST', {
      text: interviewData,
      file_source: 'initial_interview',
      workspace: workspaceName,
    });
    console.log(`[Interview] Saved interview data for user ${userId}`);
  } catch (error: any) {
    console.error(`[Interview] Failed to save interview data:`, error);
    throw new Error(`Не удалось сохранить данные интервью: ${error.message}`);
  }
}

export async function POST(request: NextRequest) {
  try {
    // Get user authentication
    const cookieStore = await cookies();
    const accessToken = cookieStore.get('access_token')?.value;

    if (!accessToken) {
      return NextResponse.json(
        { detail: 'Not authenticated' },
        { status: 401 }
      );
    }

    // Get user info
    const user = await authClient.getCurrentUser(accessToken);
    const userId = user.id || user.username;

    const body = await request.json();
    const { action, data } = body;

    switch (action) {
      case 'check_status':
        return await checkInterviewStatus(userId);
      
      case 'save_data':
        return await saveInterviewDataHandler(userId, data);
      
      case 'create_workspace':
        return await createWorkspace(userId);
      
      default:
        return NextResponse.json(
          { detail: 'Invalid action' },
          { status: 400 }
        );
    }
  } catch (error) {
    console.error('Interview API error:', error);
    const message = error instanceof Error ? error.message : 'Internal server error';
    return NextResponse.json(
      { detail: message },
      { status: 500 }
    );
  }
}

async function checkInterviewStatus(userId: string) {
  try {
    const workspaceName = `${userId}_user_key_preferences`;
    
    // Check if workspace exists
    const workspaces = await callRagApiDirect('/workspaces', 'GET');
    const userWorkspace = workspaces.find((ws: any) => ws.name === workspaceName);
    
    if (!userWorkspace) {
      return NextResponse.json({
        hasInterview: false,
        message: 'Первичное интервью не проводилось',
      });
    }
    
    // Query for interview data
    const interviewData = await callRagApiDirect('/query', 'POST', {
      query: 'профиль пользователя предпочтения интервью',
      mode: 'mix',
      include_references: false,
      workspace: workspaceName,
    });
    
    return NextResponse.json({
      hasInterview: true,
      message: 'Интервью уже проводилось',
      interviewData: interviewData.response || 'Данные интервью найдены',
    });
  } catch (error: any) {
    console.error('Error checking interview status:', error);
    return NextResponse.json({
      hasInterview: false,
      message: `Ошибка при проверке статуса интервью: ${error.message}`,
    });
  }
}

async function saveInterviewDataHandler(userId: string, interviewData: string) {
  try {
    await createUserWorkspace(userId);
    await saveInterviewDataToRag(userId, interviewData);
    
    return NextResponse.json({
      success: true,
      message: 'Данные интервью успешно сохранены',
    });
  } catch (error: any) {
    console.error('Error saving interview data:', error);
    return NextResponse.json(
      { detail: `Ошибка при сохранении данных: ${error.message}` },
      { status: 500 }
    );
  }
}

async function createWorkspace(userId: string) {
  try {
    await createUserWorkspace(userId);
    
    return NextResponse.json({
      success: true,
      message: 'Рабочее пространство создано',
    });
  } catch (error: any) {
    console.error('Error creating workspace:', error);
    return NextResponse.json(
      { detail: `Ошибка при создании рабочего пространства: ${error.message}` },
      { status: 500 }
    );
  }
}
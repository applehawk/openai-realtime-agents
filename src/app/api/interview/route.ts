import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { authClient } from '@/app/lib/authClient';
import { callRagApiDirect } from '@/app/lib/ragApiClient';

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
    const workspacesResponse = await callRagApiDirect('/workspaces', 'GET');
    
    // Handle different response structures
    let workspaces = [];
    if (workspacesResponse.workspaces) {
      workspaces = workspacesResponse.workspaces;
    } else if (Array.isArray(workspacesResponse)) {
      workspaces = workspacesResponse;
    } else {
      console.log('[Interview] Unexpected workspaces response structure:', workspacesResponse);
      return NextResponse.json({
        hasInterview: false,
        message: 'Первичное интервью не проводилось',
      });
    }
    
    const userWorkspace = workspaces.find((ws: any) => ws.name === workspaceName);
    
    if (!userWorkspace) {
      return NextResponse.json({
        hasInterview: false,
        message: 'Первичное интервью не проводилось',
      });
    }
    
    // Query for interview data directly - don't rely on has_data flag
    const interviewData = await callRagApiDirect('/query', 'POST', {
      query: `интервью пользователя ${userId}`,
      mode: 'local',
      top_k: 1,
      workspace: workspaceName,
    });
    
    // Check if we got meaningful data (not just "no information" response)
    if (interviewData && interviewData.response && 
        !interviewData.response.includes('не располагаю достаточной информацией') &&
        !interviewData.response.includes('не найдено') &&
        interviewData.response.length > 50) {
      
      // Define the 7 required preference categories
      const preferenceCategories = [
        'компетенции',
        'стиль общения', 
        'предпочтения для встреч',
        'фокусная работа',
        'стиль работы',
        'карьерные цели',
        'подход к решению'
      ];
      
      const filledFields = [];
      const missingFields = [];
      
      // Check preference categories with controlled concurrency to avoid RAG server conflicts
      const results = [];
      const batchSize = 3; // Process 3 categories at a time
      
      for (let i = 0; i < preferenceCategories.length; i += batchSize) {
        const batch = preferenceCategories.slice(i, i + batchSize);
        
        const batchPromises = batch.map(async (category) => {
          try {
            const categoryResponse = await callRagApiDirect('/query', 'POST', {
              query: `${category} пользователя ${userId}`,
              mode: 'local',
              top_k: 1,
              workspace: workspaceName,
            });
            
            // Check if we got meaningful data for this category
            if (categoryResponse && categoryResponse.response && 
                !categoryResponse.response.includes('не располагаю достаточной информацией') &&
                !categoryResponse.response.includes('не найдено') &&
                categoryResponse.response.length > 20) {
              console.log(`[Interview API] ✅ Found data for ${category}: ${categoryResponse.response.length} chars`);
              return { category, found: true };
            } else {
              console.log(`[Interview API] ❌ No data for ${category}`);
              return { category, found: false };
            }
          } catch (error) {
            console.log(`[Interview API] Error checking ${category}:`, error);
            return { category, found: false };
          }
        });
        
        const batchResults = await Promise.all(batchPromises);
        results.push(...batchResults);
        
        // Small delay between batches to prevent server overload
        if (i + batchSize < preferenceCategories.length) {
          await new Promise(resolve => setTimeout(resolve, 100));
        }
      }
      
      // Process results
      for (const result of results) {
        if (result.found) {
          filledFields.push({ key: result.category });
        } else {
          missingFields.push({ key: result.category });
        }
      }
      
      const completeness = Math.round((filledFields.length / preferenceCategories.length) * 100);
      
      return NextResponse.json({
        hasInterview: true,
        message: completeness === 100 ? 'Интервью завершено полностью' : `Интервью завершено на ${completeness}%`,
        completeness,
        filledFields: filledFields.length,
        totalFields: preferenceCategories.length,
        missingFields: missingFields.map(f => f.key),
        interviewData: interviewData.response,
        debugProfile: interviewData.response, // Full profile for debugging
      });
    }
    
    return NextResponse.json({
      hasInterview: false,
      message: 'Первичное интервью не проводилось',
      completeness: 0,
      debugProfile: 'No interview data found', // Debug info
    });
  } catch (error: any) {
    console.error('Error checking interview status:', error);
    return NextResponse.json({
      hasInterview: false,
      message: `Ошибка при проверке статуса интервью: ${error.message}`,
      completeness: 0,
      debugProfile: `Error: ${error.message}`, // Debug info
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
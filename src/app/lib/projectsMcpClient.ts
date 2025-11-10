/**
 * MCP Client for Projects
 *
 * Клиент для работы с MCP сервером управления проектами.
 * Использует тот же MCP сервер, что и preferences, с иными tool_name.
 */

// MCP Projects API configuration (reuse same base as preferences)
const PROJECTS_MCP_BASE_URL = process.env.PREFERENCES_MCP_BASE_URL || 'https://rndaibot.ru';
const PROJECTS_MCP_TIMEOUT = parseInt(process.env.PREFERENCES_MCP_TIMEOUT || '30000');

// Direct backend endpoint
const PROJECTS_MCP_BACKEND = `${PROJECTS_MCP_BASE_URL}/api/v1/mcp/call`;

export const PROJECT_MCP_TOOLS = {
  GET_PROJECT: 'get_project',
  CREATE_PROJECT: 'create_project',
  UPDATE_PROJECT: 'update_project',
  UPDATE_PROJECT_FIELD: 'update_project_field',
  DELETE_PROJECT: 'delete_project',
  SEARCH_PROJECTS: 'search_projects',
  GET_ALL_PROJECTS: 'get_all_projects',
} as const;

export interface McpResponse<T = any> {
  success: boolean;
  message: string;
  data?: T;
  error?: string;
}

export interface Project {
  id: string;
  name: string;
  manager?: string | null;
  team?: string | null;
  description?: string | null;
  status?: string | null;
  created_at?: string;
  updated_at?: string;
}

async function callProjectsMcpServer(toolName: string, parameters: any, userId: string): Promise<McpResponse> {
  try {
    console.log(`[ProjectsMCP] Calling ${toolName} for user ${userId}`);
    console.log(`[ProjectsMCP] Parameters:`, parameters);

    const requestBody = {
      tool_name: toolName,
      parameters,
      user_id: userId,
    };

    const response = await fetch(PROJECTS_MCP_BACKEND, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(requestBody),
      signal: AbortSignal.timeout(PROJECTS_MCP_TIMEOUT),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error(`[ProjectsMCP] HTTP Error ${response.status}:`, errorText);
      throw new Error(`MCP server returned status ${response.status}: ${errorText}`);
    }

    const data = await response.json();
    console.log(`[ProjectsMCP] Response:`, { success: data.success, hasData: !!data.data });

    if (!data.success) {
      throw new Error(data.error || data.message || 'Unknown MCP error');
    }

    return data;
  } catch (error: any) {
    console.error(`[ProjectsMCP] Error calling ${toolName}:`, error);
    if (error.message.includes('Failed to fetch') || error.message.includes('ECONNREFUSED')) {
      console.error(`[ProjectsMCP] Server appears to be down at ${PROJECTS_MCP_BASE_URL}`);
    }
    throw new Error(`MCP connection failed: ${error.message}`);
  }
}

export async function getProject(name: string, userId: string): Promise<Project | null> {
  try {
    const res = await callProjectsMcpServer(
      PROJECT_MCP_TOOLS.GET_PROJECT,
      { name },
      userId
    );
    return res.data?.project || null;
  } catch (error) {
    console.error('[ProjectsMCP] Error getProject:', error);
    return null;
  }
}

export async function createProject(
  params: { name: string; manager?: string; team?: string; description?: string; status?: string },
  userId: string
): Promise<{ projectId?: string; success: boolean }> {
  try {
    const res = await callProjectsMcpServer(
      PROJECT_MCP_TOOLS.CREATE_PROJECT,
      params,
      userId
    );
    const projectId: string | undefined = res.data?.project?.id;
    return { success: !!res.success, projectId };
  } catch (error) {
    console.error('[ProjectsMCP] Error createProject:', error);
    return { success: false };
  }
}

export async function updateProject(
  projectId: string,
  patch: { name?: string; manager?: string; team?: string; description?: string; status?: string },
  userId: string
): Promise<boolean> {
  try {
    const res = await callProjectsMcpServer(
      PROJECT_MCP_TOOLS.UPDATE_PROJECT,
      { project_id: projectId, ...patch },
      userId
    );
    return res.success;
  } catch (error) {
    console.error('[ProjectsMCP] Error updateProject:', error);
    return false;
  }
}

export async function updateProjectField(
  projectId: string,
  field: string,
  value: string,
  userId: string
): Promise<boolean> {
  try {
    const res = await callProjectsMcpServer(
      PROJECT_MCP_TOOLS.UPDATE_PROJECT_FIELD,
      { project_id: projectId, field, value },
      userId
    );
    return res.success;
  } catch (error) {
    console.error('[ProjectsMCP] Error updateProjectField:', error);
    return false;
  }
}

export async function deleteProject(projectId: string, userId: string): Promise<boolean> {
  try {
    const res = await callProjectsMcpServer(
      PROJECT_MCP_TOOLS.DELETE_PROJECT,
      { project_id: projectId },
      userId
    );
    return res.success;
  } catch (error) {
    console.error('[ProjectsMCP] Error deleteProject:', error);
    return false;
  }
}

export async function searchProjects(
  field: string,
  searchTerm: string,
  userId: string
): Promise<{ id: string; name: string; field_value?: string; created_at?: string }[]> {
  try {
    const res = await callProjectsMcpServer(
      PROJECT_MCP_TOOLS.SEARCH_PROJECTS,
      { field, search_term: searchTerm },
      userId
    );
    return res.data?.projects || [];
  } catch (error) {
    console.error('[ProjectsMCP] Error searchProjects:', error);
    return [];
  }
}

export async function getAllProjects(
  skip: number = 0,
  limit: number = 100,
  userId: string = 'system'
): Promise<Project[]> {
  try {
    const res = await callProjectsMcpServer(
      PROJECT_MCP_TOOLS.GET_ALL_PROJECTS,
      { skip, limit },
      userId
    );
    return res.data?.projects || [];
  } catch (error) {
    console.error('[ProjectsMCP] Error getAllProjects:', error);
    return [];
  }
}



/**
 * MCP Client for User Preferences
 * 
 * Клиент для работы с новым MCP сервером предпочтений пользователей.
 * Заменяет RAG-based подход на структурированную работу с предпочтениями.
 */

// MCP Preferences API configuration
const PREFERENCES_MCP_BASE_URL = process.env.PREFERENCES_MCP_BASE_URL || 'https://rndaibot.ru';
const PREFERENCES_MCP_TIMEOUT = parseInt(process.env.PREFERENCES_MCP_TIMEOUT || '30000');

// Use Next.js API route as proxy for client-side execution
const PREFERENCES_API_PROXY = '/api/preferences-mcp';

// For server-side execution, use MCP server directly
const PREFERENCES_MCP_BACKEND = `${PREFERENCES_MCP_BASE_URL}/api/v1/mcp/call`;

/**
 * MCP Tool names from newMCP.md
 */
export const PREFERENCES_MCP_TOOLS = {
  GET_USER_PREFERENCES: 'get_user_preferences',
  CREATE_USER_PREFERENCES: 'create_user_preferences', 
  UPDATE_USER_PREFERENCES: 'update_user_preferences',
  UPDATE_PREFERENCE_FIELD: 'update_preference_field',
  DELETE_USER_PREFERENCES: 'delete_user_preferences',
  SEARCH_PREFERENCES: 'search_preferences',
  GET_ALL_PREFERENCES: 'get_all_preferences',
} as const;


/**
 * Field mapping from Russian to English for MCP API
 */
export const FIELD_MAPPING = {
  'компетенции': 'competencies',
  'стиль общения': 'communication_style', 
  'предпочтения по встречам': 'meeting_preferences',
  'фокусная работа': 'focused_work',
  'стиль работы': 'work_style',
  'карьерные цели': 'career_goals',
  'подход к решению': 'problem_solving_approach',
} as const;

/**
 * Reverse mapping from English to Russian
 */
export const REVERSE_FIELD_MAPPING = Object.fromEntries(
  Object.entries(FIELD_MAPPING).map(([ru, en]) => [en, ru])
);

/**
 * User preferences structure
 */
export interface UserPreferences {
  id?: string;
  user_id: string;
  competencies?: string;
  communication_style?: string;
  meeting_preferences?: string;
  focused_work?: string;
  work_style?: string;
  career_goals?: string;
  problem_solving_approach?: string;
  created_at?: string;
  updated_at?: string;
}

/**
 * MCP Response structure
 */
export interface McpResponse<T = any> {
  success: boolean;
  message: string;
  data?: T;
  error?: string;
}

/**
 * Call MCP server via JSON-RPC
 */
async function callPreferencesMcpServer(toolName: string, parameters: any, userId: string): Promise<McpResponse> {
  try {
    console.log(`[PreferencesMCP] Calling ${toolName} for user ${userId}`);
    console.log(`[PreferencesMCP] Parameters:`, parameters);

    const requestBody = {
      tool_name: toolName,
      parameters,
      user_id: userId,
    };

    // Use existing backend API for server-side execution
    const response = await fetch(PREFERENCES_MCP_BACKEND, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(requestBody),
      signal: AbortSignal.timeout(PREFERENCES_MCP_TIMEOUT),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error(`[PreferencesMCP] HTTP Error ${response.status}:`, errorText);
      throw new Error(`MCP server returned status ${response.status}: ${errorText}`);
    }

    const data = await response.json();
    console.log(`[PreferencesMCP] Response:`, { success: data.success, hasData: !!data.data });

    if (!data.success) {
      throw new Error(data.error || data.message || 'Unknown MCP error');
    }

    return data;
  } catch (error: any) {
    console.error(`[PreferencesMCP] Error calling ${toolName}:`, error);
    
    // Check if it's a connectivity issue
    if (error.message.includes('Failed to fetch') || error.message.includes('ECONNREFUSED')) {
      console.error(`[PreferencesMCP] Server appears to be down at ${PREFERENCES_MCP_BASE_URL}`);
      console.error(`[PreferencesMCP] Please check if MCP server is running`);
    }
    
    throw new Error(`MCP connection failed: ${error.message}`);
  }
}

/**
 * Get user preferences
 */
export async function getUserPreferences(userId: string): Promise<UserPreferences | null> {
  try {
    const response = await callPreferencesMcpServer(
      PREFERENCES_MCP_TOOLS.GET_USER_PREFERENCES,
      {},
      userId
    );

    return response.data?.preferences || null;
  } catch (error: any) {
    console.error('[PreferencesMCP] Error getting user preferences:', error);
    return null;
  }
}

/**
 * Create user preferences
 */
export async function createUserPreferences(
  userId: string, 
  preferences: Partial<UserPreferences>
): Promise<boolean> {
  try {
    const response = await callPreferencesMcpServer(
      PREFERENCES_MCP_TOOLS.CREATE_USER_PREFERENCES,
      preferences,
      userId
    );

    return response.success;
  } catch (error: any) {
    console.error('[PreferencesMCP] Error creating user preferences:', error);
    return false;
  }
}

/**
 * Update user preferences
 */
export async function updateUserPreferences(
  userId: string,
  preferences: Partial<UserPreferences>
): Promise<boolean> {
  try {
    const response = await callPreferencesMcpServer(
      PREFERENCES_MCP_TOOLS.UPDATE_USER_PREFERENCES,
      preferences,
      userId
    );

    return response.success;
  } catch (error: any) {
    console.error('[PreferencesMCP] Error updating user preferences:', error);
    return false;
  }
}

/**
 * Update specific preference field
 */
export async function updatePreferenceField(
  userId: string,
  field: string,
  value: string
): Promise<boolean> {
  try {
    // Map Russian field name to English
    const englishField = FIELD_MAPPING[field as keyof typeof FIELD_MAPPING] || field;
    
    const response = await callPreferencesMcpServer(
      PREFERENCES_MCP_TOOLS.UPDATE_PREFERENCE_FIELD,
      {
        field: englishField,
        value,
      },
      userId
    );

    return response.success;
  } catch (error: any) {
    console.error('[PreferencesMCP] Error updating preference field:', error);
    return false;
  }
}

/**
 * Delete user preferences
 */
export async function deleteUserPreferences(userId: string): Promise<boolean> {
  try {
    const response = await callPreferencesMcpServer(
      PREFERENCES_MCP_TOOLS.DELETE_USER_PREFERENCES,
      {},
      userId
    );

    return response.success;
  } catch (error: any) {
    console.error('[PreferencesMCP] Error deleting user preferences:', error);
    return false;
  }
}

/**
 * Search preferences by field
 */
export async function searchPreferences(
  field: string,
  searchTerm: string
): Promise<any[]> {
  try {
    const englishField = FIELD_MAPPING[field as keyof typeof FIELD_MAPPING] || field;
    
    const response = await callPreferencesMcpServer(
      PREFERENCES_MCP_TOOLS.SEARCH_PREFERENCES,
      {
        field: englishField,
        search_term: searchTerm,
      },
      'system' // Search doesn't require specific user
    );

    return response.data?.preferences || [];
  } catch (error: any) {
    console.error('[PreferencesMCP] Error searching preferences:', error);
    return [];
  }
}

/**
 * Get all preferences with pagination
 */
export async function getAllPreferences(
  skip: number = 0,
  limit: number = 100
): Promise<UserPreferences[]> {
  try {
    const response = await callPreferencesMcpServer(
      PREFERENCES_MCP_TOOLS.GET_ALL_PREFERENCES,
      { skip, limit },
      'system'
    );

    return response.data?.preferences || [];
  } catch (error: any) {
    console.error('[PreferencesMCP] Error getting all preferences:', error);
    return [];
  }
}

/**
 * Check if user has preferences (interview completeness check)
 */
export async function checkUserPreferencesCompleteness(userId: string): Promise<{
  hasPreferences: boolean;
  completeness: number;
  missingFields: string[];
  filledFields: string[];
  preferences?: UserPreferences;
}> {
  try {
    const preferences = await getUserPreferences(userId);
    
    if (!preferences) {
      return {
        hasPreferences: false,
        completeness: 0,
        missingFields: Object.keys(FIELD_MAPPING),
        filledFields: [],
      };
    }

    const requiredFields = Object.keys(FIELD_MAPPING);
    const filledFields: string[] = [];
    const missingFields: string[] = [];

    for (const [russianField, englishField] of Object.entries(FIELD_MAPPING)) {
      const value = preferences[englishField as keyof UserPreferences];
      if (value && value.trim().length > 0) {
        filledFields.push(russianField);
      } else {
        missingFields.push(russianField);
      }
    }

    const completeness = Math.round((filledFields.length / requiredFields.length) * 100);

    return {
      hasPreferences: true,
      completeness,
      missingFields,
      filledFields,
      preferences,
    };
  } catch (error: any) {
    console.error('[PreferencesMCP] Error checking preferences completeness:', error);
    return {
      hasPreferences: false,
      completeness: 0,
      missingFields: Object.keys(FIELD_MAPPING),
      filledFields: [],
    };
  }
}

/**
 * Convert preferences to Russian field names for display
 */
export function convertPreferencesToRussian(preferences: UserPreferences): Record<string, string> {
  const russianPreferences: Record<string, string> = {};
  
  for (const [russianField, englishField] of Object.entries(FIELD_MAPPING)) {
    const value = preferences[englishField as keyof UserPreferences];
    if (value) {
      russianPreferences[russianField] = value;
    }
  }
  
  return russianPreferences;
}

/**
 * Convert Russian field names to English for API calls
 */
export function convertPreferencesToEnglish(russianPreferences: Record<string, string>): Partial<UserPreferences> {
  const englishPreferences: Partial<UserPreferences> = {};
  
  for (const [russianField, value] of Object.entries(russianPreferences)) {
    const englishField = FIELD_MAPPING[russianField as keyof typeof FIELD_MAPPING];
    if (englishField) {
      englishPreferences[englishField as keyof UserPreferences] = value;
    }
  }
  
  return englishPreferences;
}

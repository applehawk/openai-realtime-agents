/**
 * Простой MCP сервер предпочтений для тестирования
 * Запуск: node simple-mcp-server.js
 * Порт: 3002
 */

const express = require('express');
const cors = require('cors');

const app = express();
const PORT = 3002;

// Middleware
app.use(cors());
app.use(express.json());

// In-memory storage для тестирования
const preferences = new Map();

// MCP Tools implementation
const mcpTools = {
  get_user_preferences: (params) => {
    const { user_id } = params;
    const userPrefs = preferences.get(user_id);
    
    if (!userPrefs) {
      return {
        success: false,
        message: 'User preferences not found',
        data: null,
        error: 'User preferences not found'
      };
    }
    
    return {
      success: true,
      message: 'Tool \'get_user_preferences\' executed successfully',
      data: {
        preferences: userPrefs
      }
    };
  },

  create_user_preferences: (params) => {
    const { user_id, ...prefs } = params;
    
    if (preferences.has(user_id)) {
      return {
        success: false,
        message: 'Preferences already exist for this user',
        data: null,
        error: 'Preferences already exist for this user'
      };
    }
    
    const newPrefs = {
      id: `pref_${Date.now()}`,
      user_id,
      ...prefs,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    };
    
    preferences.set(user_id, newPrefs);
    
    return {
      success: true,
      message: 'Tool \'create_user_preferences\' executed successfully',
      data: {
        message: 'User preferences created successfully',
        preferences: {
          id: newPrefs.id,
          user_id: newPrefs.user_id,
          created_at: newPrefs.created_at
        }
      }
    };
  },

  update_user_preferences: (params) => {
    const { user_id, ...newPrefs } = params;
    const existingPrefs = preferences.get(user_id);
    
    if (!existingPrefs) {
      return {
        success: false,
        message: 'User preferences not found',
        data: null,
        error: 'User preferences not found'
      };
    }
    
    const updatedPrefs = {
      ...existingPrefs,
      ...newPrefs,
      updated_at: new Date().toISOString()
    };
    
    preferences.set(user_id, updatedPrefs);
    
    return {
      success: true,
      message: 'Tool \'update_user_preferences\' executed successfully',
      data: {
        message: 'User preferences updated successfully',
        preferences: {
          id: updatedPrefs.id,
          user_id: updatedPrefs.user_id,
          updated_at: updatedPrefs.updated_at
        }
      }
    };
  },

  update_preference_field: (params) => {
    const { user_id, field, value } = params;
    const existingPrefs = preferences.get(user_id);
    
    if (!existingPrefs) {
      return {
        success: false,
        message: 'User preferences not found',
        data: null,
        error: 'User preferences not found'
      };
    }
    
    const updatedPrefs = {
      ...existingPrefs,
      [field]: value,
      updated_at: new Date().toISOString()
    };
    
    preferences.set(user_id, updatedPrefs);
    
    return {
      success: true,
      message: 'Tool \'update_preference_field\' executed successfully',
      data: {
        message: `Field '${field}' updated successfully`,
        preferences: {
          id: updatedPrefs.id,
          user_id: updatedPrefs.user_id,
          field,
          value,
          updated_at: updatedPrefs.updated_at
        }
      }
    };
  },

  delete_user_preferences: (params) => {
    const { user_id } = params;
    
    if (!preferences.has(user_id)) {
      return {
        success: false,
        message: 'User preferences not found',
        data: null,
        error: 'User preferences not found'
      };
    }
    
    preferences.delete(user_id);
    
    return {
      success: true,
      message: 'Tool \'delete_user_preferences\' executed successfully',
      data: {
        message: 'User preferences deleted successfully'
      }
    };
  },

  search_preferences: (params) => {
    const { field, search_term } = params;
    const results = [];
    
    for (const [userId, prefs] of preferences.entries()) {
      if (prefs[field] && prefs[field].toLowerCase().includes(search_term.toLowerCase())) {
        results.push({
          id: prefs.id,
          user_id: userId,
          field_value: prefs[field],
          created_at: prefs.created_at
        });
      }
    }
    
    return {
      success: true,
      message: `Found ${results.length} preferences matching '${search_term}' in field '${field}'`,
      data: {
        message: `Found ${results.length} preferences matching '${search_term}' in field '${field}'`,
        preferences: results
      }
    };
  },

  get_all_preferences: (params) => {
    const { skip = 0, limit = 100 } = params;
    const allPrefs = Array.from(preferences.values());
    const paginatedPrefs = allPrefs.slice(skip, skip + limit);
    
    return {
      success: true,
      message: 'Tool \'get_all_preferences\' executed successfully',
      data: {
        message: `Retrieved ${paginatedPrefs.length} preferences`,
        preferences: paginatedPrefs
      }
    };
  }
};

// MCP Execute endpoint
app.post('/api/v1/mcp/execute', (req, res) => {
  try {
    const { tool_name, parameters, user_id } = req.body;
    
    console.log(`[MCP Server] Executing ${tool_name} for user ${user_id}`);
    
    if (!mcpTools[tool_name]) {
      return res.json({
        success: false,
        message: `Unknown tool: ${tool_name}`,
        data: null,
        error: `Unknown tool: ${tool_name}`
      });
    }
    
    const result = mcpTools[tool_name](parameters);
    console.log(`[MCP Server] Result:`, { success: result.success, hasData: !!result.data });
    
    res.json(result);
  } catch (error) {
    console.error('[MCP Server] Error:', error);
    res.json({
      success: false,
      message: 'Internal server error',
      data: null,
      error: error.message
    });
  }
});

// Health check
app.get('/health', (req, res) => {
  res.json({
    status: 'healthy',
    message: 'MCP Preferences Server is running',
    port: PORT,
    preferences_count: preferences.size
  });
});

// Root endpoint
app.get('/', (req, res) => {
  res.json({
    message: 'MCP Preferences Server',
    version: '1.0.0',
    endpoints: {
      execute: '/api/v1/mcp/execute',
      health: '/health'
    },
    tools: Object.keys(mcpTools)
  });
});

// Start server
app.listen(PORT, () => {
  console.log(`🚀 MCP Preferences Server running on port ${PORT}`);
  console.log(`📡 Health check: http://localhost:${PORT}/health`);
  console.log(`🔧 Execute endpoint: http://localhost:${PORT}/api/v1/mcp/execute`);
  console.log(`📊 Current preferences: ${preferences.size}`);
});

// Graceful shutdown
process.on('SIGINT', () => {
  console.log('\n🛑 Shutting down MCP server...');
  process.exit(0);
});

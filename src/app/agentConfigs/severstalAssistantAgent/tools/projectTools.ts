import { tool } from '@openai/agents/realtime';
import {
  getProject,
  createProject as mcpCreateProject,
  updateProject as mcpUpdateProject,
  updateProjectField as mcpUpdateProjectField,
  deleteProject as mcpDeleteProject,
  searchProjects as mcpSearchProjects,
  getAllProjects as mcpGetAllProjects,
} from '@/app/lib/projectsMcpClient';

export const getProjectByName = tool({
  name: 'getProjectByName',
  description: 'Получить проект по названию (обертка над MCP get_project)',
  parameters: {
    type: 'object',
    properties: {
      name: { type: 'string', description: 'Название проекта' },
      userId: { type: 'string', description: 'UUID пользователя (пробрасывается в MCP)' },
    },
    required: ['name', 'userId'],
    additionalProperties: false,
  },
  execute: async (input: any) => {
    const { name, userId } = input;
    const project = await getProject(name, userId);
    if (!project) {
      return { success: true, message: "Project not found", data: { message: 'Project not found' } };
    }
    return { success: true, message: "Tool 'get_project' executed successfully", data: { project } };
  },
});

export const createProject = tool({
  name: 'createProject',
  description: 'Создать новый проект (обертка над MCP create_project)',
  parameters: {
    type: 'object',
    properties: {
      userId: { type: 'string', description: 'UUID пользователя (инициатор)' },
      name: { type: 'string', description: 'Название проекта' },
      manager: { type: 'string', description: 'Руководитель проекта' },
      team: { type: 'string', description: 'Команда проекта' },
      description: { type: 'string', description: 'Описание проекта' },
      status: { type: 'string', description: 'Статус проекта' },
    },
    required: ['userId', 'name'],
    additionalProperties: false,
  },
  execute: async (input: any) => {
    const { userId, name, manager, team, description, status } = input;
    const result = await mcpCreateProject({ name, manager, team, description, status }, userId);
    if (!result.success) {
      return { success: false, message: "Error executing tool 'create_project'", data: null, error: 'Create failed' };
    }
    return {
      success: true,
      message: "Tool 'create_project' executed successfully",
      data: { message: 'Project created successfully', project: { id: result.projectId, name } },
    };
  },
});

export const updateProject = tool({
  name: 'updateProject',
  description: 'Обновить проект (полное или частичное обновление) — MCP update_project',
  parameters: {
    type: 'object',
    properties: {
      userId: { type: 'string', description: 'UUID пользователя' },
      project_id: { type: 'string', description: 'ID проекта (UUID)' },
      name: { type: 'string' },
      manager: { type: 'string' },
      team: { type: 'string' },
      description: { type: 'string' },
      status: { type: 'string' },
    },
    required: ['userId', 'project_id'],
    additionalProperties: false,
  },
  execute: async (input: any) => {
    const { userId, project_id, name, manager, team, description, status } = input;
    const success = await mcpUpdateProject(project_id, { name, manager, team, description, status }, userId);
    return success
      ? { success: true, message: "Tool 'update_project' executed successfully", data: { message: 'Project updated successfully', project: { id: project_id, name } } }
      : { success: false, message: "Error executing tool 'update_project'", data: null, error: 'Update failed' };
  },
});

export const updateProjectField = tool({
  name: 'updateProjectField',
  description: 'Обновить конкретное поле проекта — MCP update_project_field',
  parameters: {
    type: 'object',
    properties: {
      userId: { type: 'string', description: 'UUID пользователя' },
      project_id: { type: 'string', description: 'ID проекта (UUID)' },
      field: { type: 'string', description: 'Поле проекта' },
      value: { type: 'string', description: 'Значение' },
    },
    required: ['userId', 'project_id', 'field', 'value'],
    additionalProperties: false,
  },
  execute: async (input: any) => {
    const { userId, project_id, field, value } = input;
    const success = await mcpUpdateProjectField(project_id, field, value, userId);
    return success
      ? { success: true, message: "Tool 'update_project_field' executed successfully", data: { message: `Field '${field}' updated successfully`, project: { id: project_id, field, value } } }
      : { success: false, message: "Error executing tool 'update_project_field'", data: null, error: 'Update field failed' };
  },
});

export const deleteProject = tool({
  name: 'deleteProject',
  description: 'Удалить проект — MCP delete_project',
  parameters: {
    type: 'object',
    properties: {
      userId: { type: 'string', description: 'UUID пользователя' },
      project_id: { type: 'string', description: 'ID проекта (UUID)' },
    },
    required: ['userId', 'project_id'],
    additionalProperties: false,
  },
  execute: async (input: any) => {
    const { userId, project_id } = input;
    const success = await mcpDeleteProject(project_id, userId);
    if (!success) {
      return { success: true, message: "Tool 'delete_project' executed successfully", data: { message: 'Project not found' } };
    }
    return { success: true, message: "Tool 'delete_project' executed successfully", data: { message: 'Project deleted successfully' } };
  },
});

export const searchProjects = tool({
  name: 'searchProjects',
  description: 'Поиск проектов по заданному полю — MCP search_projects',
  parameters: {
    type: 'object',
    properties: {
      userId: { type: 'string', description: 'UUID пользователя' },
      field: { type: 'string', description: 'Поле для поиска' },
      search_term: { type: 'string', description: 'Поисковый запрос' },
    },
    required: ['userId', 'field', 'search_term'],
    additionalProperties: false,
  },
  execute: async (input: any) => {
    const { userId, field, search_term } = input;
    const projects = await mcpSearchProjects(field, search_term, userId);
    return {
      success: true,
      message: "Tool 'search_projects' executed successfully",
      data: {
        message: `Found ${projects.length} projects matching '${search_term}' in field '${field}'`,
        projects,
      },
    };
  },
});

export const getAllProjects = tool({
  name: 'getAllProjects',
  description: 'Получить список всех проектов с пагинацией — MCP get_all_projects',
  parameters: {
    type: 'object',
    properties: {
      userId: { type: 'string', description: 'UUID пользователя (для трассировки)' },
      skip: { type: 'number', description: 'Количество записей для пропуска', default: 0 },
      limit: { type: 'number', description: 'Максимальное количество записей', default: 100 },
    },
    required: ['userId'],
    additionalProperties: false,
  },
  execute: async (input: any) => {
    const { userId, skip = 0, limit = 100 } = input;
    const projects = await mcpGetAllProjects(skip, limit, userId);
    return {
      success: true,
      message: "Tool 'get_all_projects' executed successfully",
      data: {
        message: `Retrieved ${projects.length} projects`,
        projects,
      },
    };
  },
});



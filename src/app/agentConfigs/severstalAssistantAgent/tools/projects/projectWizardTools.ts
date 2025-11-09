import { tool } from '@openai/agents/realtime';
import {
  createProject as mcpCreateProject,
  updateProjectField as mcpUpdateProjectField,
  getProject as mcpGetProject,
} from '@/app/lib/projectsMcpClient';

type WizardMode = 'create' | 'update_status' | 'get_info';

export const projectWizard = tool({
  name: 'projectWizard',
  description: 'Пошаговый мастер для создания проекта, обновления статуса и получения информации',
  parameters: {
    type: 'object',
    properties: {
      mode: { type: 'string', description: 'Режим мастера: create | update_status | get_info' },
      userId: { type: 'string', description: 'ID пользователя' },
      currentQuestion: { type: 'string', description: 'Текущий вопрос шага (номер как строка)' },
      userResponse: { type: 'string', description: 'Ответ пользователя на текущий вопрос' },
      state: {
        type: 'object',
        description: 'Накопленное состояние мастера',
        properties: {
          name: { type: 'string' },
          description: { type: 'string' },
          manager: { type: 'string' },
          team: { type: 'string' },
          status: { type: 'string' },
          project_id: { type: 'string' },
        },
      },
    },
    required: ['mode', 'userId', 'currentQuestion', 'userResponse', 'state'],
    additionalProperties: false,
  },
  execute: async (input: any) => {
    const { mode, userId, currentQuestion, userResponse } = input as { mode: WizardMode; userId: string; currentQuestion: string; userResponse: string };
    const state = { ...(input.state || {}) } as any;

    function next(step: number, text: string, stateOut: any) {
      return {
        status: 'in_progress',
        currentQuestionNumber: step,
        nextQuestion: text,
        state: stateOut,
      };
    }

    // CREATE FLOW (устойчивый): применяем ответ к ожидаемому полю и вычисляем следующий незаполненный шаг
    if (mode === 'create') {
      const steps: { id: number; field: 'name' | 'description' | 'manager' | 'team' | 'status'; prompt: string }[] = [
        { id: 1, field: 'name', prompt: 'Как назвать проект?' },
        { id: 2, field: 'description', prompt: 'Коротко опишите проект (1-2 предложения).' },
        { id: 3, field: 'manager', prompt: 'Кто руководитель проекта?' },
        { id: 4, field: 'team', prompt: 'Какая команда участвует? (свободный формат)' },
        { id: 5, field: 'status', prompt: 'Какой статус поставить? (Например: В планировании, В разработке, Завершен)' },
      ];

      const answered = (userResponse ?? '').trim();

      // Определяем следующее незаполненное поле по состоянию (игнорируем присланный currentQuestion)
      const nextMissing = steps.find(s => !state[s.field] || !String(state[s.field]).trim());

      // Если все поля уже были заполнены ранее (редкий случай), перейдём к валидации/созданию
      if (!nextMissing) {
        // fallthrough в блок создания ниже
      } else {
        // Применяем текущий ответ к этому ожидаемому полю
        state[nextMissing.field] = answered;
      }

      // После применения ответа, вычисляем следующий незаполненный шаг
      const stillMissing = steps.find(s => !state[s.field] || !String(state[s.field]).trim());
      if (stillMissing) {
        // Если имя осталось пустым/слишком коротким, форсим вопрос 1
        if (stillMissing.field === 'name') {
          if (!state.name || String(state.name).trim().length < 2) {
            return next(1, String(state.name).trim().length < 2 && state.name ? 'Название слишком короткое. Укажите название длиннее 2 символов.' : 'Как назвать проект?', state);
          }
        }
        return next(stillMissing.id, stillMissing.prompt, state);
      }

      // Все поля заполнены — валидация и создание
      if (!String(state.name).trim()) {
        return next(1, 'Как назвать проект?', state);
      }
      if (String(state.name).trim().length < 2) {
        return next(1, 'Название слишком короткое. Укажите название длиннее 2 символов.', state);
      }

      try {
        const existing = await mcpGetProject(state.name, userId);
        if (existing && existing.id) {
          return { status: 'error', message: `Проект с названием «${state.name}» уже существует. Уточните название или обновите существующий проект.`, state };
        }
        const result = await mcpCreateProject(
          { name: state.name, description: state.description, manager: state.manager, team: state.team, status: state.status },
          userId,
        );
        if (!result.success) {
          return { status: 'error', message: 'Не удалось создать проект. Попробуйте позже.', state };
        }
        return {
          status: 'completed',
          message: 'Проект создан успешно',
          data: { id: result.projectId, name: state.name, status: state.status },
          state,
        };
      } catch (e: any) {
        return { status: 'error', message: `Ошибка создания: ${e.message}`, state };
      }
    }

    // UPDATE STATUS FLOW: ask name -> ask new status -> update
    if (mode === 'update_status') {
      switch (currentQuestion) {
        case '1':
          state.name = userResponse?.trim();
          if (!state.name) {
            return next(1, 'Как называется проект, у которого нужно обновить статус?', state);
          }
          return next(2, `На какой статус обновить проект «${state.name}»?`, state);
        case '2':
          state.status = userResponse?.trim();
          if (!state.status) {
            return next(2, `Пожалуйста, укажите новый статус для «${state.name}».`, state);
          }
          try {
            const project = await mcpGetProject(state.name, userId);
            if (!project?.id) {
              return { status: 'error', message: 'Проект не найден. Проверьте название.', state };
            }
            const ok = await mcpUpdateProjectField(project.id, 'status', state.status, userId);
            if (!ok) {
              return { status: 'error', message: 'Не удалось обновить статус. Попробуйте позже.', state };
            }
            return {
              status: 'completed',
              message: `Статус проекта «${state.name}» обновлён на «${state.status}».`,
              data: { id: project.id, name: project.name, status: state.status },
              state,
            };
          } catch (e: any) {
            return { status: 'error', message: `Ошибка обновления: ${e.message}`, state };
          }
        default:
          return next(1, 'Как называется проект, у которого нужно обновить статус?', state);
      }
    }

    // GET INFO FLOW: ask name -> fetch
    if (mode === 'get_info') {
      switch (currentQuestion) {
        case '1':
          state.name = userResponse?.trim();
          if (!state.name) {
            return next(1, 'Введите название проекта для просмотра информации.', state);
          }
          try {
            const project = await mcpGetProject(state.name, userId);
            if (!project) {
              return { status: 'error', message: 'Проект не найден. Уточните название или создайте новый.', state };
            }
            return {
              status: 'completed',
              message: 'Информация о проекте получена',
              data: { project },
              state,
            };
          } catch (e: any) {
            return { status: 'error', message: `Ошибка запроса: ${e.message}`, state };
          }
        default:
          return next(1, 'Введите название проекта для просмотра информации.', state);
      }
    }

    return { status: 'error', message: 'Неизвестный режим мастера', state };
  },
});



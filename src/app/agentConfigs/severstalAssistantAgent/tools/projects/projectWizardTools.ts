import { tool } from '@openai/agents/realtime';
import {
  createProject as mcpCreateProject,
  updateProjectField as mcpUpdateProjectField,
  getProject as mcpGetProject,
  deleteProject as mcpDeleteProject,
} from '@/app/lib/projectsMcpClient';

type WizardMode = 'create' | 'update_status' | 'get_info' | 'delete';

export const projectWizard = tool({
  name: 'projectWizard',
  description: 'Мастер для создания проекта, обновления статуса, получения информации и удаления проекта',
  parameters: {
    type: 'object',
    properties: {
      mode: { type: 'string', description: 'Режим мастера: create | update_status | get_info | delete' },
      userId: { type: 'string', description: 'ID пользователя' },
      userResponse: { type: 'string', description: 'Ответ пользователя или запрос пользователя' },
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
    required: ['mode', 'userId', 'userResponse', 'state'],
    additionalProperties: false,
  },
  execute: async (input: any) => {
    const { mode, userId, userResponse } = input as { mode: WizardMode; userId: string; userResponse: string };
    const state = { ...(input.state || {}) } as any;

    function next(text: string, stateOut: any) {
      return {
        status: 'in_progress',
        nextQuestion: text,
        state: stateOut,
      };
    }

    // CREATE FLOW: интеллектуальное извлечение данных из естественного языка
    if (mode === 'create') {
      // Вспомогательная функция для вызова API структурирования
      async function extractProjectData(userText: string): Promise<{
        extracted: { name?: string; description?: string; manager?: string; team?: string; status?: string };
        missingFields: string[];
      }> {
        try {
          // Определяем базовый URL для API вызова
          // В Realtime API tools код может выполняться на клиенте или сервере
          // Используем переменную окружения или относительный путь
          const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || 
                         (typeof window !== 'undefined' ? window.location.origin : 'http://localhost:3000');
          
          const apiUrl = `${baseUrl}/api/extract-project-data`;
          console.log(`[ProjectWizard] Calling extract-project-data at: ${apiUrl}`);
          
          const response = await fetch(apiUrl, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ userText }),
          });

          if (!response.ok) {
            throw new Error(`API returned status ${response.status}`);
          }

          return await response.json();
        } catch (error: any) {
          console.error('[ProjectWizard] Error calling extract-project-data:', error);
          // Fallback: вернуть пустой результат со всеми полями как незаполненные
          return { extracted: {}, missingFields: ['name', 'description', 'manager', 'team', 'status'] };
        }
      }

      // Вспомогательная функция для определения незаполненных обязательных полей
      function getMissingRequiredFields(currentState: any): string[] {
        const requiredFields = ['name', 'description', 'manager', 'team', 'status'];
        const missing: string[] = [];

        for (const field of requiredFields) {
          const value = currentState[field];
          if (!value || typeof value !== 'string' || value.trim().length === 0) {
            missing.push(field);
          } else if (field === 'name' && value.trim().length < 2) {
            missing.push(field);
          }
        }

        return missing;
      }

      // Вызов API для структурирования данных из ответа пользователя
      const extractionResult = await extractProjectData(userResponse || '');

      // Дополнительная обработка явных ответов "нет" для недостающих полей
      // Если пользователь явно говорит "нет" для поля, которое отсутствует в state
      const userTextLower = (userResponse || '').toLowerCase().trim();
      const explicitNoPatterns = [
        /^(нет|отсутствует|не назначена?|не указана?|пока нет|ещё нет)$/i,
        /^(команды?|команда) (нет|отсутствует|не назначена?|пока нет)/i,
        /^(руководителя?|менеджера?) (нет|отсутствует|не назначен)/i,
      ];

      const isExplicitNo = explicitNoPatterns.some(pattern => pattern.test(userTextLower));

      // Объединение с существующим state (новые данные имеют приоритет)
      const mergedState = {
        ...state,
        ...Object.fromEntries(
          Object.entries(extractionResult.extracted).filter(([_, v]) => v != null && v.trim() !== '')
        ),
      };

      // Если пользователь явно говорит "нет" и есть незаполненные поля, заполняем их значением "отсутствует"
      if (isExplicitNo && extractionResult.missingFields.length > 0) {
        // Определяем, о каком поле идет речь по контексту вопроса или по ключевым словам
        if (userTextLower.includes('команд') && !mergedState.team) {
          mergedState.team = 'отсутствует';
        }
        if ((userTextLower.includes('руководител') || userTextLower.includes('менеджер')) && !mergedState.manager) {
          mergedState.manager = 'отсутствует';
        }
        // Если просто "нет" без контекста и есть только одно незаполненное поле, заполняем его
        if (extractionResult.missingFields.length === 1 && !userTextLower.includes('команд') && !userTextLower.includes('руководител') && !userTextLower.includes('менеджер')) {
          const singleMissingField = extractionResult.missingFields[0];
          if (!mergedState[singleMissingField]) {
            mergedState[singleMissingField] = 'отсутствует';
          }
        }
      }

      // Проверка всех обязательных полей
      const missingFields = getMissingRequiredFields(mergedState);

      if (missingFields.length > 0) {
        // Запросить недостающие поля списком
        const fieldNames: Record<string, string> = {
          name: 'название проекта',
          description: 'описание проекта',
          manager: 'руководитель проекта',
          team: 'команда проекта',
          status: 'статус проекта',
        };
        const missingNames = missingFields.map((f) => fieldNames[f]);
        return {
          status: 'in_progress',
          currentQuestionNumber: 1,
          nextQuestion: `Уточните, пожалуйста, недостающую информацию: ${missingNames.join(', ')}.`,
          state: mergedState,
        };
      }

      // Все поля заполнены — валидация и создание
      if (!String(mergedState.name).trim()) {
        return {
          status: 'in_progress',
          nextQuestion: 'Как назвать проект?',
          state: mergedState,
        };
      }
      if (String(mergedState.name).trim().length < 2) {
        return {
          status: 'in_progress',
          nextQuestion: 'Название слишком короткое. Укажите название длиннее 2 символов.',
          state: mergedState,
        };
      }

      try {
        const existing = await mcpGetProject(mergedState.name, userId);
        if (existing && existing.id) {
          return {
            status: 'error',
            message: `Проект с названием «${mergedState.name}» уже существует. Уточните название или обновите существующий проект.`,
            state: mergedState,
          };
        }
        const result = await mcpCreateProject(
          {
            name: mergedState.name,
            description: mergedState.description,
            manager: mergedState.manager,
            team: mergedState.team,
            status: mergedState.status,
          },
          userId,
        );
        if (!result.success) {
          return { status: 'error', message: 'Не удалось создать проект. Попробуйте позже.', state: mergedState };
        }
        return {
          status: 'completed',
          message: 'Проект создан успешно',
          data: { id: result.projectId, name: mergedState.name, status: mergedState.status },
          state: mergedState,
        };
      } catch (e: any) {
        return { status: 'error', message: `Ошибка создания: ${e.message}`, state: mergedState };
      }
    }

    // UPDATE STATUS FLOW: интеллектуальное извлечение имени проекта и статуса
    if (mode === 'update_status') {
      // Вспомогательная функция для вызова API структурирования
      async function extractProjectUpdate(userText: string): Promise<{
        extracted: { projectName?: string; status?: string };
        missingFields: string[];
      }> {
        try {
          // Определяем базовый URL для API вызова
          const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || 
                         (typeof window !== 'undefined' ? window.location.origin : 'http://localhost:3000');
          
          const apiUrl = `${baseUrl}/api/extract-project-update`;
          console.log(`[ProjectWizard] Calling extract-project-update at: ${apiUrl}`);
          
          const response = await fetch(apiUrl, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ userText }),
          });

          if (!response.ok) {
            throw new Error(`API returned status ${response.status}`);
          }

          return await response.json();
        } catch (error: any) {
          console.error('[ProjectWizard] Error calling extract-project-update:', error);
          // Fallback: вернуть пустой результат
          return { extracted: {}, missingFields: ['projectName', 'status'] };
        }
      }

      // Вызов API для структурирования данных из ответа пользователя
      const extractionResult = await extractProjectUpdate(userResponse || '');

      // Объединение с существующим state (новые данные имеют приоритет)
      const mergedState = {
        ...state,
        ...(extractionResult.extracted.projectName ? { name: extractionResult.extracted.projectName } : {}),
        ...(extractionResult.extracted.status ? { status: extractionResult.extracted.status } : {}),
      };

      // Проверка обязательных полей
      const missingFields: string[] = [];
      if (!mergedState.name || mergedState.name.trim().length === 0) {
        missingFields.push('projectName');
      }
      if (!mergedState.status || mergedState.status.trim().length === 0) {
        missingFields.push('status');
      }

      // Если есть незаполненные поля, запросить их
      if (missingFields.length > 0) {
        const fieldNames: Record<string, string> = {
          projectName: 'название проекта',
          status: 'новый статус',
        };
        const missingNames = missingFields.map((f) => fieldNames[f]);
        return {
          status: 'in_progress',
          nextQuestion: `Уточните, пожалуйста: ${missingNames.join(', ')}.`,
          state: mergedState,
        };
      }

      // Все поля заполнены — поиск проекта и обновление
      const finalState = { ...mergedState };
      try {
        // Если project_id уже есть в state (из предыдущего поиска), используем его
        let projectId = mergedState.project_id;
        let projectName = mergedState.name;

        // Если project_id нет, ищем проект по имени
        if (!projectId) {
          const project = await mcpGetProject(mergedState.name, userId);
          if (!project?.id) {
            return { status: 'error', message: 'Проект не найден. Проверьте название.', state: finalState };
          }
          projectId = project.id;
          projectName = project.name;
          // Сохраняем project_id в state для последующих операций
          finalState.project_id = projectId;
        }

        // Обновляем статус по ID
        const ok = await mcpUpdateProjectField(projectId, 'status', mergedState.status, userId);
        if (!ok) {
          return { status: 'error', message: 'Не удалось обновить статус. Попробуйте позже.', state: finalState };
        }
        return {
          status: 'completed',
          message: `Статус проекта «${projectName}» обновлён на «${mergedState.status}».`,
          data: { id: projectId, name: projectName, status: mergedState.status },
          state: finalState,
        };
      } catch (e: any) {
        return { status: 'error', message: `Ошибка обновления: ${e.message}`, state: finalState || mergedState };
      }
    }

    // GET INFO FLOW: интеллектуальное извлечение имени проекта
    if (mode === 'get_info') {
      // Вспомогательная функция для извлечения имени проекта
      async function extractProjectName(userText: string): Promise<string | null> {
        try {
          const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || 
                         (typeof window !== 'undefined' ? window.location.origin : 'http://localhost:3000');
          
          const apiUrl = `${baseUrl}/api/extract-project-update`;
          const response = await fetch(apiUrl, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ userText }),
          });

          if (!response.ok) {
            return null;
          }

          const result = await response.json();
          return result.extracted?.projectName || null;
        } catch (error: any) {
          console.error('[ProjectWizard] Error extracting project name:', error);
          return null;
        }
      }

      // Извлекаем название проекта из ответа пользователя
      const extractedName = await extractProjectName(userResponse || '');
      const projectName = extractedName || userResponse?.trim() || state.name;

      if (!projectName || projectName.length < 2) {
        return {
          status: 'in_progress',
          nextQuestion: 'Введите название проекта для просмотра информации.',
          state,
        };
      }

      state.name = projectName;

      try {
        const project = await mcpGetProject(projectName, userId);
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
    }

    // DELETE FLOW: ask name -> confirm -> delete
    if (mode === 'delete') {
      // Вспомогательная функция для извлечения имени проекта из запроса
      async function extractProjectName(userText: string): Promise<string | null> {
        try {
          const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || 
                         (typeof window !== 'undefined' ? window.location.origin : 'http://localhost:3000');
          
          const apiUrl = `${baseUrl}/api/extract-project-update`;
          const response = await fetch(apiUrl, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ userText }),
          });

          if (!response.ok) {
            return null;
          }

          const result = await response.json();
          return result.extracted?.projectName || null;
        } catch (error: any) {
          console.error('[ProjectWizard] Error extracting project name:', error);
          return null;
        }
      }

      // Если project_id уже есть в state, значит ждем подтверждения
      if (state.project_id) {
        // Шаг 2: Подтверждение удаления
        const confirmation = (userResponse || '').toLowerCase().trim();
        const confirmed = confirmation === 'да' || confirmation === 'yes' || confirmation === 'подтверждаю' || confirmation === 'удалить';

        if (!confirmed) {
          return {
            status: 'cancelled',
            message: 'Удаление проекта отменено.',
            state,
          };
        }

        // Выполняем удаление
        try {
          const success = await mcpDeleteProject(state.project_id, userId);
          if (!success) {
            return { status: 'error', message: 'Не удалось удалить проект. Попробуйте позже.', state };
          }

          return {
            status: 'completed',
            message: `Проект «${state.name}» успешно удалён.`,
            data: { name: state.name },
            state,
          };
        } catch (e: any) {
          return { status: 'error', message: `Ошибка удаления: ${e.message}`, state };
        }
      }

      // Шаг 1: Извлечение или запрос названия проекта
      const extractedName = await extractProjectName(userResponse || '');
      const projectName = extractedName || userResponse?.trim() || state.name;
      
      if (!projectName || projectName.length < 2) {
        return {
          status: 'in_progress',
          nextQuestion: 'Какой проект вы хотите удалить? Укажите название проекта.',
          state,
        };
      }

      state.name = projectName;

      // Ищем проект по имени
      try {
        const project = await mcpGetProject(projectName, userId);
        if (!project?.id) {
          return { status: 'error', message: 'Проект не найден. Проверьте название проекта.', state };
        }

        // Сохраняем project_id для удаления
        state.project_id = project.id;
        state.name = project.name; // Используем точное название из БД

        // Запрашиваем подтверждение
        return {
          status: 'in_progress',
          nextQuestion: `Вы уверены, что хотите удалить проект «${project.name}»? Это действие необратимо. Ответьте "да" для подтверждения или "нет" для отмены.`,
          state,
        };
      } catch (e: any) {
        return { status: 'error', message: `Ошибка поиска проекта: ${e.message}`, state };
      }
    }

    return { status: 'error', message: 'Неизвестный режим мастера', state };
  },
});



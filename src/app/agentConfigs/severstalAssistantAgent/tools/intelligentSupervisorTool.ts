/**
 * Tool for delegating complex tasks to unified Intelligent Supervisor
 *
 * This tool provides adaptive task delegation with automatic complexity assessment.
 * It replaces the manual decision-making between delegateToSupervisor (Path 4)
 * and executeComplexTask (Path 5).
 *
 * Features:
 * - Automatic complexity assessment (simple/medium/complex)
 * - Adaptive strategy selection (direct/flat/hierarchical)
 * - Built-in progress tracking
 * - Support for PLAN FIRST and EXECUTE IMMEDIATELY modes
 * - Always returns workflowSteps for transparency
 *
 * Version: 1.0
 * Date: 2025-10-23
 */

import { tool, RealtimeItem } from '@openai/agents/realtime';

/**
 * Tool that delegates tasks to unified Intelligent Supervisor
 */
export const delegateToIntelligentSupervisor = tool({
  name: 'delegateToIntelligentSupervisor',
  description: `
Делегирует сложные задачи унифицированному интеллектуальному supervisor-агенту с адаптивной оценкой сложности.

**НОВОЕ (v3.1): Умная делегация с возможностью возврата**
- Supervisor теперь СНАЧАЛА проверяет, действительно ли задача сложная
- Если задача простая (1 действие, явные параметры) → supervisor вернёт guidance для прямого выполнения
- Если задача сложная → supervisor выполнит её сам

**Используй КОГДА:**
- ✅ Задача МОЖЕТ быть сложной (2+ шага, условная логика)
- ✅ Не уверен в сложности задачи (простая vs средняя vs сложная)
- ✅ Требуется автоматическая оценка и выбор стратегии выполнения
- ✅ Нужны условная логика, координация, или кросс-референсы данных

**НЕ используй КОГДА:**
- ❌ ТОЧНО простое одношаговое действие с явными параметрами (используй MCP tools напрямую)
- ❌ Только RAG запрос (используй lightrag_query)
- ❌ Простое чтение/запись без логики (используй соответствующий MCP tool)

**Как это работает:**
1. **Step 0 (NEW)**: Delegation Review - проверка, нужна ли делегация
   - Если задача простая → возврат guidance для прямого выполнения (экономия 50-70% токенов)
   - Если задача сложная → продолжение обработки
2. Backend автоматически оценит сложность задачи (simple/medium/complex)
3. Выберет стратегию выполнения:
   - Direct: прямое выполнение для простых задач (1 шаг)
   - Flat: плоский workflow для средних задач (2-7 шагов)
   - Hierarchical: иерархическая декомпозиция для сложных задач (8+ шагов)
4. Выполнит задачу с прогресс-трекингом
5. Вернёт детальный ответ с workflowSteps

**Преимущества:**
- ✅ Умная делегация: автоматически определяет, нужна ли обработка
- ✅ Экономия токенов: простые задачи возвращаются сразу
- ✅ НЕ нужно определять сложность заранее (supervisor решит сам)
- ✅ Прогресс-трекинг всегда включён
- ✅ workflowSteps всегда возвращаются
- ✅ Поддерживает PLAN FIRST и EXECUTE IMMEDIATELY modes

**Примеры задач:**
- «Прочитай письмо от Анны и назначь встречу на предложенное время» → supervisor выполнит
- «Найди свободное время завтра и создай встречу с Петром» → supervisor выполнит
- «Прочитай последнее письмо» → supervisor вернёт guidance (слишком просто)

**Параметры:**
- taskDescription: полное описание задачи на русском (2-5 предложений)
- conversationContext: краткий контекст разговора (2-3 предложения)
- executionMode: (опционально) 'auto' | 'plan' | 'execute'
  - 'auto': supervisor сам решит, показывать план или выполнить сразу (по умолчанию)
  - 'plan': PLAN FIRST - вернуть план БЕЗ выполнения (для подтверждения)
  - 'execute': EXECUTE IMMEDIATELY - выполнить сразу без плана

**Обработка ответа:**
- Если result.delegateBack === true → задача простая, следуй guidance в result.guidance
- Иначе → задача выполнена supervisor, используй result.nextResponse

**ВАЖНО:**
- Это РЕКОМЕНДУЕМЫЙ способ для всех потенциально сложных задач
- Не бойся делегировать: supervisor сам решит, нужна ли обработка
`,
  parameters: {
    type: 'object',
    properties: {
      taskDescription: {
        type: 'string',
        description:
          'Полное описание задачи на русском языке. Будь максимально детальным - включи все требования, контекст, временные рамки. Минимум 2-5 предложений.',
      },
      conversationContext: {
        type: 'string',
        description:
          'Краткое резюме беседы с пользователем - ключевые моменты, что уже обсуждалось, какая информация уже известна. 2-3 предложения.',
      },
      executionMode: {
        type: 'string',
        enum: ['auto', 'plan', 'execute'],
        description:
          "Режим выполнения: 'auto' (supervisor решает сам), 'plan' (PLAN FIRST - вернуть план для подтверждения), 'execute' (EXECUTE IMMEDIATELY - выполнить сразу). Default: 'auto'",
      },
    },
    required: ['taskDescription', 'conversationContext'],
    additionalProperties: false,
  },
  execute: async (input, details) => {
    console.log('[intelligentSupervisorTool] Tool execute called');
    console.log('[intelligentSupervisorTool] Input:', JSON.stringify(input, null, 2));

    const { taskDescription, conversationContext, executionMode } = input as {
      taskDescription: string;
      conversationContext: string;
      executionMode?: 'auto' | 'plan' | 'execute';
    };

    const addBreadcrumb = (details?.context as any)?.addTranscriptBreadcrumb as
      | ((title: string, data?: any) => void)
      | undefined;

    const addTaskProgressMessage = (details?.context as any)?.addTaskProgressMessage as
      | ((sessionId: string, taskDescription: string) => void)
      | undefined;

    const history: RealtimeItem[] = (details?.context as any)?.history ?? [];

    try {
      console.log('[intelligentSupervisorTool] Calling /api/supervisor/unified...');

      // Generate sessionId for progress tracking
      const sessionId = `session-${Date.now()}-${Math.random().toString(36).substring(7)}`;

      // Create TASK_PROGRESS message in transcript
      if (addTaskProgressMessage) {
        console.log('[intelligentSupervisorTool] Creating TASK_PROGRESS message with sessionId:', sessionId);
        addTaskProgressMessage(sessionId, taskDescription);
      }

      // Also add breadcrumb for debugging
      if (addBreadcrumb) {
        addBreadcrumb('[Intelligent Supervisor] Запрос отправлен', {
          sessionId,
          taskDescription: taskDescription.substring(0, 100) + '...',
          executionMode: executionMode || 'auto',
        });
      }

      // Store sessionId in tool result so agent can use getTaskContext later
      console.log('[intelligentSupervisorTool] Returning sessionId for context access:', sessionId);

      // Call the unified intelligent supervisor endpoint
      const response = await fetch('/api/supervisor/unified', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          taskDescription,
          conversationContext,
          executionMode: executionMode || 'auto',
          maxComplexity: 'hierarchical', // Allow full complexity range
          history,
          sessionId, // Pass sessionId for SSE tracking
        }),
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.error('[intelligentSupervisorTool] API error:', response.status, errorText);

        if (addBreadcrumb) {
          addBreadcrumb('[Intelligent Supervisor] Ошибка выполнения', {
            status: response.status,
            error: errorText,
          });
        }

        return {
          success: false,
          error: `Ошибка выполнения задачи: ${response.statusText}`,
          fallbackResponse:
            'К сожалению, не удалось выполнить задачу. Попробуйте упростить запрос или обратитесь к другим инструментам.',
        };
      }

      const result = await response.json();

      console.log('[intelligentSupervisorTool] API response received:', {
        strategy: result.strategy,
        complexity: result.complexity,
        executionTime: result.executionTime,
        workflowStepsCount: result.workflowSteps?.length || 0,
        delegateBack: result.delegateBack || false,
      });

      // Handle delegateBack case
      if (result.delegateBack) {
        console.log('[intelligentSupervisorTool] ✅ Task delegated back to primary agent');
        console.log('[intelligentSupervisorTool] Guidance:', result.delegationGuidance);
        
        if (addBreadcrumb) {
          addBreadcrumb('[Intelligent Supervisor] Задача делегирована обратно', {
            guidance: result.delegationGuidance,
            executionTime: result.executionTime,
          });
        }

        return {
          success: true,
          delegateBack: true,
          guidance: result.delegationGuidance,
          nextResponse: result.nextResponse,
          complexity: result.complexity,
          executionTime: result.executionTime,
          message: '✅ Задача проста и может быть выполнена напрямую. Следуй инструкциям в guidance.',
        };
      }

      if (addBreadcrumb) {
        addBreadcrumb('[Intelligent Supervisor] Выполнение завершено', {
          strategy: result.strategy,
          complexity: result.complexity,
          executionTime: result.executionTime,
        });

        // Add breadcrumbs for each workflow step (if provided)
        if (result.workflowSteps && result.workflowSteps.length > 0) {
          result.workflowSteps.forEach((step: string, index: number) => {
            addBreadcrumb(`[Intelligent Supervisor] Шаг ${index + 1}/${result.workflowSteps.length}`, {
              step,
              completed: true,
            });
          });
          console.log(
            `[intelligentSupervisorTool] Added ${result.workflowSteps.length} workflow step breadcrumbs`
          );
        }

        // Add breadcrumbs for planned steps (if provided)
        if (result.plannedSteps && result.plannedSteps.length > 0) {
          addBreadcrumb('[Intelligent Supervisor] План выполнения составлен', {
            totalSteps: result.plannedSteps.length,
            steps: result.plannedSteps,
          });
          console.log(
            `[intelligentSupervisorTool] Added plan with ${result.plannedSteps.length} steps`
          );
        }
      }

      console.log('[intelligentSupervisorTool] Returning result');

      return {
        success: true,
        sessionId, // ← IMPORTANT: Agent can use this with getTaskContext tool
        strategy: result.strategy,
        complexity: result.complexity,
        nextResponse: result.nextResponse,
        workflowSteps: result.workflowSteps || [],
        plannedSteps: result.plannedSteps,
        hierarchicalBreakdown: result.hierarchicalBreakdown,
        progress: result.progress,
        executionTime: result.executionTime,
      };
    } catch (error) {
      console.error('[intelligentSupervisorTool] Exception:', error);

      if (addBreadcrumb) {
        addBreadcrumb('[Intelligent Supervisor] Исключение', {
          error: error instanceof Error ? error.message : 'Unknown',
        });
      }

      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
        fallbackResponse:
          'Произошла ошибка при выполнении задачи. Попробуйте упростить запрос или использовать другие инструменты.',
      };
    }
  },
});

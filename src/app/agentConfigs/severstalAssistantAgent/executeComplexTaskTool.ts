/**
 * Tool for executing VERY complex tasks through hierarchical task system
 *
 * This tool delegates extremely complex multi-step tasks to the TaskOrchestrator,
 * which will:
 * 1. Recursively break down the task into subtasks
 * 2. Execute each subtask in proper order (respecting dependencies)
 * 3. Collect results hierarchically
 * 4. Generate a comprehensive final report
 *
 * Use this ONLY for tasks with 8+ steps, mass operations, or multi-source coordination.
 *
 * Version: 1.0
 * Date: 2025-10-22
 */

import { tool, RealtimeItem } from '@openai/agents/realtime';

/**
 * Tool that delegates VERY complex tasks to the hierarchical task execution system
 */
export const executeComplexTask = tool({
  name: 'executeComplexTask',
  description: `
Выполнить ОЧЕНЬ СЛОЖНУЮ задачу через иерархическую систему декомпозиции и выполнения.

**Используй ТОЛЬКО когда:**
- ✅ Задача содержит 8+ независимых шагов
- ✅ Требуется множественная координация между подзадачами
- ✅ Задача затрагивает множество людей (отправка писем, приглашений)
- ✅ Массовые операции (создание 10+ событий, пересылка множества писем)
- ✅ Сложный анализ с множественными источниками данных
- ✅ Задача требует условной логики и зависимостей между шагами

**НЕ используй когда:**
- ❌ Задача простая (1-4 шага) → используй MCP tools напрямую
- ❌ Задача средней сложности (5-7 шагов) → используй delegateToSupervisor
- ❌ Задача требует только RAG запрос → используй lightrag_query

**Примеры задач для executeComplexTask:**
- "Найди всех участников проекта Восток, проверь их календари, найди общее время и отправь всем приглашения"
- "Проанализируй все письма за месяц, создай встречи по каждому обсуждению и отправь резюме всем участникам"
- "Создай 15 событий на основе расписания в документе и отправь персональные напоминания каждому"

**Как это работает:**
1. Supervisor разобьёт задачу на подзадачи рекурсивно (до 5 уровней вложенности)
2. Система выполнит каждую подзадачу в правильном порядке (с учётом зависимостей)
3. Результаты каждой подзадачи собираются иерархически
4. Генерируется финальный отчёт со всеми деталями

**ВАЖНО:** Эта операция может занять несколько минут. Предупреди пользователя!
`,
  parameters: {
    type: 'object',
    properties: {
      taskDescription: {
        type: 'string',
        description:
          'Полное описание ОЧЕНЬ сложной задачи на русском языке. Будь максимально детальным - включи все требования, контекст, временные рамки, участников.',
      },
      conversationContext: {
        type: 'string',
        description:
          'Краткое резюме беседы с пользователем - ключевые моменты, что уже обсуждалось, какая информация уже известна.',
      },
    },
    required: ['taskDescription', 'conversationContext'],
    additionalProperties: false,
  },
  execute: async (input, details) => {
    console.log('[executeComplexTask] Tool execute called');
    console.log('[executeComplexTask] Input:', JSON.stringify(input, null, 2));

    const { taskDescription, conversationContext } = input as {
      taskDescription: string;
      conversationContext: string;
    };

    const addBreadcrumb = (details?.context as any)?.addTranscriptBreadcrumb as
      | ((title: string, data?: any) => void)
      | undefined;

    const history: RealtimeItem[] = (details?.context as any)?.history ?? [];

    if (addBreadcrumb) {
      addBreadcrumb('[Complex Task] Запуск иерархического выполнения', {
        taskDescription: taskDescription.substring(0, 100) + '...',
      });
    }

    try {
      console.log('[executeComplexTask] Calling /api/tasks/execute...');

      // Call the hierarchical task execution API endpoint
      const response = await fetch('/api/tasks/execute', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          taskDescription,
          conversationContext,
        }),
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.error('[executeComplexTask] API error:', response.status, errorText);

        if (addBreadcrumb) {
          addBreadcrumb('[Complex Task] Ошибка выполнения', {
            status: response.status,
            error: errorText,
          });
        }

        return {
          success: false,
          error: `Ошибка выполнения задачи: ${response.statusText}`,
          message:
            'К сожалению, не удалось выполнить сложную задачу. Попробуйте разбить её на более простые части или обратитесь к supervisor через delegateToSupervisor.',
        };
      }

      const result = await response.json();

      console.log('[executeComplexTask] API response received:', {
        success: result.success,
        tasksCompleted: result.report?.tasksCompleted,
        tasksFailed: result.report?.tasksFailed,
      });

      if (!result.success) {
        console.error('[executeComplexTask] Execution failed:', result.error);

        if (addBreadcrumb) {
          addBreadcrumb('[Complex Task] Выполнение провалено', {
            error: result.error,
          });
        }

        return {
          success: false,
          error: result.error || 'Unknown error',
          message:
            'Не удалось выполнить сложную задачу. Попробуйте упростить запрос или разбить на части.',
        };
      }

      const report = result.report;

      if (addBreadcrumb) {
        addBreadcrumb('[Complex Task] Выполнено успешно', {
          tasksCompleted: report.tasksCompleted,
          tasksFailed: report.tasksFailed,
        });
      }

      // Format report for voice output
      const formattedReport = formatReportForVoice(report);

      console.log('[executeComplexTask] Returning formatted report');

      return {
        success: true,
        summary: report.summary,
        detailedResults: formattedReport,
        tasksCompleted: report.tasksCompleted,
        tasksFailed: report.tasksFailed,
        executionTime: report.executionTime,
        // Include hierarchical breakdown for potential UI display
        hierarchicalBreakdown: report.hierarchicalBreakdown,
      };
    } catch (error) {
      console.error('[executeComplexTask] Exception:', error);

      if (addBreadcrumb) {
        addBreadcrumb('[Complex Task] Исключение', {
          error: error instanceof Error ? error.message : 'Unknown',
        });
      }

      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
        message:
          'Произошла ошибка при выполнении сложной задачи. Попробуйте использовать delegateToSupervisor для задач средней сложности.',
      };
    }
  },
});

/**
 * Format report for voice output (Russian, natural speech)
 */
function formatReportForVoice(report: any): string {
  let output = report.detailedResults;

  // Add task statistics if relevant
  if (report.tasksCompleted > 1) {
    output += `\n\nВсего было выполнено ${numberToRussianWords(report.tasksCompleted)} ${pluralizeRussian(report.tasksCompleted, 'задача', 'задачи', 'задач')}.`;
  }

  if (report.tasksFailed > 0) {
    output += ` ${numberToRussianWords(report.tasksFailed)} ${pluralizeRussian(report.tasksFailed, 'задача провалилась', 'задачи провалились', 'задач провалились')}.`;
  }

  // Add execution time if significant
  if (report.executionTime > 5000) {
    const seconds = Math.round(report.executionTime / 1000);
    output += ` Выполнение заняло ${numberToRussianWords(seconds)} ${pluralizeRussian(seconds, 'секунду', 'секунды', 'секунд')}.`;
  }

  return output;
}

/**
 * Convert number to Russian words (simplified, 0-20)
 */
function numberToRussianWords(num: number): string {
  const words = [
    'ноль',
    'одна',
    'две',
    'три',
    'четыре',
    'пять',
    'шесть',
    'семь',
    'восемь',
    'девять',
    'десять',
    'одиннадцать',
    'двенадцать',
    'тринадцать',
    'четырнадцать',
    'пятнадцать',
    'шестнадцать',
    'семнадцать',
    'восемнадцать',
    'девятнадцать',
    'двадцать',
  ];
  return num <= 20 ? words[num] : num.toString();
}

/**
 * Pluralize Russian words based on count
 */
function pluralizeRussian(count: number, one: string, few: string, many: string): string {
  const mod10 = count % 10;
  const mod100 = count % 100;

  if (mod10 === 1 && mod100 !== 11) {
    return one;
  } else if (mod10 >= 2 && mod10 <= 4 && (mod100 < 10 || mod100 >= 20)) {
    return few;
  } else {
    return many;
  }
}

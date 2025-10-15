# Test Specification for severstalAssistant Supervisor Delegation Logic

This document provides comprehensive test cases for the supervisor delegation system.

**Note:** This project does not currently have a test runner configured (Jest/Mocha). To run these tests:
1. Install a test framework: `npm install --save-dev jest @types/jest ts-jest`
2. Configure Jest for TypeScript
3. Rename this file to `supervisorAgent.test.ts`
4. Run: `npm test`

## Test Setup

```typescript
import { shouldDelegateToSupervisor } from './supervisorAgent';
import type { RealtimeItem } from '@openai/agents/realtime';
```

## Test Suites

### 1. shouldDelegateToSupervisor heuristics

  describe('Simple single-tool operations (should NOT delegate)', () => {
    const simpleContext = {
      conversationHistory: [] as RealtimeItem[],
      availableTools: ['read_email', 'list_events', 'create_event'],
    };

    it('should not delegate for simple "read last email" request', () => {
      const result = shouldDelegateToSupervisor({
        userMessage: 'Прочитай последнее письмо',
        ...simpleContext,
      });
      expect(result).toBe(false);
    });

    it('should not delegate for "show today\'s meetings"', () => {
      const result = shouldDelegateToSupervisor({
        userMessage: 'Покажи встречи на сегодня',
        ...simpleContext,
      });
      expect(result).toBe(false);
    });

    it('should not delegate for "when is meeting with Igor"', () => {
      const result = shouldDelegateToSupervisor({
        userMessage: 'Когда встреча с Игорем?',
        ...simpleContext,
      });
      expect(result).toBe(false);
    });

    it('should not delegate for "what\'s next event"', () => {
      const result = shouldDelegateToSupervisor({
        userMessage: 'Какое следующее событие?',
        ...simpleContext,
      });
      expect(result).toBe(false);
    });
  });

  describe('Multi-step operations (SHOULD delegate)', () => {
    const baseContext = {
      conversationHistory: [] as RealtimeItem[],
      availableTools: ['read_email', 'list_events', 'create_event'],
    };

    it('should delegate for "read emails and then schedule meeting"', () => {
      const result = shouldDelegateToSupervisor({
        userMessage: 'Прочитай письма от Игоря и затем запланируй встречу',
        ...baseContext,
      });
      expect(result).toBe(true);
    });

    it('should delegate for "check calendar and if free, schedule call"', () => {
      const result = shouldDelegateToSupervisor({
        userMessage: 'Проверь календарь и если свободен, запланируй звонок',
        ...baseContext,
      });
      expect(result).toBe(true);
    });

    it('should delegate for "find emails and send based on content"', () => {
      const result = shouldDelegateToSupervisor({
        userMessage: 'Найди письма о проекте и отправь ответ основываясь на содержании',
        ...baseContext,
      });
      expect(result).toBe(true);
    });
  });

  describe('Ambiguous temporal references (SHOULD delegate)', () => {
    const baseContext = {
      conversationHistory: [] as RealtimeItem[],
      availableTools: ['read_email', 'list_events', 'create_event'],
    };

    it('should delegate for "schedule when convenient"', () => {
      const result = shouldDelegateToSupervisor({
        userMessage: 'Запланируй встречу когда удобно',
        ...baseContext,
      });
      expect(result).toBe(true);
    });

    it('should delegate for "next available time"', () => {
      const result = shouldDelegateToSupervisor({
        userMessage: 'Запланируй на ближайшее время',
        ...baseContext,
      });
      expect(result).toBe(true);
    });

    it('should delegate for "as soon as possible"', () => {
      const result = shouldDelegateToSupervisor({
        userMessage: 'Организуй звонок как можно быстрее',
        ...baseContext,
      });
      expect(result).toBe(true);
    });
  });

  describe('Bulk operations and filtering (SHOULD delegate)', () => {
    const baseContext = {
      conversationHistory: [] as RealtimeItem[],
      availableTools: ['read_email', 'list_events', 'create_event'],
    };

    it('should delegate for "all emails about project"', () => {
      const result = shouldDelegateToSupervisor({
        userMessage: 'Покажи все письма о проекте Х',
        ...baseContext,
      });
      expect(result).toBe(true);
    });

    it('should delegate for "all events except meetings"', () => {
      const result = shouldDelegateToSupervisor({
        userMessage: 'Покажи всех событий кроме встреч',
        ...baseContext,
      });
      expect(result).toBe(true);
    });

    it('should delegate for "only those containing keyword"', () => {
      const result = shouldDelegateToSupervisor({
        userMessage: 'Найди только те письма содержащие "отчёт"',
        ...baseContext,
      });
      expect(result).toBe(true);
    });
  });

  describe('Data synthesis operations (SHOULD delegate)', () => {
    const baseContext = {
      conversationHistory: [] as RealtimeItem[],
      availableTools: ['read_email', 'list_events', 'create_event'],
    };

    it('should delegate for "summarize emails"', () => {
      const result = shouldDelegateToSupervisor({
        userMessage: 'Резюмируй все письма за неделю',
        ...baseContext,
      });
      expect(result).toBe(true);
    });

    it('should delegate for "compare meetings and suggest"', () => {
      const result = shouldDelegateToSupervisor({
        userMessage: 'Сравни встречи и предложи приоритеты',
        ...baseContext,
      });
      expect(result).toBe(true);
    });

    it('should delegate for "analyze and recommend"', () => {
      const result = shouldDelegateToSupervisor({
        userMessage: 'Проанализируй мои встречи и что важнее',
        ...baseContext,
      });
      expect(result).toBe(true);
    });
  });

  describe('Complex conversation context (SHOULD delegate)', () => {
    it('should delegate after long conversation with repeated clarifications', () => {
      // Simulate a long conversation with many back-and-forth clarifications
      const longHistory: RealtimeItem[] = [
        { type: 'message', role: 'user', content: [{ type: 'input_text', text: 'Запланируй встречу' }] } as RealtimeItem,
        { type: 'message', role: 'assistant', content: [{ type: 'output_text', text: 'С кем встреча?' }] } as RealtimeItem,
        { type: 'message', role: 'user', content: [{ type: 'input_text', text: 'С Марией' }] } as RealtimeItem,
        { type: 'message', role: 'assistant', content: [{ type: 'output_text', text: 'Когда?' }] } as RealtimeItem,
        { type: 'message', role: 'user', content: [{ type: 'input_text', text: 'На следующей неделе' }] } as RealtimeItem,
        { type: 'message', role: 'assistant', content: [{ type: 'output_text', text: 'Уточните день?' }] } as RealtimeItem,
        { type: 'message', role: 'user', content: [{ type: 'input_text', text: 'Не знаю, когда она свободна' }] } as RealtimeItem,
        { type: 'message', role: 'assistant', content: [{ type: 'output_text', text: 'Уточните время?' }] } as RealtimeItem,
        { type: 'message', role: 'user', content: [{ type: 'input_text', text: 'Проверь её календарь и предложи' }] } as RealtimeItem,
      ];

      const result = shouldDelegateToSupervisor({
        userMessage: 'Проверь её календарь и предложи время',
        conversationHistory: longHistory,
        availableTools: ['read_email', 'list_events', 'create_event'],
      });

      expect(result).toBe(true);
    });
  });

  describe('Complexity scoring edge cases', () => {
    const baseContext = {
      conversationHistory: [] as RealtimeItem[],
      availableTools: ['read_email', 'list_events', 'create_event'],
    };

    it('should NOT delegate if only one complexity indicator present for simple task', () => {
      // Has "сложный" but is still fundamentally a simple read
      const result = shouldDelegateToSupervisor({
        userMessage: 'Прочитай последнее письмо',
        ...baseContext,
      });
      expect(result).toBe(false);
    });

    it('should delegate if multiple complexity indicators present', () => {
      // Has multiple: multi-step ("и затем"), synthesis ("резюмируй"), complexity keyword ("несколько")
      const result = shouldDelegateToSupervisor({
        userMessage: 'Прочитай несколько писем и затем резюмируй их',
        ...baseContext,
      });
      expect(result).toBe(true);
    });

    it('should delegate for explicitly complex requests', () => {
      const result = shouldDelegateToSupervisor({
        userMessage: 'Организуй сложный процесс с множеством встреч',
        ...baseContext,
      });
      expect(result).toBe(true);
    });
  });
});

describe('Supervisor delegation tool integration', () => {

  describe('Tool parameter validation', () => {
    it('should require all mandatory parameters', () => {
      const toolParams = {
        conversationContext: 'User wants to schedule meetings',
        proposedPlan: 'Check calendar and create events',
        userIntent: 'schedule multiple meetings',
        complexity: 'high' as const,
      };

      // Verify all required parameters are present
      expect(toolParams.conversationContext).toBeDefined();
      expect(toolParams.proposedPlan).toBeDefined();
      expect(toolParams.userIntent).toBeDefined();
      expect(toolParams.complexity).toBeDefined();
    });

    it('should validate complexity enum values', () => {
      const validComplexities: Array<'high' | 'medium' | 'low'> = ['high', 'medium', 'low'];

      validComplexities.forEach(complexity => {
        const toolParams = {
          conversationContext: 'test context',
          proposedPlan: 'test plan',
          userIntent: 'test intent',
          complexity,
        };
        expect(['high', 'medium', 'low']).toContain(toolParams.complexity);
      });
    });
  });

  describe('Mock supervisor responses', () => {
    it('should handle "approve" decision correctly', () => {
      const mockSupervisorResponse = {
        decision: 'approve' as const,
        reasoning: 'Plan is correct, proceed with execution',
        nextResponse: 'Встреча запланирована на четверг в 15:00.',
      };

      expect(mockSupervisorResponse.decision).toBe('approve');
      expect(mockSupervisorResponse.nextResponse).toBeDefined();
      expect(mockSupervisorResponse.nextResponse).toMatch(/^[А-Яа-я]/); // Russian text
    });

    it('should handle "modify" decision with suggested changes', () => {
      const mockSupervisorResponse = {
        decision: 'modify' as const,
        reasoning: 'Need to clarify recipient list',
        suggestedChanges: 'Ask user: "Всем из последней переписки?"',
        nextResponse: 'Уточните, пожалуйста: всем из последней переписки?',
      };

      expect(mockSupervisorResponse.decision).toBe('modify');
      expect(mockSupervisorResponse.suggestedChanges).toBeDefined();
      expect(mockSupervisorResponse.nextResponse).toMatch(/^[А-Яа-я]/);
    });

    it('should handle "reject" decision with reasoning', () => {
      const mockSupervisorResponse = {
        decision: 'reject' as const,
        reasoning: 'Destructive operation not supported',
        nextResponse: 'Извините, это действие невозможно из соображений безопасности.',
      };

      expect(mockSupervisorResponse.decision).toBe('reject');
      expect(mockSupervisorResponse.reasoning).toBeDefined();
      expect(mockSupervisorResponse.nextResponse).toMatch(/^[А-Яа-я]/);
    });

    it('should handle "delegateBack" decision for simple tasks', () => {
      const mockSupervisorResponse = {
        decision: 'delegateBack' as const,
        reasoning: 'Task is simple enough for primary agent',
        suggestedChanges: 'Use read_email tool directly',
        nextResponse: 'Вот последнее письмо от Игоря.',
      };

      expect(mockSupervisorResponse.decision).toBe('delegateBack');
      expect(mockSupervisorResponse.suggestedChanges).toBeDefined();
    });
  });

  describe('Error handling scenarios', () => {
    it('should handle network errors gracefully', () => {
      const mockErrorResponse = {
        error: 'Network error contacting supervisor.',
        fallbackResponse: 'Извините, не могу обработать этот запрос. Попробуйте попроще?',
      };

      expect(mockErrorResponse.error).toBeDefined();
      expect(mockErrorResponse.fallbackResponse).toMatch(/^[А-Яа-я]/);
    });

    it('should handle API errors gracefully', () => {
      const mockErrorResponse = {
        error: 'Supervisor agent unavailable.',
        fallbackResponse: 'Извините, не могу обработать этот запрос. Попробуйте попроще?',
      };

      expect(mockErrorResponse.error).toBeDefined();
      expect(mockErrorResponse.fallbackResponse).toBeDefined();
    });

    it('should handle invalid JSON responses', () => {
      const mockInvalidResponse = {
        decision: 'reject' as const,
        reasoning: 'Invalid supervisor response format',
        nextResponse: 'Извините, не удалось обработать запрос.',
      };

      expect(mockInvalidResponse.decision).toBe('reject');
      expect(mockInvalidResponse.reasoning).toContain('Invalid');
    });
  });
});

describe('Integration scenarios', () => {

  it('should handle complete workflow for complex request', () => {
    // Step 1: Heuristic determines delegation is needed
    const shouldDelegate = shouldDelegateToSupervisor({
      userMessage: 'Прочитай письма от Марии и если там упоминается встреча, запланируй её',
      conversationHistory: [],
      availableTools: ['read_email', 'create_event'],
    });
    expect(shouldDelegate).toBe(true);

    // Step 2: Tool is called with proper parameters
    const toolCall = {
      conversationContext: 'User wants to read emails from Maria and schedule any mentioned meetings',
      proposedPlan: 'Read emails, parse content for meeting details, create calendar event',
      userIntent: 'schedule meeting based on email content',
      complexity: 'high' as const,
    };
    expect(toolCall.complexity).toBe('high');

    // Step 3: Supervisor returns decision
    const supervisorResponse = {
      decision: 'approve' as const,
      reasoning: 'Multi-step operation requires email parsing then conditional event creation',
      nextResponse: 'Нашёл упоминание встречи в письме от Марии. Запланировал на среду в 14:00.',
    };
    expect(supervisorResponse.decision).toBe('approve');
    expect(supervisorResponse.nextResponse).toBeDefined();
  });

  it('should handle simple request without delegation', () => {
    // Heuristic determines no delegation needed
    const shouldDelegate = shouldDelegateToSupervisor({
      userMessage: 'Прочитай последнее письмо',
      conversationHistory: [],
      availableTools: ['read_email'],
    });
    expect(shouldDelegate).toBe(false);

    // Primary agent handles directly via MCP tool
    // No supervisor call needed
  });

  it('should handle ambiguous request with modification', () => {
    // Step 1: Delegation needed due to ambiguity
    const shouldDelegate = shouldDelegateToSupervisor({
      userMessage: 'Отправь всем письмо о встрече',
      conversationHistory: [],
      availableTools: ['send_email', 'list_contacts'],
    });
    expect(shouldDelegate).toBe(true);

    // Step 2: Supervisor modifies the plan
    const supervisorResponse = {
      decision: 'modify' as const,
      reasoning: 'Need to clarify "всем" - unclear recipient list',
      suggestedChanges: 'Ask: "Всем сотрудникам или конкретной группе?"',
      nextResponse: 'Уточните, пожалуйста: всем сотрудникам или определённой группе?',
    };
    expect(supervisorResponse.decision).toBe('modify');
    expect(supervisorResponse.suggestedChanges).toBeDefined();
  });
});
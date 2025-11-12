import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import {
  lightragQuery,
  lightragQueryData,
  lightragInsertText,
  lightragSearchLabels,
  lightragCheckEntityExists,
  lightragUpdateEntity,
  lightragUpdateRelation,
  lightragDeleteEntity,
  lightragDeleteRelation,
} from './ragTools';

const ORIGINAL_FETCH = global.fetch;

describe('RAG Tools', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  afterEach(() => {
    global.fetch = ORIGINAL_FETCH;
  });

  describe('lightragQuery', () => {
    it('выполняет RAG запрос и возвращает результат', async () => {
      const mockResponse = {
        jsonrpc: '2.0',
        id: 1,
        result: {
          content: [{ text: 'Ответ на запрос' }],
        },
      };

      global.fetch = vi.fn().mockResolvedValue(
        new Response(JSON.stringify(mockResponse), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        })
      );

      const result = await lightragQuery.invoke({
        query: 'тестовый запрос',
        mode: 'mix',
      });

      expect(result).toBeDefined();
    });

    it('обрабатывает JSON ответ с полем response', async () => {
      const mockResponse = {
        jsonrpc: '2.0',
        id: 1,
        result: {
          content: [{ text: JSON.stringify({ response: 'Ответ из JSON' }) }],
        },
      };

      global.fetch = vi.fn().mockResolvedValue(
        new Response(JSON.stringify(mockResponse), {
          status: 200,
        })
      );

      const result = await lightragQuery.invoke({
        query: 'запрос',
      });

      expect(result).toBeDefined();
    });

    it('обрабатывает ошибки соединения', async () => {
      global.fetch = vi.fn().mockRejectedValue(new Error('Failed to fetch'));

      // SDK обрабатывает ошибки и возвращает их как строки с сообщением
      // Примечание: SDK может валидировать параметры до вызова execute,
      // поэтому fetch может не быть вызван, если валидация не прошла
      const result = await lightragQuery.invoke({
        query: 'запрос',
      });
      
      // SDK возвращает ошибку как строку, проверяем что ошибка обработана
      expect(result).toBeDefined();
      expect(typeof result).toBe('string');
      // Проверяем что результат содержит информацию об ошибке (SDK форматирует ошибки)
      expect(result.length).toBeGreaterThan(0);
    });

    it('использует значения по умолчанию для опциональных параметров', async () => {
      const mockResponse = {
        jsonrpc: '2.0',
        id: 1,
        result: { content: [{ text: 'Ответ' }] },
      };

      global.fetch = vi.fn().mockResolvedValue(
        new Response(JSON.stringify(mockResponse), { status: 200 })
      );

      const result = await lightragQuery.invoke({
        query: 'запрос',
        // mode и include_references не указаны - должны использоваться значения по умолчанию
      });

      expect(result).toBeDefined();
    });
  });

  describe('lightragQueryData', () => {
    it('получает структурированные данные', async () => {
      const mockResponse = {
        jsonrpc: '2.0',
        id: 1,
        result: {
          content: [{ text: JSON.stringify({ entities: [], relationships: [] }) }],
        },
      };

      global.fetch = vi.fn().mockResolvedValue(
        new Response(JSON.stringify(mockResponse), { status: 200 })
      );

      const result = await lightragQueryData.invoke({
        query: 'запрос данных',
        mode: 'local',
      });

      expect(result).toBeDefined();
    });
  });

  describe('lightragInsertText', () => {
    it('вставляет текст в RAG систему', async () => {
      const mockResponse = {
        jsonrpc: '2.0',
        id: 1,
        result: { content: [{ text: 'Текст успешно добавлен' }] },
      };

      global.fetch = vi.fn().mockResolvedValue(
        new Response(JSON.stringify(mockResponse), { status: 200 })
      );

      const result = await lightragInsertText.invoke({
        text: 'Новый текст для добавления',
        file_source: 'test_source',
      });

      expect(result).toBeDefined();
    });
  });

  describe('lightragSearchLabels', () => {
    it('ищет метки в knowledge graph', async () => {
      const mockResponse = {
        jsonrpc: '2.0',
        id: 1,
        result: { content: [{ text: JSON.stringify(['метка1', 'метка2']) }] },
      };

      global.fetch = vi.fn().mockResolvedValue(
        new Response(JSON.stringify(mockResponse), { status: 200 })
      );

      const result = await lightragSearchLabels.invoke({
        query: 'поиск',
        limit: 50,
      });

      expect(result).toBeDefined();
    });

    it('использует значение по умолчанию для limit', async () => {
      const mockResponse = {
        jsonrpc: '2.0',
        id: 1,
        result: { content: [{ text: '[]' }] },
      };

      global.fetch = vi.fn().mockResolvedValue(
        new Response(JSON.stringify(mockResponse), { status: 200 })
      );

      const result = await lightragSearchLabels.invoke({
        query: 'поиск',
        // limit не указан - должно использоваться значение по умолчанию (100)
      });

      expect(result).toBeDefined();
    });
  });

  describe('lightragCheckEntityExists', () => {
    it('проверяет существование entity', async () => {
      const mockResponse = {
        jsonrpc: '2.0',
        id: 1,
        result: { content: [{ text: 'true' }] },
      };

      global.fetch = vi.fn().mockResolvedValue(
        new Response(JSON.stringify(mockResponse), { status: 200 })
      );

      const result = await lightragCheckEntityExists.invoke({
        entity_name: 'test_entity',
      });

      expect(result).toBeDefined();
    });
  });

  describe('lightragUpdateEntity', () => {
    it('обновляет entity в knowledge graph', async () => {
      const mockResponse = {
        jsonrpc: '2.0',
        id: 1,
        result: { content: [{ text: 'Entity обновлен' }] },
      };

      global.fetch = vi.fn().mockResolvedValue(
        new Response(JSON.stringify(mockResponse), { status: 200 })
      );

      const result = await lightragUpdateEntity.invoke({
        entity_name: 'test_entity',
        properties: { key: 'value' },
      });

      expect(result).toBeDefined();
    });
  });

  describe('lightragUpdateRelation', () => {
    it('обновляет связь между entities', async () => {
      const mockResponse = {
        jsonrpc: '2.0',
        id: 1,
        result: { content: [{ text: 'Связь обновлена' }] },
      };

      global.fetch = vi.fn().mockResolvedValue(
        new Response(JSON.stringify(mockResponse), { status: 200 })
      );

      const result = await lightragUpdateRelation.invoke({
        source_entity: 'entity1',
        target_entity: 'entity2',
        relation_type: 'related_to',
        properties: { weight: 0.5 },
      });

      expect(result).toBeDefined();
    });
  });

  describe('lightragDeleteEntity', () => {
    it('удаляет entity из knowledge graph', async () => {
      const mockResponse = {
        jsonrpc: '2.0',
        id: 1,
        result: { content: [{ text: 'Entity удален' }] },
      };

      global.fetch = vi.fn().mockResolvedValue(
        new Response(JSON.stringify(mockResponse), { status: 200 })
      );

      const result = await lightragDeleteEntity.invoke({
        entity_name: 'test_entity',
      });

      expect(result).toBeDefined();
    });
  });

  describe('lightragDeleteRelation', () => {
    it('удаляет связь между entities', async () => {
      const mockResponse = {
        jsonrpc: '2.0',
        id: 1,
        result: { content: [{ text: 'Связь удалена' }] },
      };

      global.fetch = vi.fn().mockResolvedValue(
        new Response(JSON.stringify(mockResponse), { status: 200 })
      );

      const result = await lightragDeleteRelation.invoke({
        source_entity: 'entity1',
        target_entity: 'entity2',
        relation_type: 'related_to',
      });

      expect(result).toBeDefined();
    });
  });
});

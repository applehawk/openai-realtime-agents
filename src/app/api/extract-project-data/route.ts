import { NextRequest, NextResponse } from 'next/server';

export async function POST(request: NextRequest) {
  try {
    const { userText } = await request.json();

    console.log(`[ExtractProjectData] Extracting project data from:`, userText);
    console.log(`[ExtractProjectData] OPENAI_API_KEY present:`, !!process.env.OPENAI_API_KEY);

    // Call OpenAI API for extraction
    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${process.env.OPENAI_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'gpt-4o-mini',
        messages: [
          {
            role: 'system',
            content: `Извлеки из текста пользователя информацию о проекте.
Все поля обязательные: name, description, manager, team, status.

Верни ТОЛЬКО валидный JSON без дополнительного текста:
{
  "name": "название проекта или null",
  "description": "описание проекта или null",
  "manager": "руководитель проекта или null",
  "team": "команда проекта или null",
  "status": "статус проекта или null"
}

ВАЖНО: Если пользователь явно говорит, что поля нет/отсутствует (например: "команды нет", "команды пока нет", "команда отсутствует", "не назначена"), извлеки это как строку "отсутствует" или "не назначена", а НЕ как null.
Если поле не упомянуто вообще, верни null для этого поля.

Название проекта/пилота (name) должно быть минимум 2 символа.
Распознавай вариации: "руководитель", "менеджер", "PM", "проект-менеджер" → manager
Распознавай вариации: "команда", "участники", "team" → team
Распознавай вариации: "статус", "этап", "стадия", "в стадии" → status

Примеры обработки отсутствующих значений:
- "команды нет" → team: "отсутствует"
- "команды пока нет" → team: "отсутствует"
- "команда не назначена" → team: "не назначена"`
          },
          {
            role: 'user',
            content: `Текст пользователя: ${userText}

Извлеки информацию о проекте и верни JSON.`
          }
        ],
        temperature: 0.3,
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error(`[ExtractProjectData] OpenAI API error: ${response.status} - ${errorText}`);
      throw new Error(`OpenAI API error: ${response.status} - ${errorText}`);
    }

    const data = await response.json();
    console.log(`[ExtractProjectData] OpenAI API response:`, data);
    
    let extractedData: {
      name: string | null;
      description: string | null;
      manager: string | null;
      team: string | null;
      status: string | null;
    };

    try {
      const content = data.choices[0].message.content;
      // Попытка извлечь JSON из ответа (на случай если есть дополнительный текст)
      const jsonMatch = content.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        extractedData = JSON.parse(jsonMatch[0]);
      } else {
        extractedData = JSON.parse(content);
      }
    } catch (parseError) {
      console.error('[ExtractProjectData] JSON parse error:', parseError);
      // Fallback: вернуть все поля как null
      extractedData = {
        name: null,
        description: null,
        manager: null,
        team: null,
        status: null,
      };
    }

    console.log(`[ExtractProjectData] Parsed extracted data:`, extractedData);

    // Определение незаполненных полей
    const requiredFields = ['name', 'description', 'manager', 'team', 'status'];
    const missingFields: string[] = [];

    for (const field of requiredFields) {
      const value = extractedData[field as keyof typeof extractedData];
      if (!value || typeof value !== 'string' || value.trim().length === 0) {
        missingFields.push(field);
      } else if (field === 'name' && value.trim().length < 2) {
        missingFields.push(field);
      }
    }

    // Формирование результата
    const extracted: {
      name?: string;
      description?: string;
      manager?: string;
      team?: string;
      status?: string;
    } = {};

    if (extractedData.name && extractedData.name.trim().length >= 2) {
      extracted.name = extractedData.name.trim();
    }
    if (extractedData.description && extractedData.description.trim().length > 0) {
      extracted.description = extractedData.description.trim();
    }
    if (extractedData.manager && extractedData.manager.trim().length > 0) {
      // Принимаем любые значения, включая "отсутствует" и т.д.
      extracted.manager = extractedData.manager.trim();
    }
    if (extractedData.team && extractedData.team.trim().length > 0) {
      // Принимаем любые значения, включая "отсутствует", "не назначена" и т.д.
      extracted.team = extractedData.team.trim();
    }
    if (extractedData.status && extractedData.status.trim().length > 0) {
      extracted.status = extractedData.status.trim();
    }

    return NextResponse.json({
      extracted,
      missingFields,
    });
  } catch (error: any) {
    console.error('[ExtractProjectData] Error extracting project data:', error);
    
    // Fallback: вернуть пустой результат со всеми полями как незаполненные
    return NextResponse.json({
      extracted: {},
      missingFields: ['name', 'description', 'manager', 'team', 'status'],
    });
  }
}


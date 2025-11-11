import { NextRequest, NextResponse } from 'next/server';

export async function POST(request: NextRequest) {
  try {
    const { userText } = await request.json();

    console.log(`[ExtractProjectUpdate] Extracting project name and status from:`, userText);
    console.log(`[ExtractProjectUpdate] OPENAI_API_KEY present:`, !!process.env.OPENAI_API_KEY);

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
            content: `Извлеки из текста пользователя название проекта и новый статус для обновления.

Верни ТОЛЬКО валидный JSON без дополнительного текста:
{
  "projectName": "точное название проекта или null",
  "status": "новый статус проекта или null"
}

ВАЖНО: 
- Извлекай ТОЛЬКО название проекта, без лишних слов типа "проект", "этот проект" и т.д.
- Если пользователь говорит "этот проект", "проект Звезда", "Звезда" - извлеки только "Звезда"
- Статус должен быть отделен от названия проекта
- Если название проекта не найдено, верни null для projectName
- Если статус не найден, верни null для status

Примеры:
- "обновить статус проекта Звезда на архивирован" → {"projectName": "Звезда", "status": "архивирован"}
- "изменить статус этого проекта на завершен" → {"projectName": null, "status": "завершен"} (название нужно уточнить)
- "статус архивирован" → {"projectName": null, "status": "архивирован"}
- "проект Звезда, статус архивирован" → {"projectName": "Звезда", "status": "архивирован"}`
          },
          {
            role: 'user',
            content: `Текст пользователя: ${userText}

Извлеки название проекта и статус для обновления.`
          }
        ],
        temperature: 0.3,
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error(`[ExtractProjectUpdate] OpenAI API error: ${response.status} - ${errorText}`);
      throw new Error(`OpenAI API error: ${response.status} - ${errorText}`);
    }

    const data = await response.json();
    console.log(`[ExtractProjectUpdate] OpenAI API response:`, data);
    
    let extractedData: {
      projectName: string | null;
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
      console.error('[ExtractProjectUpdate] JSON parse error:', parseError);
      // Fallback: вернуть все поля как null
      extractedData = {
        projectName: null,
        status: null,
      };
    }

    console.log(`[ExtractProjectUpdate] Parsed extracted data:`, extractedData);

    // Формирование результата
    const extracted: {
      projectName?: string;
      status?: string;
    } = {};

    if (extractedData.projectName && extractedData.projectName.trim().length >= 2) {
      extracted.projectName = extractedData.projectName.trim();
    }
    if (extractedData.status && extractedData.status.trim().length > 0) {
      extracted.status = extractedData.status.trim();
    }

    // Определение незаполненных полей
    const missingFields: string[] = [];
    if (!extracted.projectName) {
      missingFields.push('projectName');
    }
    if (!extracted.status) {
      missingFields.push('status');
    }

    return NextResponse.json({
      extracted,
      missingFields,
    });
  } catch (error: any) {
    console.error('[ExtractProjectUpdate] Error extracting project update data:', error);
    
    // Fallback: вернуть пустой результат со всеми полями как незаполненные
    return NextResponse.json({
      extracted: {},
      missingFields: ['projectName', 'status'],
    });
  }
}


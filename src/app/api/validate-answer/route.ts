import { NextRequest, NextResponse } from 'next/server';

export async function POST(request: NextRequest) {
  try {
    const { question, userAnswer, questionNumber } = await request.json();

    console.log(`[ValidateAnswer] Validating answer for question ${questionNumber}:`, userAnswer);
    console.log(`[ValidateAnswer] OPENAI_API_KEY present:`, !!process.env.OPENAI_API_KEY);
    console.log(`[ValidateAnswer] OPENAI_API_KEY length:`, process.env.OPENAI_API_KEY?.length || 0);
    console.log(`[ValidateAnswer] OPENAI_API_KEY prefix:`, process.env.OPENAI_API_KEY?.substring(0, 7) || 'NOT_SET');

    // Call OpenAI API for validation
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
            content: `Вы эксперт по анализу ответов в интервью. Ваша задача - определить качество ответа пользователя.

ВАЖНО: Будьте МЯГКИМИ в оценке. Пропускайте почти все ответы, кроме явно нерелевантных.

Критерии НЕкачественного ответа (только эти случаи должны возвращать isValid: false):
- Полностью нерелевантный ответ (не по теме вопроса)
- Бессмысленный текст ("ля-ля-ля", "раз два три", "абвгд")
- Очевидно случайные символы или набор букв
- Ответы, которые явно не относятся к вопросу
- Общие фразы - (Не знаю, как обычно, по-разному)

Критерии качественного ответа (все остальные случаи):
- Любой осмысленный ответ, даже короткий
- Ответы типа "да", "нет" - принимайте как валидные
- Короткие ответы - принимайте как валидные
- Любой ответ, который хоть как-то связан с вопросом

Верните JSON:
{
  "isValid": true/false,
  "reason": "краткое объяснение",
  "suggestion": "предложение для переформулировки вопроса (если isValid = false)"
}`
          },
          {
            role: 'user',
            content: `Вопрос ${questionNumber}: ${question}

Ответ пользователя: ${userAnswer}

Проанализируйте качество ответа.`
          }
        ],
        temperature: 0.3,
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error(`[ValidateAnswer] OpenAI API error: ${response.status} - ${errorText}`);
      throw new Error(`OpenAI API error: ${response.status} - ${errorText}`);
    }

    const data = await response.json();
    console.log(`[ValidateAnswer] OpenAI API response:`, data);
    
    const validationResult = JSON.parse(data.choices[0].message.content);
    console.log(`[ValidateAnswer] Parsed validation result:`, validationResult);

    return NextResponse.json({
      isValid: validationResult.isValid,
      reason: validationResult.reason,
      suggestion: validationResult.suggestion || null,
      questionNumber,
      userAnswer,
    });
  } catch (error: any) {
    console.error('[ValidateAnswer] Error validating answer:', error);
    
    // Fallback: use simple validation if API fails - be very permissive
    const { userAnswer, questionNumber } = await request.json();
    
    // Only reject obviously meaningless responses
    const isObviouslyMeaningless = userAnswer.match(/^(ля-ля-ля|раз два три|один два три|абвгд|qwerty|asdfgh)$/i) || 
                                   userAnswer.trim().length < 2 ||
                                   /^[^а-яё\s]+$/i.test(userAnswer); // Only non-Cyrillic characters
    
    return NextResponse.json({
      isValid: !isObviouslyMeaningless,
      reason: !isObviouslyMeaningless ? 
        'Простая валидация: ответ принят' : 
        'Простая валидация: ответ слишком бессмысленный',
      suggestion: isObviouslyMeaningless ? 'Пожалуйста, дайте осмысленный ответ' : null,
      questionNumber,
      userAnswer,
    });
  }
}

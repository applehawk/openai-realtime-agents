import { RealtimeAgent } from '@openai/agents/realtime';
import { interviewPrompt2 } from '../prompts/interviewPrompt2';
import {
  saveInterviewInsight,
  getUserInsights,
  suggestProfileQuestion,
  checkProfileCompleteness,
} from '../tools/tmp/interviewTools2';

/**
 * Interview Agent 2.0 - Progressive, Natural Profile Building
 *
 * Отличия от оригинального interviewAgent:
 * 1. Нет формального структурированного интервью
 * 2. Профиль строится органически через естественное общение
 * 3. Инсайты сохраняются по мере появления в разговоре
 * 4. Агент использует 4 специализированных инструмента вместо 3
 * 5. Фокус на постепенном накоплении знаний, а не на быстром сборе данных
 */

export const interviewAgent2 = new RealtimeAgent({
  name: 'interviewAgent2',
  handoffDescription: 'Агент для органического изучения предпочтений и стиля работы пользователя через естественное общение',
  instructions: interviewPrompt2,
  tools: [
    saveInterviewInsight,       // Сохранить один инсайт из разговора
    getUserInsights,            // Получить сохраненные инсайты пользователя
    suggestProfileQuestion,     // Предложить естественный вопрос для изучения
    checkProfileCompleteness,   // Проверить полноту профиля
  ],
  handoffs: [], // Агент работает автономно, без передач
  voice: 'alloy',
});

/**
 * Использование interviewAgent2:
 *
 * 1. Добавь в массив агентов вместо или вместе с оригинальным interviewAgent
 * 2. Агент автоматически:
 *    - Проверит профиль при начале разговора
 *    - Будет сохранять инсайты по мере общения
 *    - Персонализирует ответы на основе известных предпочтений
 *    - Периодически изучит полноту профиля для планирования
 *
 * 3. Пользователь не заметит формального интервью - профиль растет естественно
 *
 * Пример взаимодействия:
 *
 * User: "Привет, помоги настроить мониторинг"
 * Agent: [getUserInsights] → Нет профиля
 * Agent: "Привет! Конечно помогу с мониторингом. Чтобы лучше понимать контекст,
 *         расскажи в паре слов - ты DevOps инженер или из другой области?"
 * User: "Да, я DevOps, занимаюсь в основном инфраструктурой"
 * Agent: [saveInterviewInsight: category="expertise", insight="DevOps инженер, специализация - инфраструктура"]
 * Agent: "Отлично! Тогда предлагаю настроить Prometheus + Grafana. Показать конфиг?"
 *
 * Следующий диалог:
 * User: "Нужно автоматизировать деплой"
 * Agent: [getUserInsights] → "DevOps инженер, специализация - инфраструктура"
 * Agent: "Понял, раз ты работаешь с инфраструктурой - рассмотрим Terraform + GitOps.
 *         Ты предпочитаешь GitLab CI или GitHub Actions?"
 * User: "GitHub Actions, обычно работаю с ним"
 * Agent: [saveInterviewInsight: category="expertise", insight="Предпочитает GitHub Actions для CI/CD"]
 * Agent: "Отлично! Подготовлю workflow для GitHub Actions..."
 */

export default interviewAgent2;

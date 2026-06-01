/**
 * timeUtils.ts — Utilitário central de data/hora para o KalendAI
 *
 * Usa `date-fns-tz` para cálculos corretos com fusos IANA.
 * Configurado pelo .env: TIMEZONE e DISABLE_WEEKENDS
 */
import { toZonedTime, fromZonedTime } from 'date-fns-tz';

// ─── Configuração via .env ───────────────────────────────────────────────────

/**
 * Retorna o timezone IANA configurado no .env.
 * Fallback: America/Sao_Paulo
 *
 * Exemplos válidos:
 *   America/Sao_Paulo, America/New_York, Europe/Lisbon, UTC, Asia/Tokyo
 */
export function getConfiguredTimezone(): string {
  return process.env.TIMEZONE || 'America/Sao_Paulo';
}

/**
 * Retorna true se DISABLE_WEEKENDS=true no .env.
 * Quando ativo, o rollover de sexta vai direto para segunda.
 */
export function areWeekendsDisabled(): boolean {
  return process.env.DISABLE_WEEKENDS === 'true';
}

// ─── Data atual no timezone configurado ─────────────────────────────────────

/**
 * Retorna a data de "hoje" no timezone configurado,
 * com horas zeradas (00:00:00.000 UTC).
 *
 * Exemplo: Se o timezone é America/Sao_Paulo (UTC-3) e UTC são 02:30,
 * retorna o dia anterior (23:30 BRT → ainda é "ontem" em SP).
 */
export function getTodayInConfiguredTz(): Date {
  const tz = getConfiguredTimezone();
  const now = new Date();
  // Converte para a data local no timezone configurado
  const zonedNow = toZonedTime(now, tz);
  // Zera a hora para obter o "início do dia" naquele timezone
  zonedNow.setHours(0, 0, 0, 0);
  // Converte de volta para UTC para armazenar no banco
  return fromZonedTime(zonedNow, tz);
}

// ─── Lógica de próximo dia útil ─────────────────────────────────────────────

/**
 * Retorna o dia da semana (0=Domingo, 6=Sábado) de uma data
 * no timezone configurado.
 */
export function getDayOfWeekInTz(date: Date): number {
  const tz = getConfiguredTimezone();
  const zoned = toZonedTime(date, tz);
  return zoned.getDay();
}

/**
 * Retorna true se a data for sábado ou domingo no timezone configurado.
 */
export function isWeekend(date: Date): boolean {
  const dow = getDayOfWeekInTz(date);
  return dow === 0 || dow === 6; // 0=Dom, 6=Sáb
}

/**
 * Calcula o próximo dia para o rollover de cards.
 *
 * Regras:
 * - Normalmente: próximo dia (+1)
 * - Se DISABLE_WEEKENDS=true:
 *   - Sexta (5) → Segunda (+3)
 *   - Sábado (6) → Segunda (+2) [caso o rollover seja executado no sábado por algum motivo]
 *   - Domingo (0) → Segunda (+1)
 *   - Outros dias → +1 normal
 *
 * @param fromDate - Data de origem do rollover (geralmente "ontem")
 * @returns Data de destino dos cards transportados
 */
export function getNextRolloverDay(fromDate: Date): Date {
  const weekendsDisabled = areWeekendsDisabled();
  const tz = getConfiguredTimezone();

  // Trabalhamos com cópia do "fromDate" no timezone configurado
  const zonedFrom = toZonedTime(fromDate, tz);
  const dow = zonedFrom.getDay(); // 0=Dom, 1=Seg, ..., 5=Sex, 6=Sáb

  let daysToAdd = 1; // padrão: próximo dia

  if (weekendsDisabled) {
    if (dow === 5) {
      // Sexta → Segunda (+3)
      daysToAdd = 3;
    } else if (dow === 6) {
      // Sábado → Segunda (+2)
      daysToAdd = 2;
    } else if (dow === 0) {
      // Domingo → Segunda (+1)
      daysToAdd = 1;
    }
    // Segunda a Quinta → +1 normal
  }

  const nextDay = new Date(zonedFrom);
  nextDay.setDate(nextDay.getDate() + daysToAdd);
  nextDay.setHours(0, 0, 0, 0);

  return fromZonedTime(nextDay, tz);
}

/**
 * Verifica se deve ignorar o rollover hoje porque fins de semana estão
 * desabilitados e o dia atual (no timezone configurado) é sábado ou domingo.
 *
 * Isso evita que o rollover crie cards em dias que o usuário não usa.
 */
export function shouldSkipRolloverToday(): boolean {
  if (!areWeekendsDisabled()) return false;

  const today = getTodayInConfiguredTz();
  return isWeekend(today);
}

/**
 * Retorna "ontem" no timezone configurado com horas zeradas.
 * Usado para buscar os cards do dia anterior no rollover.
 */
export function getYesterdayInConfiguredTz(): Date {
  const today = getTodayInConfiguredTz();
  const yesterday = new Date(today);
  yesterday.setDate(yesterday.getDate() - 1);
  return yesterday;
}

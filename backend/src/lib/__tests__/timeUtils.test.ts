/**
 * timeUtils.test.ts — Testes unitários das funções de data/timezone
 *
 * Estratégia:
 * - Funções puras são testadas diretamente
 * - process.env é manipulado via beforeEach/afterEach para isolamento
 * - Datas fixas são usadas para garantir determinismo dos testes
 */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import {
  getConfiguredTimezone,
  areWeekendsDisabled,
  isWeekend,
  getNextRolloverDay,
  shouldSkipRolloverToday,
  getTodayInConfiguredTz,
  getYesterdayInConfiguredTz
} from '../timeUtils.js';

// ─── Helpers ────────────────────────────────────────────────────────────────

/**
 * Cria uma data UTC a partir de ano/mês/dia (1-indexed).
 * Horas zeradas (meia-noite UTC).
 */
function makeDate(year: number, month: number, day: number): Date {
  return new Date(Date.UTC(year, month - 1, day, 0, 0, 0, 0));
}

// ─── getConfiguredTimezone ───────────────────────────────────────────────────

describe('getConfiguredTimezone', () => {
  const originalTz = process.env.TIMEZONE;

  afterEach(() => {
    process.env.TIMEZONE = originalTz;
  });

  it('retorna America/Sao_Paulo como padrão quando TIMEZONE não está definido', () => {
    delete process.env.TIMEZONE;
    expect(getConfiguredTimezone()).toBe('America/Sao_Paulo');
  });

  it('retorna o valor configurado no .env', () => {
    process.env.TIMEZONE = 'Europe/Lisbon';
    expect(getConfiguredTimezone()).toBe('Europe/Lisbon');
  });

  it('retorna UTC quando configurado como UTC', () => {
    process.env.TIMEZONE = 'UTC';
    expect(getConfiguredTimezone()).toBe('UTC');
  });
});

// ─── areWeekendsDisabled ─────────────────────────────────────────────────────

describe('areWeekendsDisabled', () => {
  const originalVal = process.env.DISABLE_WEEKENDS;

  afterEach(() => {
    process.env.DISABLE_WEEKENDS = originalVal;
  });

  it('retorna false quando DISABLE_WEEKENDS não está definido', () => {
    delete process.env.DISABLE_WEEKENDS;
    expect(areWeekendsDisabled()).toBe(false);
  });

  it('retorna false quando DISABLE_WEEKENDS=false', () => {
    process.env.DISABLE_WEEKENDS = 'false';
    expect(areWeekendsDisabled()).toBe(false);
  });

  it('retorna true quando DISABLE_WEEKENDS=true', () => {
    process.env.DISABLE_WEEKENDS = 'true';
    expect(areWeekendsDisabled()).toBe(true);
  });

  it('é case-sensitive — "True" não é true', () => {
    process.env.DISABLE_WEEKENDS = 'True';
    expect(areWeekendsDisabled()).toBe(false);
  });
});

// ─── isWeekend ───────────────────────────────────────────────────────────────

describe('isWeekend', () => {
  beforeEach(() => {
    process.env.TIMEZONE = 'UTC';
  });

  // 2026-06-01 = Segunda-feira
  it('segunda-feira NÃO é fim de semana', () => {
    expect(isWeekend(makeDate(2026, 6, 1))).toBe(false);
  });

  // 2026-06-04 = Quinta-feira
  it('quinta-feira NÃO é fim de semana', () => {
    expect(isWeekend(makeDate(2026, 6, 4))).toBe(false);
  });

  // 2026-06-05 = Sexta-feira
  it('sexta-feira NÃO é fim de semana', () => {
    expect(isWeekend(makeDate(2026, 6, 5))).toBe(false);
  });

  // 2026-06-06 = Sábado
  it('sábado É fim de semana', () => {
    expect(isWeekend(makeDate(2026, 6, 6))).toBe(true);
  });

  // 2026-06-07 = Domingo
  it('domingo É fim de semana', () => {
    expect(isWeekend(makeDate(2026, 6, 7))).toBe(true);
  });
});

// ─── getNextRolloverDay ──────────────────────────────────────────────────────

describe('getNextRolloverDay — com fins de semana HABILITADOS (padrão)', () => {
  beforeEach(() => {
    process.env.TIMEZONE = 'UTC';
    process.env.DISABLE_WEEKENDS = 'false';
  });

  it('segunda → terça (+1)', () => {
    const from = makeDate(2026, 6, 1); // Segunda
    const next = getNextRolloverDay(from);
    expect(next.toISOString().startsWith('2026-06-02')).toBe(true); // Terça
  });

  it('quinta → sexta (+1)', () => {
    const from = makeDate(2026, 6, 4); // Quinta
    const next = getNextRolloverDay(from);
    expect(next.toISOString().startsWith('2026-06-05')).toBe(true); // Sexta
  });

  it('sexta → sábado (+1) quando fins de semana estão habilitados', () => {
    const from = makeDate(2026, 6, 5); // Sexta
    const next = getNextRolloverDay(from);
    expect(next.toISOString().startsWith('2026-06-06')).toBe(true); // Sábado
  });

  it('sábado → domingo (+1) quando fins de semana estão habilitados', () => {
    const from = makeDate(2026, 6, 6); // Sábado
    const next = getNextRolloverDay(from);
    expect(next.toISOString().startsWith('2026-06-07')).toBe(true); // Domingo
  });

  it('domingo → segunda (+1) quando fins de semana estão habilitados', () => {
    const from = makeDate(2026, 6, 7); // Domingo
    const next = getNextRolloverDay(from);
    expect(next.toISOString().startsWith('2026-06-08')).toBe(true); // Segunda
  });
});

describe('getNextRolloverDay — com fins de semana DESABILITADOS', () => {
  beforeEach(() => {
    process.env.TIMEZONE = 'UTC';
    process.env.DISABLE_WEEKENDS = 'true';
  });

  it('segunda → terça (+1)', () => {
    const from = makeDate(2026, 6, 1); // Segunda
    const next = getNextRolloverDay(from);
    expect(next.toISOString().startsWith('2026-06-02')).toBe(true);
  });

  it('terça → quarta (+1)', () => {
    const from = makeDate(2026, 6, 2); // Terça
    const next = getNextRolloverDay(from);
    expect(next.toISOString().startsWith('2026-06-03')).toBe(true);
  });

  it('quarta → quinta (+1)', () => {
    const from = makeDate(2026, 6, 3); // Quarta
    const next = getNextRolloverDay(from);
    expect(next.toISOString().startsWith('2026-06-04')).toBe(true);
  });

  it('quinta → sexta (+1)', () => {
    const from = makeDate(2026, 6, 4); // Quinta
    const next = getNextRolloverDay(from);
    expect(next.toISOString().startsWith('2026-06-05')).toBe(true);
  });

  it('SEXTA → SEGUNDA (+3) — o caso mais importante', () => {
    const from = makeDate(2026, 6, 5); // Sexta
    const next = getNextRolloverDay(from);
    expect(next.toISOString().startsWith('2026-06-08')).toBe(true); // Segunda
  });

  it('sábado → segunda (+2) se rollover for executado no sábado', () => {
    const from = makeDate(2026, 6, 6); // Sábado
    const next = getNextRolloverDay(from);
    expect(next.toISOString().startsWith('2026-06-08')).toBe(true); // Segunda
  });

  it('domingo → segunda (+1)', () => {
    const from = makeDate(2026, 6, 7); // Domingo
    const next = getNextRolloverDay(from);
    expect(next.toISOString().startsWith('2026-06-08')).toBe(true); // Segunda
  });
});

describe('getNextRolloverDay — virada de mês com fins de semana desabilitados', () => {
  beforeEach(() => {
    process.env.TIMEZONE = 'UTC';
    process.env.DISABLE_WEEKENDS = 'true';
  });

  it('sexta 2026-05-29 → segunda 2026-06-01', () => {
    const from = makeDate(2026, 5, 29); // Sexta (29/Mai/2026)
    const next = getNextRolloverDay(from);
    expect(next.toISOString().startsWith('2026-06-01')).toBe(true); // Segunda
  });
});

// ─── shouldSkipRolloverToday ─────────────────────────────────────────────────

describe('shouldSkipRolloverToday', () => {
  afterEach(() => {
    vi.useRealTimers();
    delete process.env.DISABLE_WEEKENDS;
  });

  it('retorna false quando fins de semana são habilitados, mesmo no sábado', () => {
    process.env.TIMEZONE = 'UTC';
    process.env.DISABLE_WEEKENDS = 'false';
    // Mock: simula que hoje é sábado (2026-06-06)
    vi.setSystemTime(new Date('2026-06-06T12:00:00Z'));
    expect(shouldSkipRolloverToday()).toBe(false);
    vi.useRealTimers();
  });

  it('retorna true quando fins de semana são desabilitados e hoje é sábado', () => {
    process.env.TIMEZONE = 'UTC';
    process.env.DISABLE_WEEKENDS = 'true';
    vi.setSystemTime(new Date('2026-06-06T12:00:00Z')); // Sábado
    expect(shouldSkipRolloverToday()).toBe(true);
    vi.useRealTimers();
  });

  it('retorna true quando fins de semana são desabilitados e hoje é domingo', () => {
    process.env.TIMEZONE = 'UTC';
    process.env.DISABLE_WEEKENDS = 'true';
    vi.setSystemTime(new Date('2026-06-07T12:00:00Z')); // Domingo
    expect(shouldSkipRolloverToday()).toBe(true);
    vi.useRealTimers();
  });

  it('retorna false quando fins de semana são desabilitados e hoje é segunda', () => {
    process.env.TIMEZONE = 'UTC';
    process.env.DISABLE_WEEKENDS = 'true';
    vi.setSystemTime(new Date('2026-06-08T12:00:00Z')); // Segunda
    expect(shouldSkipRolloverToday()).toBe(false);
    vi.useRealTimers();
  });
});

// ─── getTodayInConfiguredTz + getYesterdayInConfiguredTz ────────────────────

describe('getTodayInConfiguredTz', () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it('retorna uma data com horas zeradas (meia-noite UTC)', () => {
    process.env.TIMEZONE = 'UTC';
    vi.setSystemTime(new Date('2026-06-01T15:30:00Z'));
    const today = getTodayInConfiguredTz();
    expect(today.getUTCHours()).toBe(0);
    expect(today.getUTCMinutes()).toBe(0);
    expect(today.getUTCSeconds()).toBe(0);
    vi.useRealTimers();
  });

  it('no timezone UTC, 2026-06-01T15:30Z → hoje é 2026-06-01', () => {
    process.env.TIMEZONE = 'UTC';
    vi.setSystemTime(new Date('2026-06-01T15:30:00Z'));
    const today = getTodayInConfiguredTz();
    expect(today.toISOString().startsWith('2026-06-01')).toBe(true);
    vi.useRealTimers();
  });
});

describe('getYesterdayInConfiguredTz', () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it('retorna o dia anterior ao de hoje', () => {
    process.env.TIMEZONE = 'UTC';
    vi.setSystemTime(new Date('2026-06-05T10:00:00Z'));
    const yesterday = getYesterdayInConfiguredTz();
    expect(yesterday.toISOString().startsWith('2026-06-04')).toBe(true);
    vi.useRealTimers();
  });

  it('virada de mês: hoje é 2026-06-01 → ontem é 2026-05-31', () => {
    process.env.TIMEZONE = 'UTC';
    vi.setSystemTime(new Date('2026-06-01T10:00:00Z'));
    const yesterday = getYesterdayInConfiguredTz();
    expect(yesterday.toISOString().startsWith('2026-05-31')).toBe(true);
    vi.useRealTimers();
  });
});

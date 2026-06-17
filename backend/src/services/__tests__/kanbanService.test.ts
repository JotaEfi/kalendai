/**
 * kanbanService.test.ts — Testes unitários do processDailyRollover
 *
 * Estratégia de mock:
 * - Prisma é mockado via vi.mock() com factory inline (evita hoisting issue)
 * - aiService também é mockado para evitar chamadas de rede
 * - vi.setSystemTime() controla a data "atual" durante os testes
 */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';

// ─── Mock do Prisma com factory inline ──────────────────────────────────────
// vi.mock é hoisted (elevado) ao topo do arquivo pelo Vitest.
// Por isso, não podemos referenciar variáveis declaradas aqui dentro.
// A solução é usar vi.hoisted() para criar os mocks antes do hoisting.

const { mockFindMany, mockCreate, mockUpdate, mockCardImageCreate, mockTransaction, mockDailyReportFindMany } = vi.hoisted(() => {
  const mockFindMany = vi.fn();
  const mockCreate = vi.fn();
  const mockUpdate = vi.fn();
  const mockCardImageCreate = vi.fn();
  const mockTransaction = vi.fn();
  const mockDailyReportFindMany = vi.fn();
  return { mockFindMany, mockCreate, mockUpdate, mockCardImageCreate, mockTransaction, mockDailyReportFindMany };
});

vi.mock('../../lib/prisma.js', () => ({
  prisma: {
    kanbanCard: {
      findMany: mockFindMany,
      create: mockCreate,
      update: mockUpdate,
    },
    cardImage: {
      create: mockCardImageCreate,
    },
    dailyReport: {
      findMany: mockDailyReportFindMany,
    },
    $transaction: mockTransaction,
  }
}));

vi.mock('../aiService.js', () => ({
  generateReport: vi.fn().mockResolvedValue('Relatório de teste IA'),
  generateReportFallback: vi.fn().mockReturnValue('Relatório fallback local'),
  generateEmbedding: vi.fn().mockResolvedValue([]),
}));

vi.mock('../minioService.js', () => ({
  getPresignedUrl: vi.fn().mockResolvedValue('https://minio.test/img.png'),
}));

// Importar APÓS os mocks
import { processDailyRollover, getNextReportVersion } from '../kanbanService.js';

// ─── Helpers ────────────────────────────────────────────────────────────────

function makeDate(year: number, month: number, day: number): Date {
  return new Date(Date.UTC(year, month - 1, day, 0, 0, 0, 0));
}

function makeCard(overrides: Partial<any> = {}) {
  return {
    id: `card-${Math.random().toString(36).slice(2)}`,
    title: 'Tarefa de Teste',
    description: 'Descrição da tarefa',
    color: '#ffffff',
    status: 'OPEN',
    userId: 'user-123',
    dayDate: makeDate(2026, 6, 2),
    isSnapshot: false,
    isRolledOver: false,
    originalDayDate: null,
    createdAt: new Date(),
    completedAt: null,
    order: 0,
    images: [],
    ...overrides,
  };
}

// ─── Suite Principal ─────────────────────────────────────────────────────────

describe('processDailyRollover', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    process.env.TIMEZONE = 'UTC';
    process.env.DISABLE_WEEKENDS = 'false';

    // Transação executa as operações em sequência sem banco real
    mockTransaction.mockImplementation(async (ops: any[]) => {
      await Promise.all(ops);
      return [];
    });
  });

  afterEach(() => {
    vi.useRealTimers();
    delete process.env.DISABLE_WEEKENDS;
  });

  // ─── Sem cards ativos ────────────────────────────────────────────────────

  it('retorna { rolledOver: [] } quando não há cards ativos hoje', async () => {
    vi.setSystemTime(new Date('2026-06-02T12:00:00Z')); // Terça
    mockFindMany.mockResolvedValue([]);

    const result = await processDailyRollover();

    expect(result.rolledOver).toHaveLength(0);
    expect(mockTransaction).not.toHaveBeenCalled();
  });

  // ─── Cards OPEN movidos ──────────────────────────────────────────────────

  it('move um card OPEN para o dia seguinte', async () => {
    vi.setSystemTime(new Date('2026-06-02T12:00:00Z')); // Hoje = Terça

    const card = makeCard({ status: 'OPEN', dayDate: makeDate(2026, 6, 2) });
    mockFindMany.mockResolvedValue([card]);
    mockCreate.mockResolvedValue({ ...card, id: 'snapshot-id' });
    mockUpdate.mockResolvedValue({ ...card, dayDate: makeDate(2026, 6, 3) });

    const result = await processDailyRollover();

    expect(result.rolledOver).toHaveLength(1);
    expect(mockTransaction).toHaveBeenCalledTimes(1);
  });

  it('move um card IN_PROGRESS para o dia seguinte', async () => {
    vi.setSystemTime(new Date('2026-06-02T12:00:00Z'));

    const card = makeCard({ status: 'IN_PROGRESS' });
    mockFindMany.mockResolvedValue([card]);
    mockCreate.mockResolvedValue({ ...card, id: 'snapshot-id' });
    mockUpdate.mockResolvedValue({});

    const result = await processDailyRollover();

    expect(result.rolledOver).toHaveLength(1);
    expect(mockTransaction).toHaveBeenCalled();
  });

  // ─── Filtro de status correto ─────────────────────────────────────────────

  it('a query usa filtro { status: in [OPEN, IN_PROGRESS], isSnapshot: false }', async () => {
    vi.setSystemTime(new Date('2026-06-02T12:00:00Z'));
    mockFindMany.mockResolvedValue([]);

    await processDailyRollover();

    expect(mockFindMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          status: { in: ['OPEN', 'IN_PROGRESS'] },
          isSnapshot: false
        })
      })
    );
  });

  // ─── Múltiplos cards em uma transação ─────────────────────────────────────

  it('processa múltiplos cards em uma única transação', async () => {
    vi.setSystemTime(new Date('2026-06-02T12:00:00Z'));

    const cards = [
      makeCard({ id: 'c1', status: 'OPEN' }),
      makeCard({ id: 'c2', status: 'IN_PROGRESS' }),
      makeCard({ id: 'c3', status: 'OPEN' }),
    ];
    mockFindMany.mockResolvedValue(cards);
    mockCreate.mockResolvedValue({});
    mockUpdate.mockResolvedValue({});

    const result = await processDailyRollover();

    expect(result.rolledOver).toHaveLength(3);
    expect(mockTransaction).toHaveBeenCalledTimes(1);
  });

  // ─── Card com imagens duplica imagens no snapshot ─────────────────────────

  it('cria entradas de imagem para o snapshot quando card tem imagens', async () => {
    vi.setSystemTime(new Date('2026-06-02T12:00:00Z'));

    const card = makeCard({
      status: 'OPEN',
      images: [
        { id: 'img-1', cardId: 'c1', objectKey: 'test.jpg', bucket: 'bucket', mimeType: 'image/jpeg' }
      ]
    });
    mockFindMany.mockResolvedValue([card]);
    mockCreate.mockResolvedValue({ ...card, id: 'snapshot-id' });
    mockUpdate.mockResolvedValue({});
    mockCardImageCreate.mockResolvedValue({});

    await processDailyRollover();

    // Transação: [createSnapshot, cardImageCreate, updateOriginal] = 3 ops
    const txArgs = mockTransaction.mock.calls[0][0];
    expect(txArgs).toHaveLength(3);
  });

  // ─── SEXTA → SEGUNDA (DISABLE_WEEKENDS=true) ─────────────────────────────

  it('SEXTA → SEGUNDA quando DISABLE_WEEKENDS=true', async () => {
    process.env.DISABLE_WEEKENDS = 'true';
    // Hoje é sexta 2026-06-05
    vi.setSystemTime(new Date('2026-06-05T12:00:00Z'));

    const card = makeCard({ status: 'OPEN', dayDate: makeDate(2026, 6, 5) });
    mockFindMany.mockResolvedValue([card]);
    mockCreate.mockResolvedValue({});

    // Capturar o que foi passado para o update
    let capturedUpdateData: any = null;
    mockUpdate.mockImplementation(async (args: any) => {
      capturedUpdateData = args;
      return {};
    });

    const result = await processDailyRollover();

    expect(result.rolledOver).toHaveLength(1);
    // O dayDate de destino deve ser segunda 2026-06-08
    expect(capturedUpdateData?.data?.dayDate?.toISOString()).toContain('2026-06-08');
  });

  // ─── Rollover pulado no sábado (DISABLE_WEEKENDS=true) ───────────────────

  it('pula o rollover quando DISABLE_WEEKENDS=true e hoje é sábado', async () => {
    process.env.DISABLE_WEEKENDS = 'true';
    vi.setSystemTime(new Date('2026-06-06T12:00:00Z')); // Sábado

    const result = await processDailyRollover();

    expect(result.rolledOver).toHaveLength(0);
    expect(mockFindMany).not.toHaveBeenCalled();
  });

  it('pula o rollover quando DISABLE_WEEKENDS=true e hoje é domingo', async () => {
    process.env.DISABLE_WEEKENDS = 'true';
    vi.setSystemTime(new Date('2026-06-07T12:00:00Z')); // Domingo

    const result = await processDailyRollover();

    expect(result.rolledOver).toHaveLength(0);
    expect(mockFindMany).not.toHaveBeenCalled();
  });

  it('NÃO pula o rollover na segunda quando DISABLE_WEEKENDS=true', async () => {
    process.env.DISABLE_WEEKENDS = 'true';
    vi.setSystemTime(new Date('2026-06-08T12:00:00Z')); // Segunda
    mockFindMany.mockResolvedValue([]);

    await processDailyRollover();

    expect(mockFindMany).toHaveBeenCalled();
  });

  // ─── Erro durante a transação ─────────────────────────────────────────────

  it('retorna { rolledOver: [] } se a transação falhar (não lança exceção)', async () => {
    vi.setSystemTime(new Date('2026-06-02T12:00:00Z'));

    const card = makeCard({ status: 'OPEN' });
    mockFindMany.mockResolvedValue([card]);
    mockTransaction.mockRejectedValue(new Error('DB connection failed'));

    const result = await processDailyRollover();

    expect(result.rolledOver).toHaveLength(0);
  });

  // ─── originalDayDate preservado ──────────────────────────────────────────

  it('preserva o originalDayDate quando card já foi rolado antes', async () => {
    vi.setSystemTime(new Date('2026-06-03T12:00:00Z')); // Quarta

    const originalDate = makeDate(2026, 5, 31); // Card veio de domingo 31/Mai
    const card = makeCard({
      status: 'OPEN',
      dayDate: makeDate(2026, 6, 3),
      isRolledOver: true,
      originalDayDate: originalDate
    });

    mockFindMany.mockResolvedValue([card]);
    mockCreate.mockResolvedValue({});

    let capturedUpdateData: any = null;
    mockUpdate.mockImplementation(async (args: any) => {
      capturedUpdateData = args;
      return {};
    });

    await processDailyRollover();

    expect(capturedUpdateData?.data?.originalDayDate).toEqual(originalDate);
    expect(capturedUpdateData?.data?.isRolledOver).toBe(true);
  });

  // ─── isRolledOver marcado como true após rollover ─────────────────────────

  it('marca isRolledOver=true no card original após o rollover', async () => {
    vi.setSystemTime(new Date('2026-06-02T12:00:00Z'));

    const card = makeCard({ status: 'OPEN', isRolledOver: false });
    mockFindMany.mockResolvedValue([card]);
    mockCreate.mockResolvedValue({});

    let capturedUpdateData: any = null;
    mockUpdate.mockImplementation(async (args: any) => {
      capturedUpdateData = args;
      return {};
    });

    await processDailyRollover();

    expect(capturedUpdateData?.data?.isRolledOver).toBe(true);
  });
});

// ─── Testes do getNextReportVersion (Limitações solicitadas) ─────────────────
describe('getNextReportVersion', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    process.env.TIMEZONE = 'UTC';
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('bloqueia completamente datas futuras (retorna nextVersion: null)', async () => {
    vi.setSystemTime(new Date('2026-06-01T12:00:00Z')); // Hoje = 1 de Junho
    mockDailyReportFindMany.mockResolvedValue([]); // sem relatórios existentes

    // Data futura = 2 de Junho
    const result = await getNextReportVersion('user-123', makeDate(2026, 6, 2));

    expect(result.nextVersion).toBeNull();
  });

  it('hoje: permite V1 quando não há relatórios gerados', async () => {
    vi.setSystemTime(new Date('2026-06-01T12:00:00Z')); // Hoje = 1 de Junho
    mockDailyReportFindMany.mockResolvedValue([]);

    const result = await getNextReportVersion('user-123', makeDate(2026, 6, 1));

    expect(result.count).toBe(0);
    expect(result.nextVersion).toBe(1);
  });

  it('hoje: permite V2 quando já há 1 relatório gerado', async () => {
    vi.setSystemTime(new Date('2026-06-01T12:00:00Z')); // Hoje = 1 de Junho
    mockDailyReportFindMany.mockResolvedValue([{ version: 1 }]);

    const result = await getNextReportVersion('user-123', makeDate(2026, 6, 1));

    expect(result.count).toBe(1);
    expect(result.nextVersion).toBe(2);
  });

  it('hoje: bloqueia (retorna null) quando já há 2 relatórios gerados', async () => {
    vi.setSystemTime(new Date('2026-06-01T12:00:00Z')); // Hoje = 1 de Junho
    mockDailyReportFindMany.mockResolvedValue([{ version: 1 }, { version: 2 }]);

    const result = await getNextReportVersion('user-123', makeDate(2026, 6, 1));

    expect(result.count).toBe(2);
    expect(result.nextVersion).toBeNull();
  });

  it('passado: permite V1 quando não há relatórios gerados', async () => {
    vi.setSystemTime(new Date('2026-06-02T12:00:00Z')); // Hoje = 2 de Junho
    mockDailyReportFindMany.mockResolvedValue([]);

    // Passado = 1 de Junho
    const result = await getNextReportVersion('user-123', makeDate(2026, 6, 1));

    expect(result.count).toBe(0);
    expect(result.nextVersion).toBe(1);
  });

  it('passado: bloqueia (retorna null) quando já há 1 relatório gerado (limite de 1 para o passado)', async () => {
    vi.setSystemTime(new Date('2026-06-02T12:00:00Z')); // Hoje = 2 de Junho
    mockDailyReportFindMany.mockResolvedValue([{ version: 1 }]);

    // Passado = 1 de Junho
    const result = await getNextReportVersion('user-123', makeDate(2026, 6, 1));

    expect(result.count).toBe(1);
    expect(result.nextVersion).toBeNull();
  });
});

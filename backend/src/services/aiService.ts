/**
 * aiService.ts — Serviço de geração de relatórios com IA
 *
 * Correções aplicadas:
 * 1. Env vars lidas lazily (dentro das funções, não no import)
 *    — evita problema de .env não carregado no momento do import
 * 2. Logs detalhados com o erro completo da API
 * 3. Timeout via AbortController (30s)
 * 4. generateReportFallback() para quando a IA está indisponível
 */
import { generateDailyReport } from './aiProvider.js';
import fetch from 'node-fetch';
import { GoogleGenAI } from '@google/genai';

const AI_TIMEOUT_MS = 30000; // 30 segundos

// ─── Helpers de configuração (lazy — lidas a cada chamada) ──────────────────

function getAIConfig() {
  const provider = process.env.AI_PROVIDER || 'deepseek';
  const apiKey = process.env.AI_API_KEY || '';
  const model = process.env.AI_MODEL || (provider === 'gemini' ? 'gemini-2.5-flash' : 'deepseek-chat');
  let baseUrl = process.env.AI_BASE_URL || 'https://api.deepseek.com';

  // Corrige typo comum no domínio
  if (baseUrl === 'https://api.deepseek.co') {
    baseUrl = 'https://api.deepseek.com';
  }

  return { provider, apiKey, model, baseUrl };
}

// ─── Geração de Relatório ────────────────────────────────────────────────────

/**
 * Gera um relatório diário com IA a partir de um payload de tarefas.
 * Lança exceção se falhar — o chamador deve usar generateReportFallback().
 */
export async function generateReport(payload: any): Promise<string> {
  const { provider, apiKey, model, baseUrl } = getAIConfig();

  if (!apiKey) {
    throw new Error(
      `[aiService] AI_API_KEY não configurado no .env. Provider: ${provider}. ` +
      `Configure AI_API_KEY=sua_chave_aqui no arquivo .env do backend.`
    );
  }

  const keyPrefix = apiKey.substring(0, 8) + '...';
  console.log(`[aiService] Gerando relatório com ${provider} (model: ${model}, key: ${keyPrefix})`);

  const systemPrompt = `Você é o assistente automático KalendAI. Escreva um relatório diário direto, objetivo e profissional em português brasileiro a partir do JSON de tarefas fornecido.
O relatório deve conter:
- Resumo do dia: Total de tarefas criadas, concluídas e pendentes.
- Detalhamento de tarefas concluídas: Título, breve descrição (se houver), tempo gasto formatado (ex: "XhYm") e se há imagens associadas.
- Tarefas em aberto ou progresso: Apenas uma listagem direta com os títulos.
- Se houver "tarefas_transportadas_para_amanha", mencione explicitamente: "X tarefa(s) não foram resolvidas hoje e foram transportadas para o próximo dia útil: [lista de títulos]."
Seja conciso, evite floreios, introduções longas, críticas ou sugestões de melhoria. Escreva em formato de texto estruturado.`;

  const promptContent = `${systemPrompt}\n\nJSON de Tarefas:\n${JSON.stringify(payload)}`;

  // Timeout via AbortController (não é passado ao fetch aqui — é controlado no aiProvider)
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), AI_TIMEOUT_MS);

  try {
    const result = await generateDailyReport(promptContent, {
      apiKey,
      provider,
      model,
      baseUrl
    });
    clearTimeout(timeoutId);

    if (!result || result.trim().length === 0) {
      throw new Error(`[aiService] IA retornou resposta vazia. Provider: ${provider}, Model: ${model}`);
    }

    console.log(`[aiService] Relatório gerado com sucesso (${result.length} chars)`);
    return result;
  } catch (error: any) {
    clearTimeout(timeoutId);

    const isTimeout = error.name === 'AbortError' || error.message?.includes('abort') || error.message?.includes('timed out');
    const isEmptyResponse = error.message?.includes('resposta vazia');

    let errMsg: string;
    if (isTimeout) {
      errMsg = `[aiService] Timeout (${AI_TIMEOUT_MS / 1000}s) — API de IA não respondeu a tempo. Provider: ${provider}, Model: ${model}`;
    } else if (isEmptyResponse) {
      errMsg = error.message;
    } else {
      errMsg = `[aiService] Falha na API de IA — Provider: ${provider}, Model: ${model}, Status: ${error.status || 'N/A'}, Erro: ${error.message}`;
    }

    console.error(errMsg);
    throw new Error(errMsg);
  }
}

// ─── Fallback Local ──────────────────────────────────────────────────────────

/**
 * Gera um relatório formatado em texto puro sem chamar a IA.
 * Usado quando a IA está indisponível ou falha.
 */
export function generateReportFallback(payload: any): string {
  const date = payload.data || new Date().toISOString().split('T')[0];
  const totalCriadas = payload.total_criadas || 0;
  const totalConcluidas = payload.total_concluidas || 0;
  const abertas = payload.tarefas_em_aberto || [];
  const progresso = payload.tarefas_em_progresso || [];
  const concluidas = payload.tarefas_concluidas || [];
  const transportadas = payload.tarefas_transportadas_para_amanha || [];
  const versao = payload.versao || 1;

  let report = `📋 RELATÓRIO DIÁRIO — ${date} (V${versao} — Gerado Localmente)\n`;
  report += `═══════════════════════════════════════\n\n`;
  report += `📊 RESUMO DO DIA\n`;
  report += `• Total de tarefas: ${totalCriadas}\n`;
  report += `• Concluídas: ${totalConcluidas}\n`;
  report += `• Pendentes: ${abertas.length + progresso.length}\n\n`;

  if (concluidas.length > 0) {
    report += `✅ TAREFAS CONCLUÍDAS\n`;
    concluidas.forEach((t: any) => {
      const horas = t.duracao_minutos
        ? `${Math.floor(t.duracao_minutos / 60)}h${t.duracao_minutos % 60}m`
        : 'N/D';
      report += `• ${t.titulo}${t.descricao ? ` — ${t.descricao}` : ''} (${horas})\n`;
    });
    report += '\n';
  }

  if (abertas.length > 0) {
    report += `🔓 TAREFAS EM ABERTO\n`;
    abertas.forEach((t: string) => { report += `• ${t}\n`; });
    report += '\n';
  }

  if (progresso.length > 0) {
    report += `⏳ EM PROGRESSO\n`;
    progresso.forEach((t: string) => { report += `• ${t}\n`; });
    report += '\n';
  }

  if (transportadas.length > 0) {
    report += `🔄 TRANSPORTADAS PARA O PRÓXIMO DIA ÚTIL\n`;
    report += `${transportadas.length} tarefa(s) não foram resolvidas hoje:\n`;
    transportadas.forEach((t: string) => { report += `• ${t}\n`; });
    report += '\n';
  }

  report += `───────────────────────────────────────\n`;
  report += `ℹ️ Relatório gerado automaticamente (sem IA).`;

  return report;
}

// ─── Diagnóstico de Status da IA ────────────────────────────────────────────

/**
 * Testa a conexão com a IA e retorna um resumo do status.
 * Usado pelo endpoint GET /api/reports/ai-status.
 */
export async function checkAIStatus(): Promise<{
  provider: string;
  model: string;
  baseUrl: string;
  keyPresent: boolean;
  keyPrefix: string;
  testResult: 'ok' | 'error' | 'no_key';
  errorDetail?: string;
}> {
  const { provider, apiKey, model, baseUrl } = getAIConfig();

  const baseStatus = {
    provider,
    model,
    baseUrl,
    keyPresent: !!apiKey,
    keyPrefix: apiKey ? `${apiKey.substring(0, 8)}...` : '(não configurada)'
  };

  if (!apiKey) {
    return { ...baseStatus, testResult: 'no_key' };
  }

  try {
    const testPayload = {
      data: new Date().toISOString().split('T')[0],
      versao: 'test',
      total_criadas: 1,
      total_concluidas: 1,
      tarefas_concluidas: [{ titulo: 'Teste de conectividade', duracao_minutos: 1 }],
      tarefas_em_aberto: [],
      tarefas_em_progresso: []
    };

    await generateReport(testPayload);
    return { ...baseStatus, testResult: 'ok' };
  } catch (err: any) {
    return { ...baseStatus, testResult: 'error', errorDetail: err.message };
  }
}

// ─── Embeddings ──────────────────────────────────────────────────────────────

/**
 * Gera vetor de embedding para busca semântica.
 * Retorna array vazio silenciosamente em caso de falha (não crítico).
 */
export async function generateEmbedding(text: string): Promise<number[]> {
  const { provider, apiKey, model, baseUrl } = getAIConfig();

  if (!apiKey) {
    console.warn('[aiService] AI_API_KEY não configurado. Embedding ignorado.');
    return [];
  }

  try {
    if (provider === 'gemini') {
      const ai = new GoogleGenAI({ apiKey });
      const response: any = await ai.models.embedContent({
        model: 'text-embedding-004',
        contents: text,
      });
      if (response.embedding?.values) return response.embedding.values;
      if (response.embeddings?.[0]?.values) return response.embeddings[0].values;
      return [];
    }

    if (provider === 'deepseek' || provider === 'openai') {
      const embeddingUrl = baseUrl.endsWith('/embeddings')
        ? baseUrl
        : `${baseUrl}/embeddings`;

      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), AI_TIMEOUT_MS);

      try {
        const response = await fetch(embeddingUrl, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${apiKey}`
          },
          body: JSON.stringify({
            model: provider === 'deepseek' ? 'deepseek-embed' : 'text-embedding-3-small',
            input: text
          }),
          signal: controller.signal as any
        });
        clearTimeout(timeoutId);

        if (!response.ok) {
          const errText = await response.text();
          console.warn(`[aiService] Embedding retornou ${response.status}: ${errText}`);
          return [];
        }

        const data = await response.json() as any;
        return data.data?.[0]?.embedding || [];
      } catch (fetchErr: any) {
        clearTimeout(timeoutId);
        console.warn(`[aiService] Embedding fetch falhou: ${fetchErr.message}`);
        return [];
      }
    }
  } catch (error: any) {
    console.warn(`[aiService] Erro ao gerar embedding: ${error.message}`);
  }
  return [];
}

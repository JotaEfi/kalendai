import { generateDailyReport } from './aiProvider.js';
import fetch from 'node-fetch';
import { GoogleGenAI } from '@google/genai';

const AI_PROVIDER = process.env.AI_PROVIDER || 'deepseek';
const AI_MODEL = process.env.AI_MODEL || 'deepseek-chat';
const AI_API_KEY = process.env.AI_API_KEY || '';
const ENV_AI_BASE_URL = process.env.AI_BASE_URL || 'https://api.deepseek.com';
const AI_BASE_URL = ENV_AI_BASE_URL === 'https://api.deepseek.co' ? 'https://api.deepseek.com' : ENV_AI_BASE_URL;

const AI_TIMEOUT_MS = 30000; // 30 seconds timeout

/**
 * Generates a clean, direct daily report from structured task data.
 * Adheres to strict token optimization rules.
 * Throws on failure so the caller can use generateReportFallback().
 */
export async function generateReport(payload: any): Promise<string> {
  if (!AI_API_KEY) {
    throw new Error(`AI_API_KEY não configurado. Provider: ${AI_PROVIDER}. Configure a variável AI_API_KEY no .env.`);
  }

  const shortSystemPrompt = `Você é o assistente automático KalendAI. Escreva um relatório diário direto, objetivo e profissional em português brasileiro a partir do JSON de tarefas fornecido.
O relatório deve conter:
- Resumo do dia: Total de tarefas criadas, concluídas e pendentes.
- Detalhamento de tarefas concluídas: Título, breve descrição (se houver), tempo gasto formatado (ex: "XhYm") e se há imagens associadas.
- Tarefas em aberto ou progresso: Apenas uma listagem direta com os títulos.
- Se houver "tarefas_transportadas_para_amanha", mencione explicitamente: "X tarefa(s) não foram resolvidas hoje e foram transportadas para amanhã: [lista de títulos]."
Seja conciso, evite floreios, introduções longas, críticas ou sugestões de melhoria. Escreva em formato de texto estruturado.`;

  const promptContent = `${shortSystemPrompt}\n\nJSON de Tarefas:\n${JSON.stringify(payload)}`;

  // Create abort controller for timeout
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), AI_TIMEOUT_MS);

  try {
    const result = await generateDailyReport(promptContent, {
      apiKey: AI_API_KEY,
      provider: AI_PROVIDER,
      model: AI_MODEL,
      baseUrl: AI_BASE_URL
    });
    clearTimeout(timeoutId);
    return result;
  } catch (error: any) {
    clearTimeout(timeoutId);
    const isTimeout = error.name === 'AbortError' || error.message?.includes('abort');
    const errMsg = isTimeout
      ? `Timeout de ${AI_TIMEOUT_MS / 1000}s ao chamar a API de IA (provider: ${AI_PROVIDER}, model: ${AI_MODEL})`
      : `Falha na API de IA — provider: ${AI_PROVIDER}, model: ${AI_MODEL}, status: ${error.status || 'N/A'}, mensagem: ${error.message}`;
    
    console.error('[aiService] generateReport error:', errMsg);
    throw new Error(errMsg);
  }
}

/**
 * Generates a plain-text fallback report without AI.
 * Used when the AI API is unavailable or times out.
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
      const horas = t.duracao_minutos ? `${Math.floor(t.duracao_minutos / 60)}h${t.duracao_minutos % 60}m` : 'N/D';
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
    report += `🔄 TRANSPORTADAS PARA AMANHÃ\n`;
    report += `${transportadas.length} tarefa(s) não foram resolvidas hoje e foram automaticamente transportadas para amanhã:\n`;
    transportadas.forEach((t: string) => { report += `• ${t}\n`; });
    report += '\n';
  }

  report += `───────────────────────────────────────\n`;
  report += `⚠️ Nota: Este relatório foi gerado localmente pois o serviço de IA estava indisponível no momento.`;

  return report;
}

/**
 * Generates embeddings vector for semantic search.
 * Returns empty array silently on failure (non-critical).
 */
export async function generateEmbedding(text: string): Promise<number[]> {
  if (!AI_API_KEY) {
    console.warn("[aiService] AI_API_KEY não configurado. Embedding ignorado.");
    return [];
  }

  try {
    if (AI_PROVIDER === 'gemini') {
      const ai = new GoogleGenAI({ apiKey: AI_API_KEY });
      const response: any = await ai.models.embedContent({
        model: 'text-embedding-004',
        contents: text,
      });
      if (response.embedding?.values) {
        return response.embedding.values;
      }
      if (response.embeddings?.[0]?.values) {
        return response.embeddings[0].values;
      }
      return [];
    }

    if (AI_PROVIDER === 'deepseek' || AI_PROVIDER === 'openai') {
      const activeBaseUrl = AI_BASE_URL;
      const embeddingUrl = activeBaseUrl.endsWith('/embeddings') 
        ? activeBaseUrl 
        : `${activeBaseUrl}/embeddings`;

      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), AI_TIMEOUT_MS);

      try {
        const response = await fetch(embeddingUrl, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${AI_API_KEY}`
          },
          body: JSON.stringify({
            model: AI_PROVIDER === 'deepseek' ? 'deepseek-embed' : 'text-embedding-3-small',
            input: text
          }),
          signal: controller.signal as any
        });
        clearTimeout(timeoutId);

        if (!response.ok) {
          const errText = await response.text();
          console.warn(`[aiService] Embedding API retornou status ${response.status}: ${errText}`);
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

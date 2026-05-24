import { generateDailyReport } from './aiProvider.js';
import fetch from 'node-fetch';
import { GoogleGenAI } from '@google/genai';

const AI_PROVIDER = process.env.AI_PROVIDER || 'deepseek';
const AI_MODEL = process.env.AI_MODEL || 'deepseek-chat';
const AI_API_KEY = process.env.AI_API_KEY || '';
const ENV_AI_BASE_URL = process.env.AI_BASE_URL || 'https://api.deepseek.com';
const AI_BASE_URL = ENV_AI_BASE_URL === 'https://api.deepseek.co' ? 'https://api.deepseek.com' : ENV_AI_BASE_URL;

/**
 * Generates a clean, direct daily report from structured task data.
 * Adheres to strict token optimization rules.
 */
export async function generateReport(payload: any): Promise<string> {
  const shortSystemPrompt = `Você é o assistente automático KalendAI. Escreva um relatório diário direto, objetivo e profissional em português brasileiro a partir do JSON de tarefas fornecido.
O relatório deve conter:
- Resumo do dia: Total de tarefas criadas, concluídas e pendentes.
- Detalhamento de tarefas concluídas: Título, breve descrição (se houver), tempo gasto formatado (ex: "XhYm") e se há imagens associadas.
- Tarefas em aberto ou progresso: Apenas uma listagem direta com os títulos.
Seja conciso, evite floreios, introduções longas, críticas ou sugestões de melhoria. Escreva em formato de texto estruturado.`;

  const promptContent = `${shortSystemPrompt}\n\nJSON de Tarefas:\n${JSON.stringify(payload)}`;

  try {
    return await generateDailyReport(promptContent, {
      apiKey: AI_API_KEY,
      provider: AI_PROVIDER,
      model: AI_MODEL,
      baseUrl: AI_BASE_URL
    });
  } catch (error: any) {
    console.error('Error generating report with AI provider:', error.message);
    throw new Error(`Falha ao gerar relatório com a IA: ${error.message}`);
  }
}

/**
 * Generates embeddings vector for semantic search.
 */
export async function generateEmbedding(text: string): Promise<number[]> {
  if (!AI_API_KEY) {
    console.warn("AI_API_KEY is not configured. Returning empty embedding.");
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

      const response = await fetch(embeddingUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${AI_API_KEY}`
        },
        body: JSON.stringify({
          model: AI_PROVIDER === 'deepseek' ? 'deepseek-embed' : 'text-embedding-3-small',
          input: text
        })
      });

      if (!response.ok) {
        const errText = await response.text();
        console.warn(`Embedding API returned non-200 status (${response.status}): ${errText}`);
        return [];
      }

      const data = await response.json() as any;
      return data.data?.[0]?.embedding || [];
    }
  } catch (error: any) {
    console.error('Error generating embedding:', error.message);
  }
  return [];
}

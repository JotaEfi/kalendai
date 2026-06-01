import fetch from 'node-fetch';
import { GoogleGenAI } from '@google/genai';

export async function generateDailyReport(
  prompt: string,
  config: { apiKey: string; provider: string; model: string; baseUrl?: string }
): Promise<string> {
  const { apiKey, provider, model, baseUrl } = config;

  // ─── Gemini ──────────────────────────────────────────────────────────────
  if (provider === 'gemini') {
    const ai = new GoogleGenAI({ apiKey });
    const response = await ai.models.generateContent({
      model: model || 'gemini-2.5-flash',
      contents: prompt,
    });

    // O SDK do Gemini pode retornar .text como getter (função) ou string
    // dependendo da versão do pacote @google/genai. Tratamos ambos os casos.
    let text: string;
    if (typeof response.text === 'function') {
      text = (response.text as () => string)();
    } else {
      text = (response as any).text ?? '';
    }

    // Fallback para candidates se .text não disponível
    if (!text) {
      const candidates = (response as any).candidates;
      if (candidates?.[0]?.content?.parts?.[0]?.text) {
        text = candidates[0].content.parts[0].text;
      }
    }

    if (!text || text.trim().length === 0) {
      throw new Error(`Gemini retornou resposta vazia. Model: ${model}`);
    }

    return text;
  }

  // ─── DeepSeek / OpenAI (compatível com API OpenAI) ──────────────────────
  if (provider === 'deepseek' || provider === 'openai') {
    let activeBaseUrl = baseUrl;

    // Corrige typo comum
    if (activeBaseUrl === 'https://api.deepseek.co') {
      activeBaseUrl = 'https://api.deepseek.com';
    }

    const defaultUrl = provider === 'deepseek'
      ? 'https://api.deepseek.com/chat/completions'
      : 'https://api.openai.com/v1/chat/completions';

    const apiUrl = activeBaseUrl
      ? (activeBaseUrl.endsWith('/chat/completions')
          ? activeBaseUrl
          : `${activeBaseUrl}/chat/completions`)
      : defaultUrl;

    console.log(`[aiProvider] POST ${apiUrl} (${provider}, model: ${model})`);

    const response = await fetch(apiUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`
      },
      body: JSON.stringify({
        model: model || (provider === 'deepseek' ? 'deepseek-chat' : 'gpt-4o'),
        messages: [{ role: 'user', content: prompt }],
        temperature: 0.7,
        max_tokens: 1500,
      })
    });

    if (!response.ok) {
      const errorBody = await response.text();
      throw new Error(
        `AI Provider Error (${provider}): HTTP ${response.status} ${response.statusText} — ${errorBody}`
      );
    }

    const data = await response.json() as any;
    const content = data.choices?.[0]?.message?.content ?? '';

    if (!content || content.trim().length === 0) {
      throw new Error(`${provider} retornou choices vazio. Resposta completa: ${JSON.stringify(data)}`);
    }

    return content;
  }

  throw new Error(`AI_PROVIDER desconhecido: "${provider}". Valores válidos: gemini, deepseek, openai`);
}

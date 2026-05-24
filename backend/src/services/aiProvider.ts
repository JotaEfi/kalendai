import fetch from 'node-fetch';
import { GoogleGenAI } from '@google/genai';

export async function generateDailyReport(prompt: string, config: { apiKey: string, provider: string, model: string, baseUrl?: string }): Promise<string> {
  const { apiKey, provider, model, baseUrl } = config;

  if (provider === 'gemini') {
    const ai = new GoogleGenAI({ apiKey });
    const response = await ai.models.generateContent({
      model: model || 'gemini-2.5-flash',
      contents: prompt,
    });
    return response.text || '';
  }
  
  let activeBaseUrl = baseUrl;
  if (provider === 'deepseek' || provider === 'openai') {
    if (activeBaseUrl === 'https://api.deepseek.co') {
      activeBaseUrl = 'https://api.deepseek.com';
    }
    const defaultUrl = provider === 'deepseek' ? 'https://api.deepseek.com/chat/completions' : 'https://api.openai.com/v1/chat/completions';
    const apiUrl = activeBaseUrl ? (activeBaseUrl.endsWith('/chat/completions') ? activeBaseUrl : `${activeBaseUrl}/chat/completions`) : defaultUrl;
    
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
      })
    });
    
    if (!response.ok) {
      const errorBody = await response.text();
      throw new Error(`AI Provider Error (${provider}): ${response.status} ${response.statusText} - ${errorBody}`);
    }
    
    const data = await response.json() as any;
    return data.choices?.[0]?.message?.content || '';
  }

  throw new Error(`Unknown AI_PROVIDER: ${provider}`);
}

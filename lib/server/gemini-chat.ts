import { setTimeout as delay } from 'node:timers/promises';

const RETRYABLE_STATUSES = new Set([408, 429, 500, 502, 503, 504]);
const ATTEMPT_TIMEOUT_MS = 10_000;

export async function generateChatResponse(
  apiKey: string,
  model: string,
  fallbackModel: string,
  payload: Record<string, unknown>,
) {
  // Retry a transient failure once, then use another model to avoid an overloaded model.
  const models = [model, model, fallbackModel];
  for (let attempt = 0; attempt < models.length; attempt += 1) {
    const currentModel = models[attempt];
    try {
      const response = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(currentModel)}:generateContent`,
        {
          method: 'POST',
          headers: {
            'content-type': 'application/json',
            'x-goog-api-key': apiKey,
          },
          signal: AbortSignal.timeout(ATTEMPT_TIMEOUT_MS),
          body: JSON.stringify(payload),
        },
      );
      if (
        response.ok ||
        !RETRYABLE_STATUSES.has(response.status) ||
        attempt === models.length - 1
      )
        return response;
      console.warn('Retrying Gemini chat request', {
        model: currentModel,
        status: response.status,
        attempt: attempt + 1,
      });
      await response.body?.cancel();
    } catch (error) {
      // Do not log the request URL, key, conversation, or provider response body.
      if (attempt === models.length - 1) throw error;
      console.warn('Retrying Gemini chat request after a network error', {
        model: currentModel,
        attempt: attempt + 1,
      });
    }
    await delay(1000 * 2 ** attempt + Math.floor(Math.random() * 250));
  }
  throw new Error('Gemini chat attempts exhausted');
}

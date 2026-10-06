import { getRuntimeEnv } from '@/lib/server/runtime';
import { venues } from '@/lib/demo-data';
import { generateChatResponse } from '@/lib/server/gemini-chat';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

type ChatMessage = { role: 'user' | 'assistant'; content: string };

const MAX_MESSAGES = 24;
const MAX_MESSAGE_LENGTH = 4000;
const MAX_TOTAL_MESSAGE_LENGTH = 16000;
const MAX_REQUEST_FIELD_LENGTH = 500;

const requestShape = `{
  "venueName": string | null,
  "postcode": string | null,
  "preferredDate": string | null,
  "startTime": string | null,
  "endTime": string | null,
  "contactName": string | null,
  "email": string | null,
  "phone": string | null,
  "message": string | null,
  "complete": boolean
}`;

export async function POST(request: Request) {
  const { GEMINI_API_KEY, GEMINI_MODEL, GEMINI_FALLBACK_MODEL } = getRuntimeEnv();
  if (!GEMINI_API_KEY) return Response.json({ error: 'chat_not_configured' }, { status: 503 });

  let body: { messages?: unknown; language?: unknown };
  try {
    body = await request.json() as { messages?: unknown; language?: unknown };
  } catch {
    return Response.json({ error: 'invalid_request' }, { status: 400 });
  }
  if (!body || typeof body !== 'object' || (body.language !== undefined && body.language !== 'en' && body.language !== 'zh')) {
    return Response.json({ error: 'invalid_request' }, { status: 400 });
  }

  const messages = Array.isArray(body.messages)
    ? body.messages.filter((item): item is ChatMessage => Boolean(item) && typeof item === 'object' &&
      ((item as ChatMessage).role === 'user' || (item as ChatMessage).role === 'assistant') &&
      typeof (item as ChatMessage).content === 'string' &&
      (item as ChatMessage).content.trim().length > 0).slice(-MAX_MESSAGES)
    : [];
  if (!messages.length || messages.some((item) => item.content.length > MAX_MESSAGE_LENGTH) ||
    messages.reduce((total, item) => total + item.content.length, 0) > MAX_TOTAL_MESSAGE_LENGTH) {
    return Response.json({ error: 'invalid_request' }, { status: 400 });
  }

  const venueContext = venues.map((venue) => `${venue.name} (${venue.nameZh}, ${venue.area})`).join('; ');
  const systemInstruction = [
    'You are the Tennis Social London booking assistant.',
    'Help the user request a tennis court/session. Be warm, concise, and ask one or two missing questions at a time.',
    body.language === 'zh'
      ? 'Understand English and Chinese. Always reply in Simplified Chinese, matching the website language, even if the user writes in English.'
      : body.language === 'en'
        ? 'Understand English and Chinese. Always reply in English, matching the website language, even if the user writes in Chinese.'
        : 'Understand English and Chinese and reply in the language the user uses.',
    `Today's date in London is ${new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/London', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date())}. Use this to resolve relative dates.`,
    'Collect: venue or area/postcode, date (YYYY-MM-DD if possible), start and end time, player count or level, contact name, email, and optional phone/message.',
    'Never claim a court is booked or guaranteed. Explain that this is a request for the team to review.',
    'When enough details are present, summarize them and ask the user to confirm. Set complete=true only after the user explicitly confirms the summary.',
    `Known venues (suggest alternatives when useful): ${venueContext}.`,
    `Return ONLY valid JSON with this shape: {"reply": string, "request": ${requestShape}}.`,
    'Use null for unknown fields. Put player count, level, alternatives, and other context in request.message. complete is a boolean.',
  ].join('\n');

  // The client keeps a local welcome message; Gemini conversations must begin with a user turn.
  const conversation = [...messages];
  while (conversation[0]?.role === 'assistant') conversation.shift();
  if (!conversation.length) return Response.json({ error: 'invalid_request' }, { status: 400 });
  const contents = conversation.map((message) => ({
    role: message.role === 'assistant' ? 'model' : 'user',
    parts: [{ text: message.content }],
  }));
  const model = GEMINI_MODEL?.trim() || 'gemini-3.5-flash-lite';
  const fallbackModel = GEMINI_FALLBACK_MODEL?.trim() || (model === 'gemini-3.5-flash-lite' ? 'gemini-3.8-flash' : 'gemini-3.5-flash-lite');
  let response: Response;
  try {
    response = await generateChatResponse(GEMINI_API_KEY, model, fallbackModel, {
      systemInstruction: { parts: [{ text: systemInstruction }] },
      contents,
      generationConfig: { responseMimeType: 'application/json' },
    });
  } catch {
    console.error('Gemini chat request failed after bounded retries');
    return Response.json({ error: 'chat_unavailable' }, { status: 502 });
  }
  if (!response.ok) {
    console.error('Gemini chat request failed', { status: response.status });
    return Response.json({ error: 'chat_unavailable' }, { status: 502 });
  }

  try {
    const result = await response.json() as { candidates?: Array<{ content?: { parts?: Array<{ text?: string; thought?: boolean }> } }> };
    const text = result.candidates?.[0]?.content?.parts?.filter((part) => !part.thought).map((part) => part.text ?? '').join('');
    if (!text) throw new Error('Empty Gemini response');
    const parsed = JSON.parse(text) as { reply?: unknown; request?: Record<string, unknown> };
    if (typeof parsed.reply !== 'string' || !parsed.reply.trim() || !parsed.request || typeof parsed.request !== 'object' || Array.isArray(parsed.request)) throw new Error('Invalid Gemini response');
    const source = parsed.request;
    const textField = (key: string) => typeof source[key] === 'string' ? source[key].trim().slice(0, MAX_REQUEST_FIELD_LENGTH) : null;
    const normalizedRequest = {
      venueName: textField('venueName'),
      postcode: textField('postcode'),
      preferredDate: textField('preferredDate'),
      startTime: textField('startTime'),
      endTime: textField('endTime'),
      contactName: textField('contactName'),
      email: textField('email'),
      phone: textField('phone'),
      message: textField('message'),
      complete: source.complete === true,
    };
    return Response.json({ reply: parsed.reply.trim().slice(0, MAX_MESSAGE_LENGTH), request: normalizedRequest }, { headers: { 'Cache-Control': 'no-store' } });
  } catch {
    console.error('Unable to parse Gemini chat response');
    return Response.json({ error: 'chat_unavailable' }, { status: 502 });
  }
}

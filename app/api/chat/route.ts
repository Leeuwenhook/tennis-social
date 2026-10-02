import { getRuntimeEnv } from '@/lib/server/runtime';
import { venues } from '@/lib/demo-data';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

type ChatMessage = { role: 'user' | 'assistant'; content: string };

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
  const { GEMINI_API_KEY, GEMINI_MODEL } = getRuntimeEnv();
  if (!GEMINI_API_KEY) return Response.json({ error: 'chat_not_configured' }, { status: 503 });

  let body: { messages?: unknown };
  try {
    body = await request.json() as { messages?: unknown };
  } catch {
    return Response.json({ error: 'invalid_request' }, { status: 400 });
  }

  const messages = Array.isArray(body.messages)
    ? body.messages.filter((item): item is ChatMessage => Boolean(item) && typeof item === 'object' &&
      ((item as ChatMessage).role === 'user' || (item as ChatMessage).role === 'assistant') &&
      typeof (item as ChatMessage).content === 'string').slice(-24)
    : [];
  if (!messages.length || messages.some((item) => item.content.length > 4000)) {
    return Response.json({ error: 'invalid_request' }, { status: 400 });
  }

  const venueContext = venues.map((venue) => `${venue.name} (${venue.nameZh}, ${venue.area})`).join('; ');
  const systemInstruction = [
    'You are the Tennis Social London booking assistant.',
    'Help the user request a tennis court/session. Be warm, concise, and ask one or two missing questions at a time.',
    'Understand English and Chinese and reply in the language the user uses.',
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
  const model = GEMINI_MODEL || 'gemini-2.5-flash';
  const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent?key=${encodeURIComponent(GEMINI_API_KEY)}`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({
      systemInstruction: { parts: [{ text: systemInstruction }] },
      contents,
      generationConfig: { temperature: 0.35, responseMimeType: 'application/json' },
    }),
  });
  if (!response.ok) {
    console.error('Gemini chat request failed', response.status, await response.text());
    return Response.json({ error: 'chat_unavailable' }, { status: 502 });
  }

  try {
    const result = await response.json() as { candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }> };
    const text = result.candidates?.[0]?.content?.parts?.[0]?.text;
    if (!text) throw new Error('Empty Gemini response');
    const parsed = JSON.parse(text) as { reply?: unknown; request?: Record<string, unknown> };
    if (typeof parsed.reply !== 'string' || !parsed.request || typeof parsed.request !== 'object') throw new Error('Invalid Gemini response');
    return Response.json({ reply: parsed.reply.slice(0, 4000), request: parsed.request });
  } catch (error) {
    console.error('Unable to parse Gemini chat response', error);
    return Response.json({ error: 'chat_unavailable' }, { status: 502 });
  }
}

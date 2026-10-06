import assert from 'node:assert/strict';
import { afterEach, beforeEach, test } from 'node:test';
import { POST } from '../app/api/chat/route';

const originalFetch = globalThis.fetch;
const envNames = [
  'GEMINI_API_KEY',
  'GOOGLE_GEMINI_API_KEY',
  'GEMINI_MODEL',
  'GEMINI_FALLBACK_MODEL',
] as const;
const savedEnv = Object.fromEntries(
  envNames.map((name) => [name, process.env[name]]),
);

beforeEach(() => {
  process.env.GEMINI_API_KEY = 'test-key';
  process.env.GEMINI_MODEL = 'gemini-3.8-flash';
  delete process.env.GEMINI_FALLBACK_MODEL;
});

afterEach(() => {
  globalThis.fetch = originalFetch;
  for (const name of envNames) {
    if (savedEnv[name] === undefined) delete process.env[name];
    else process.env[name] = savedEnv[name];
  }
});

function chatRequest(language: string = 'en') {
  return new Request('http://localhost/api/chat', {
    method: 'POST',
    body: JSON.stringify({
      language,
      messages: [
        { role: 'assistant', content: 'Old bilingual welcome' },
        { role: 'user', content: '下周想在 Victoria Park 打球。' },
      ],
    }),
  });
}

function providerReply(reply = 'Which day and time would you prefer?') {
  const text = JSON.stringify({
    reply,
    request: { venueName: 'Victoria Park', complete: false },
  });
  return Response.json({
    candidates: [
      {
        content: {
          parts: [
            { text: 'Internal reasoning', thought: true },
            { text: text.slice(0, 20) },
            { text: text.slice(20) },
          ],
        },
      },
    ],
  });
}

void test('503 overload retries the primary model, then falls back without leaking the key into the URL', async () => {
  const urls: string[] = [];
  globalThis.fetch = async (url, init) => {
    urls.push(url instanceof Request ? url.url : url.toString());
    assert.equal(new Headers(init?.headers).get('x-goog-api-key'), 'test-key');
    return urls.length < 3
      ? Response.json({ error: 'overloaded' }, { status: 503 })
      : providerReply();
  };

  const response = await POST(chatRequest());
  assert.equal(response.status, 200);
  assert.deepEqual(
    urls.map((url) => new URL(url).pathname),
    [
      '/v1beta/models/gemini-3.8-flash:generateContent',
      '/v1beta/models/gemini-3.8-flash:generateContent',
      '/v1beta/models/gemini-3.5-flash-lite:generateContent',
    ],
  );
  assert.ok(
    urls.every((url) => !url.includes('test-key') && !url.includes('?key=')),
  );
  assert.equal((await response.json()).request.venueName, 'Victoria Park');
});

void test('network timeouts recover through the bounded retry', async () => {
  let attempts = 0;
  globalThis.fetch = async () => {
    attempts += 1;
    if (attempts === 1) throw new DOMException('Timed out', 'TimeoutError');
    return providerReply();
  };
  assert.equal((await POST(chatRequest())).status, 200);
  assert.equal(attempts, 2);
});

void test('persistent overload stops after three attempts', async () => {
  let attempts = 0;
  globalThis.fetch = async () => {
    attempts += 1;
    return new Response(null, { status: 503 });
  };
  const response = await POST(chatRequest());
  assert.equal(response.status, 502);
  assert.equal(attempts, 3);
  assert.deepEqual(await response.json(), { error: 'chat_unavailable' });
});

void test('authentication errors are not retried', async () => {
  let attempts = 0;
  globalThis.fetch = async () => {
    attempts += 1;
    return new Response(null, { status: 403 });
  };
  assert.equal((await POST(chatRequest())).status, 502);
  assert.equal(attempts, 1);
});

for (const language of ['en', 'zh']) {
  void test(`the ${language} homepage language controls replies regardless of the user message language`, async () => {
    globalThis.fetch = async (_url, init) => {
      assert.ok(typeof init?.body === 'string');
      const payload = JSON.parse(init.body);
      const instructions = payload.systemInstruction.parts[0].text;
      assert.ok(
        instructions.includes(
          language === 'zh'
            ? 'Always reply in Simplified Chinese'
            : 'Always reply in English',
        ),
      );
      assert.equal(payload.contents[0].role, 'user');
      assert.equal(
        payload.contents[0].parts[0].text,
        '下周想在 Victoria Park 打球。',
      );
      assert.ok(instructions.includes("Today's date in London"));
      return providerReply(
        language === 'zh' ? '你想在哪天、什么时间打球？' : undefined,
      );
    };
    const response = await POST(chatRequest(language));
    assert.equal(response.status, 200);
    assert.equal(response.headers.get('Cache-Control'), 'no-store');
    assert.equal(
      (await response.json()).reply,
      language === 'zh'
        ? '你想在哪天、什么时间打球？'
        : 'Which day and time would you prefer?',
    );
  });
}

void test('invalid language or null request does not contact Gemini', async () => {
  globalThis.fetch = async () => {
    throw new Error('Gemini must not be contacted');
  };
  assert.equal((await POST(chatRequest('fr'))).status, 400);
  assert.equal(
    (
      await POST(
        new Request('http://localhost/api/chat', {
          method: 'POST',
          body: 'null',
        }),
      )
    ).status,
    400,
  );
});

void test('missing credentials return a distinct configuration error', async () => {
  delete process.env.GEMINI_API_KEY;
  delete process.env.GOOGLE_GEMINI_API_KEY;
  const response = await POST(chatRequest());
  assert.equal(response.status, 503);
  assert.deepEqual(await response.json(), { error: 'chat_not_configured' });
});

void test('an empty provider reply is rejected', async () => {
  globalThis.fetch = async () => providerReply('   ');
  assert.equal((await POST(chatRequest())).status, 502);
});

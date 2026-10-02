'use client';

import MessageCircle from 'lucide-react/dist/esm/icons/message-circle.mjs';
import Send from 'lucide-react/dist/esm/icons/send.mjs';
import X from 'lucide-react/dist/esm/icons/x.mjs';
import LoaderCircle from 'lucide-react/dist/esm/icons/loader-circle.mjs';
import { useState } from 'react';

type ChatMessage = { role: 'user' | 'assistant'; content: string };
type RequestDraft = Record<string, unknown> & { complete?: boolean };

const welcome = '你好！我可以帮你收集订场需求。请告诉我想在哪个区域、哪天和什么时间打球？\n\nHi! I can help collect your court request. Which area, date and time would you prefer?';

export function BookingChat() {
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState<ChatMessage[]>([{ role: 'assistant', content: welcome }]);
  const [input, setInput] = useState('');
  const [request, setRequest] = useState<RequestDraft>({});
  const [busy, setBusy] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState('');

  async function sendMessage() {
    const content = input.trim();
    if (!content || busy) return;
    const next = [...messages, { role: 'user' as const, content }];
    setMessages(next);
    setInput('');
    setBusy(true);
    setError('');
    try {
      const response = await fetch('/api/chat', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ messages: next }) });
      const data = await response.json() as { reply?: string; request?: RequestDraft; error?: string };
      if (!response.ok || !data.reply) throw new Error(data.error || 'chat_unavailable');
      setMessages((current) => [...current, { role: 'assistant', content: data.reply as string }]);
      if (data.request) setRequest(data.request);
    } catch {
      setError('暂时无法连接助手，请稍后再试。 / The assistant is temporarily unavailable.');
    } finally {
      setBusy(false);
    }
  }

  async function submitRequest() {
    if (!request.complete || busy) return;
    setBusy(true);
    setError('');
    try {
      const response = await fetch('/api/reservation-requests', {
        method: 'POST', headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ requestType: request.postcode ? 'find_nearby' : 'known_venue', ...request }),
      });
      if (!response.ok) throw new Error('submit_failed');
      setSubmitted(true);
    } catch {
      setError('提交失败，请检查日期、联系方式后重试。 / Please check the details and try again.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      {open ? (
        <section className="booking-chat" aria-label="Court request chat">
          <header className="booking-chat-header">
            <div><strong>订场助手</strong><small>Court request assistant</small></div>
            <button type="button" aria-label="Close chat" onClick={() => setOpen(false)}><X size={18} /></button>
          </header>
          <div className="booking-chat-messages" aria-live="polite">
            {messages.map((message, index) => <div key={`${message.role}-${index}`} className={`booking-chat-message ${message.role}`}>{message.content}</div>)}
            {busy && <div className="booking-chat-message assistant chat-typing"><LoaderCircle size={15} className="chat-spin" /> 正在处理…</div>}
            {submitted && <div className="booking-chat-success">已收到你的订场需求！我们会尽快联系你确认。<br />Request received — we&apos;ll contact you to confirm.</div>}
          </div>
          {error && <p className="booking-chat-error">{error}</p>}
          {!submitted && request.complete && <button type="button" className="booking-chat-submit" onClick={submitRequest} disabled={busy}>确认并提交订场需求 / Submit request</button>}
          {!submitted && <form className="booking-chat-input" onSubmit={(event) => { event.preventDefault(); void sendMessage(); }}>
            <input value={input} onChange={(event) => setInput(event.target.value)} placeholder="输入你的需求… / Type your request…" aria-label="Message" disabled={busy} />
            <button type="submit" aria-label="Send message" disabled={busy || !input.trim()}><Send size={17} /></button>
          </form>}
        </section>
      ) : (
        <button type="button" className="booking-chat-launcher" onClick={() => setOpen(true)} aria-label="Open court request chat"><MessageCircle size={21} /><span>订场助手</span></button>
      )}
    </>
  );
}

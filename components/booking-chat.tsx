'use client';

import MessageCircle from 'lucide-react/dist/esm/icons/message-circle.mjs';
import Send from 'lucide-react/dist/esm/icons/send.mjs';
import X from 'lucide-react/dist/esm/icons/x.mjs';
import LoaderCircle from 'lucide-react/dist/esm/icons/loader-circle.mjs';
import { useState } from 'react';
import type { Language } from '@/types/tennis';

type ChatMessage = { role: 'user' | 'assistant'; content: string };
type RequestDraft = Record<string, unknown> & { complete?: boolean };

const copy = {
  en: {
    title: 'Court request assistant',
    subtitle: 'Tell us when and where you want to play',
    welcome: 'Hi! I can help collect your court request. Which area, date and time would you prefer?',
    close: 'Close chat',
    processing: 'Processing…',
    received: 'Request received — we’ll contact you to confirm.',
    submit: 'Submit court request',
    placeholder: 'Type your request…',
    message: 'Message',
    send: 'Send message',
    open: 'Open court request chat',
    unavailable: 'The assistant is temporarily unavailable. Your message is still here; please try again.',
    notConfigured: 'The assistant is not available yet. Please use the court request form on the homepage.',
    submitFailed: 'Please check the date and contact details and try again.',
  },
  zh: {
    title: '订场助手',
    subtitle: '告诉我们你想在哪、何时打球',
    welcome: '你好！我可以帮你收集订场需求。请告诉我想在哪个区域、哪天和什么时间打球？',
    close: '关闭对话',
    processing: '正在处理…',
    received: '已收到你的订场需求！我们会尽快联系你确认。',
    submit: '确认并提交订场需求',
    placeholder: '输入你的需求…',
    message: '消息',
    send: '发送消息',
    open: '打开订场助手',
    unavailable: '暂时无法连接助手，已保留你的输入，请稍后重试。',
    notConfigured: '订场助手暂未开通，请使用主页上的订场需求表单。',
    submitFailed: '提交失败，请检查日期、联系方式后重试。',
  },
};

export function BookingChat({ language }: { language: Language }) {
  const t = copy[language];
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState('');
  const [request, setRequest] = useState<RequestDraft>({});
  const [busy, setBusy] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState<'unavailable' | 'notConfigured' | 'submitFailed' | null>(null);

  async function sendMessage() {
    const content = input.trim();
    if (!content || busy) return;
    const next = [...messages, { role: 'user' as const, content }];
    setMessages(next);
    setInput('');
    setBusy(true);
    setError(null);
    setRequest((current) => ({ ...current, complete: false }));
    try {
      const response = await fetch('/api/chat', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ messages: next, language }) });
      const data = await response.json() as { reply?: string; request?: RequestDraft; error?: string };
      if (!response.ok || !data.reply) throw new Error(data.error || 'chat_unavailable');
      setMessages((current) => [...current, { role: 'assistant', content: data.reply as string }]);
      if (data.request) setRequest(data.request);
    } catch (error) {
      setMessages(messages);
      setInput(content);
      setError(error instanceof Error && error.message === 'chat_not_configured' ? 'notConfigured' : 'unavailable');
    } finally {
      setBusy(false);
    }
  }

  async function submitRequest() {
    if (!request.complete || busy) return;
    setBusy(true);
    setError(null);
    try {
      const response = await fetch('/api/reservation-requests', {
        method: 'POST', headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ requestType: request.postcode ? 'find_nearby' : 'known_venue', ...request }),
      });
      if (!response.ok) throw new Error('submit_failed');
      setSubmitted(true);
    } catch {
      setError('submitFailed');
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      {open ? (
        <section className="booking-chat" aria-label={t.title}>
          <header className="booking-chat-header">
            <div><strong>{t.title}</strong><small>{t.subtitle}</small></div>
            <button type="button" aria-label={t.close} onClick={() => setOpen(false)}><X size={18} /></button>
          </header>
          <div className="booking-chat-messages" aria-live="polite">
            <div className="booking-chat-message assistant">{t.welcome}</div>
            {messages.map((message, index) => <div key={`${message.role}-${index}`} className={`booking-chat-message ${message.role}`}>{message.content}</div>)}
            {busy && <div className="booking-chat-message assistant chat-typing"><LoaderCircle size={15} className="chat-spin" /> {t.processing}</div>}
            {submitted && <div className="booking-chat-success">{t.received}</div>}
          </div>
          {error && <p className="booking-chat-error">{t[error]}</p>}
          {!submitted && request.complete && <button type="button" className="booking-chat-submit" onClick={submitRequest} disabled={busy}>{t.submit}</button>}
          {!submitted && <form className="booking-chat-input" onSubmit={(event) => { event.preventDefault(); void sendMessage(); }}>
            <input value={input} onChange={(event) => setInput(event.target.value)} placeholder={t.placeholder} aria-label={t.message} disabled={busy} />
            <button type="submit" aria-label={t.send} disabled={busy || !input.trim()}><Send size={17} /></button>
          </form>}
        </section>
      ) : (
        <button type="button" className="booking-chat-launcher" onClick={() => setOpen(true)} aria-label={t.open}><MessageCircle size={21} /><span>{t.title}</span></button>
      )}
    </>
  );
}

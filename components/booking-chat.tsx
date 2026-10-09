'use client';

import MessageCircle from 'lucide-react/dist/esm/icons/message-circle.mjs';
import Send from 'lucide-react/dist/esm/icons/send.mjs';
import X from 'lucide-react/dist/esm/icons/x.mjs';
import LoaderCircle from 'lucide-react/dist/esm/icons/loader-circle.mjs';
import { useEffect, useRef, useState } from 'react';
import type { Language, UserProfile } from '@/types/tennis';
import { BookingChatAccount } from '@/components/booking-chat-account';
import { hasPartnerDetails, isBookingConfirmation, type BookingAssistantDraft } from '@/lib/booking-assistant';

type ChatMessage = { role: 'user' | 'assistant'; content: string };
type RequestDraft = BookingAssistantDraft;

const copy = {
  en: {
    title: 'Court request assistant',
    subtitle: 'Tell us when and where you want to play',
    welcome: 'Hi! I can help collect your court request. Which area, date and time would you prefer?',
    close: 'Close chat',
    processing: 'Processing…',
    received: 'Request received — we’ll contact you to confirm.',
    submit: 'Confirm and submit court request',
    confirmationHint: 'Click the button or type “confirm” to submit. Enter any changes to update your request.',
    confirmationPlaceholder: 'Type “confirm” or tell us what to change…',
    placeholder: 'Type your request…',
    message: 'Message',
    send: 'Send message',
    open: 'Open court request chat',
    unavailable: 'The assistant is temporarily unavailable. Your message is still here; please try again.',
    notConfigured: 'The assistant is not available yet. Please use the court request form on the homepage.',
    submitFailed: 'Please check the date and contact details and try again.',
    accountOffer: 'Would you like to create a Tennis Match account before submitting? We can reuse your contact details and finish the remaining questions here.',
    register: 'Create an account', login: 'I already have an account', guest: 'Submit without registering',
    accountCheckFailed: 'We could not check your account. Please retry, or submit your court request as a guest.',
    retry: 'Check account again', backToChat: 'Back to conversation',
  },
  zh: {
    title: '订场助手',
    subtitle: '告诉我们你想在哪、何时打球',
    welcome: '你好！我可以帮你收集订场需求。请告诉我想在哪个区域、哪天和什么时间打球？',
    close: '关闭对话',
    processing: '正在处理…',
    received: '已收到你的订场需求！我们会尽快联系你确认。',
    submit: '确认并提交订场需求',
    confirmationHint: '点击下方按钮或键入“确认”即可提交；如需修改，请直接输入改动内容。',
    confirmationPlaceholder: '输入“确认”提交，或输入修改内容…',
    placeholder: '输入你的需求…',
    message: '消息',
    send: '发送消息',
    open: '打开订场助手',
    unavailable: '暂时无法连接助手，已保留你的输入，请稍后重试。',
    notConfigured: '订场助手暂未开通，请使用主页上的订场需求表单。',
    submitFailed: '提交失败，请检查日期、联系方式后重试。',
    accountOffer: '提交前，要不要注册 Tennis Match 账号？我们会复用你已填写的联系方式，在这里补齐剩余资料即可。',
    register: '注册账号', login: '我已有账号', guest: '暂不注册，直接提交',
    accountCheckFailed: '暂时无法检查账号状态，请重试，或以游客身份提交订场需求。',
    retry: '重新检查账号', backToChat: '返回对话',
  },
};

export function BookingChat({ language, onAuthenticated }: { language: Language; onAuthenticated: (user: UserProfile) => void }) {
  const t = copy[language];
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState('');
  const [request, setRequest] = useState<RequestDraft>({});
  const [busy, setBusy] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState<'unavailable' | 'notConfigured' | 'submitFailed' | 'accountCheckFailed' | null>(null);
  const [authStage, setAuthStage] = useState<'offer' | 'register' | 'login' | 'unavailable' | null>(null);
  const bottom = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (open) bottom.current?.scrollIntoView({ block: 'nearest' });
  }, [open, messages, busy, submitted, authStage]);

  async function sendMessage() {
    const content = input.trim();
    if (!content || busy) return;
    const next = [...messages, { role: 'user' as const, content }];
    setMessages(next);
    setInput('');
    if (request.complete && hasPartnerDetails(request) && isBookingConfirmation(content)) {
      await submitRequest();
      return;
    }
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

  async function saveRequest() {
    if (!request.complete || !hasPartnerDetails(request)) return;
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

  async function submitRequest() {
    if (!request.complete || !hasPartnerDetails(request) || busy) return;
    setBusy(true);
    setError(null);
    try {
      const response = await fetch('/api/auth/session', { cache: 'no-store' });
      if (response.status === 401) {
        setAuthStage('offer');
        return;
      }
      const data = await response.json() as { user?: UserProfile };
      if (!response.ok || !data.user) throw new Error('session_unavailable');
      setAuthStage(null);
      onAuthenticated(data.user);
      await saveRequest();
    } catch {
      setError('accountCheckFailed');
      setAuthStage('unavailable');
    } finally {
      setBusy(false);
    }
  }

  function finishAuthentication(user: UserProfile) {
    onAuthenticated(user);
    setAuthStage(null);
    void saveRequest();
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
            {!submitted && !authStage && !busy && request.complete && hasPartnerDetails(request) && <div className="booking-chat-message assistant">{t.confirmationHint}</div>}
            {busy && <div className="booking-chat-message assistant chat-typing"><LoaderCircle size={15} className="chat-spin" /> {t.processing}</div>}
            {submitted && <div className="booking-chat-success">{t.received}</div>}
            {!submitted && (authStage === 'offer' || authStage === 'unavailable') && <div className="booking-chat-account">
              {authStage === 'offer' && <div className="booking-chat-message assistant">{t.accountOffer}</div>}
              <div className="booking-chat-account-actions">
                {authStage === 'offer' ? <>
                  <button type="button" disabled={busy} onClick={() => { setError(null); setAuthStage('register'); }}>{t.register}</button>
                  <button type="button" disabled={busy} onClick={() => { setError(null); setAuthStage('login'); }}>{t.login}</button>
                </> : <button type="button" disabled={busy} onClick={() => void submitRequest()}>{t.retry}</button>}
                <button type="button" disabled={busy} onClick={() => { setAuthStage(null); void saveRequest(); }}>{t.guest}</button>
                <button type="button" disabled={busy} onClick={() => { setError(null); setAuthStage(null); }}>{t.backToChat}</button>
              </div>
            </div>}
            {!submitted && (authStage === 'register' || authStage === 'login') && <BookingChatAccount key={authStage} language={language} draft={request} mode={authStage} onBack={() => setAuthStage('offer')} onAuthenticated={finishAuthentication} />}
            <div ref={bottom} />
          </div>
          {error && <p className="booking-chat-error">{t[error]}</p>}
          {!submitted && !authStage && request.complete && hasPartnerDetails(request) && <button type="button" className="booking-chat-submit" onClick={submitRequest} disabled={busy}>{t.submit}</button>}
          {!submitted && !authStage && <form className="booking-chat-input" onSubmit={(event) => { event.preventDefault(); void sendMessage(); }}>
            <input value={input} onChange={(event) => setInput(event.target.value)} placeholder={request.complete && hasPartnerDetails(request) ? t.confirmationPlaceholder : t.placeholder} aria-label={t.message} disabled={busy} />
            <button type="submit" aria-label={t.send} disabled={busy || !input.trim()}><Send size={17} /></button>
          </form>}
        </section>
      ) : (
        <button type="button" className="booking-chat-launcher" onClick={() => setOpen(true)} aria-label={t.open}><MessageCircle size={21} /><span>{t.title}</span></button>
      )}
    </>
  );
}

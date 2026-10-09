'use client';

import { useState } from 'react';
import type { BookingAssistantDraft } from '@/lib/booking-assistant';
import { LEVELS, PREFERRED_TIMES } from '@/lib/tennis-utils';
import { preferredTimeLabel } from '@/lib/formatters';
import { translations } from '@/lib/translations';
import type { Language, UserProfile } from '@/types/tennis';

const copy = {
  en: {
    name: 'What name would you like to use for your account?',
    email: 'Which email address would you like to use?',
    tennisLevel:
      'What is your tennis level? Choose the rating that best describes you.',
    preferredTime: 'When do you usually like to play tennis?',
    preferredFormat: 'Do you usually prefer singles, doubles, or both?',
    password:
      'Choose a password to finish creating your account. Enter it in the password box below.',
    next: 'Continue',
    back: 'Back',
    register: 'Create account and submit request',
    login: 'Sign in and submit request',
    loginIntro: 'Sign in to your existing account to submit this request.',
    unavailable: 'We could not connect to your account. Please try again.',
  },
  zh: {
    name: '你想使用什么姓名注册账号？',
    email: '你想使用哪个电子邮箱注册？',
    tennisLevel: '你的网球水平是多少？请选择最符合你的等级。',
    preferredTime: '你平时喜欢在什么时间打网球？',
    preferredFormat: '你平时更喜欢单打、双打，还是都可以？',
    password: '请在下方密码框设置密码，完成账号注册。',
    next: '继续',
    back: '返回',
    register: '注册账号并提交需求',
    login: '登录并提交需求',
    loginIntro: '登录已有账号后，即可提交这次订场需求。',
    unavailable: '暂时无法连接账号服务，请重试。',
  },
};

type Profile = {
  name: string;
  email: string;
  phone: string;
  postcode: string;
  tennisLevel: string;
  preferredTime: string;
  preferredFormat: string;
};
const fields = [
  'name',
  'email',
  'tennisLevel',
  'preferredTime',
  'preferredFormat',
] as const;

export function BookingChatAccount({
  language,
  draft,
  mode,
  onBack,
  onAuthenticated,
}: {
  language: Language;
  draft: BookingAssistantDraft;
  mode: 'register' | 'login';
  onBack: () => void;
  onAuthenticated: (user: UserProfile) => void;
}) {
  const t = translations[language];
  const c = copy[language];
  const [profile, setProfile] = useState<Profile>(() => ({
    name: draft.contactName?.trim() ?? '',
    email: draft.email?.trim() ?? '',
    phone: draft.phone?.trim() ?? '',
    postcode: '',
    tennisLevel: LEVELS.find((level) => level === draft.tennisLevel) ?? '',
    preferredTime: '',
    preferredFormat: draft.gameFormat ?? '',
  }));
  const [answer, setAnswer] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const field =
    mode === 'register' ? fields.find((key) => !profile[key]) : undefined;
  const label = field
    ? {
        name: t.name,
        email: t.email,
        tennisLevel: t.tennisLevel,
        preferredTime: t.preferredTime,
        preferredFormat: t.preferredFormat,
      }[field]
    : t.password;

  async function authenticate() {
    if (busy) return;
    setBusy(true);
    setError(null);
    try {
      const response = await fetch(
        mode === 'register' ? '/api/auth/register' : '/api/auth/login',
        {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify(
            mode === 'register'
              ? { ...profile, password }
              : { email: profile.email, password },
          ),
        },
      );
      const data = (await response.json()) as {
        user?: UserProfile;
        error?: string;
      };
      if (!response.ok || !data.user) {
        setError(
          data.error === 'email_exists'
            ? t.emailExists
            : data.error === 'invalid_registration'
              ? t.registrationInvalid
              : response.status === 401
                ? t.invalidCredentials
                : c.unavailable,
        );
        return;
      }
      onAuthenticated(data.user);
    } catch {
      setError(c.unavailable);
    } finally {
      // Passwords never enter the conversation, request draft, or browser storage.
      setPassword('');
      setBusy(false);
    }
  }

  return (
    <div className="booking-chat-account">
      <div className="booking-chat-message assistant">
        {mode === 'login' ? c.loginIntro : field ? c[field] : c.password}
      </div>
      {mode === 'register' && (
        <p className="booking-chat-account-summary">
          {[
            profile.name,
            profile.email,
            profile.tennisLevel
              ? `${t.tennisLevel}: ${profile.tennisLevel}`
              : '',
          ]
            .filter(Boolean)
            .join(' · ')}
        </p>
      )}
      <form
        className="booking-chat-account-form"
        onSubmit={(event) => {
          event.preventDefault();
          if (busy) return;
          if (field) {
            if (!answer.trim()) return;
            setProfile((current) => ({ ...current, [field]: answer.trim() }));
            setAnswer('');
            setError(null);
          } else void authenticate();
        }}
      >
        {mode === 'login' && (
          <>
            <label htmlFor="chat-account-email">{t.email}</label>
            <input
              id="chat-account-email"
              type="email"
              autoComplete="username"
              required
              maxLength={254}
              disabled={busy}
              value={profile.email}
              onChange={(event) =>
                setProfile((current) => ({
                  ...current,
                  email: event.target.value,
                }))
              }
            />
          </>
        )}
        <label htmlFor="chat-account-answer">{label}</label>
        {field === 'tennisLevel' ||
        field === 'preferredTime' ||
        field === 'preferredFormat' ? (
          <select
            id="chat-account-answer"
            key={field}
            value={answer}
            onChange={(event) => setAnswer(event.target.value)}
            required
            disabled={busy}
          >
            <option value="" disabled>
              {label}
            </option>
            {field === 'tennisLevel' ? (
              LEVELS.map((level) => (
                <option key={level} value={level}>
                  {level}
                </option>
              ))
            ) : field === 'preferredTime' ? (
              PREFERRED_TIMES.map((time) => (
                <option key={time} value={time}>
                  {preferredTimeLabel(time, t)}
                </option>
              ))
            ) : (
              <>
                <option value="singles">{t.singles}</option>
                <option value="doubles">{t.doubles}</option>
                <option value="both">{t.both}</option>
              </>
            )}
          </select>
        ) : field ? (
          <input
            id="chat-account-answer"
            key={field}
            value={answer}
            onChange={(event) => setAnswer(event.target.value)}
            type={field === 'email' ? 'email' : 'text'}
            autoComplete={field === 'email' ? 'email' : 'name'}
            required
            maxLength={field === 'email' ? 254 : 120}
            disabled={busy}
          />
        ) : (
          <>
            <input
              id="chat-account-answer"
              type="password"
              autoComplete={
                mode === 'register' ? 'new-password' : 'current-password'
              }
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              required
              minLength={mode === 'register' ? 8 : 1}
              maxLength={128}
              disabled={busy}
            />
            {mode === 'register' && <small>{t.passwordHint}</small>}
          </>
        )}
        {error && (
          <p className="booking-chat-error" role="alert">
            {error}
          </p>
        )}
        <div className="booking-chat-account-actions">
          <button type="submit" disabled={busy}>
            {busy
              ? t.saving
              : field
                ? c.next
                : mode === 'register'
                  ? c.register
                  : c.login}
          </button>
          <button type="button" disabled={busy} onClick={onBack}>
            {c.back}
          </button>
        </div>
      </form>
    </div>
  );
}

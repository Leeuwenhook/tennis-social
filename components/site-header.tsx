'use client';

import Globe2 from 'lucide-react/dist/esm/icons/globe-2.mjs';
import UserRound from 'lucide-react/dist/esm/icons/user-round.mjs';
import { AppMark } from '@/components/app-mark';
import type { Language, UserProfile, View } from '@/types/tennis';

export function SiteHeader({
  language,
  onLanguageChange,
  user,
  activeView,
  onNavigate,
  brandTag,
  accountLabel,
}: {
  language: Language;
  onLanguageChange: (lang: Language) => void;
  user: UserProfile | null;
  activeView: View;
  onNavigate: (view: View) => void;
  brandTag: string;
  accountLabel: string;
}) {
  return (
    <header className="site-header">
      <div className="site-header-inner">
        <button type="button" className="brand-lockup" onClick={() => onNavigate('home')}>
          <AppMark />
          <span>
            <strong>Tennis Social</strong>
            <small>{brandTag}</small>
          </span>
        </button>
        <div className="header-actions">
          <button
            type="button"
            className="language-switch"
            aria-label="Switch language"
            onClick={() => onLanguageChange(language === 'en' ? 'zh' : 'en')}
          >
            <Globe2 size={16} />
            <span>{language === 'en' ? '中文' : 'EN'}</span>
          </button>
          <button
            type="button"
            aria-label={user ? user.name : accountLabel}
            className={`account-link ${activeView === 'account' ? 'active' : ''}`}
            onClick={() => onNavigate('account')}
          >
            <UserRound size={15} /> <span className="site-nav-label">{user ? user.name : accountLabel}</span>
          </button>
        </div>
      </div>
    </header>
  );
}

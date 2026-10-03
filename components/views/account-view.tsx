'use client';

import type { FormEvent } from 'react';
import ArrowLeft from 'lucide-react/dist/esm/icons/arrow-left.mjs';
import ArrowRight from 'lucide-react/dist/esm/icons/arrow-right.mjs';
import Check from 'lucide-react/dist/esm/icons/check.mjs';
import Pencil from 'lucide-react/dist/esm/icons/pencil.mjs';
import TriangleAlert from 'lucide-react/dist/esm/icons/triangle-alert.mjs';
import UserRound from 'lucide-react/dist/esm/icons/user-round.mjs';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { PREFERRED_FORMATS, type PreferredFormat } from '@/lib/demo-data';
import { formatDate, preferredFormatName, preferredTimeLabel } from '@/lib/formatters';
import { LEVELS, PREFERRED_TIMES } from '@/lib/tennis-utils';
import type { Translations } from '@/lib/translations';
import type { AuthMode, Language, LoyaltyStatus, PreferredTime, ProfileForm, UserProfile } from '@/types/tennis';

export function AccountView({
  userAuthChecked,
  user,
  profileEditing,
  profileBusy,
  profileError,
  profileForm,
  setProfileForm,
  onSubmitProfileUpdate,
  onBeginProfileEdit,
  onCancelProfileEdit,
  onLogout,
  loyalty,
  loyaltyLoading,
  authMode,
  setAuthMode,
  authBusy,
  authError,
  loginForm,
  setLoginForm,
  registrationForm,
  setRegistrationForm,
  onSubmitUserAuth,
  language,
  t,
  onNavigateHome,
}: {
  userAuthChecked: boolean;
  user: UserProfile | null;
  profileEditing: boolean;
  profileBusy: boolean;
  profileError: string;
  profileForm: ProfileForm;
  setProfileForm: React.Dispatch<React.SetStateAction<ProfileForm>>;
  onSubmitProfileUpdate: (e: FormEvent<HTMLFormElement>) => void;
  onBeginProfileEdit: () => void;
  onCancelProfileEdit: () => void;
  onLogout: () => void;
  loyalty: LoyaltyStatus | null;
  loyaltyLoading: boolean;
  authMode: AuthMode;
  setAuthMode: (mode: AuthMode) => void;
  authBusy: boolean;
  authError: string;
  loginForm: { email: string; password: string };
  setLoginForm: React.Dispatch<React.SetStateAction<{ email: string; password: string }>>;
  registrationForm: {
    name: string;
    email: string;
    phone: string;
    password: string;
    postcode: string;
    tennisLevel: string;
    preferredTime: PreferredTime;
    preferredFormat: PreferredFormat;
  };
  setRegistrationForm: React.Dispatch<
    React.SetStateAction<{
      name: string;
      email: string;
      phone: string;
      password: string;
      postcode: string;
      tennisLevel: string;
      preferredTime: PreferredTime;
      preferredFormat: PreferredFormat;
    }>
  >;
  onSubmitUserAuth: (e: FormEvent<HTMLFormElement>) => void;
  language: Language;
  t: Translations;
  onNavigateHome: () => void;
}) {
  if (!userAuthChecked) {
    return (
      <section className="account-page page-width">
        <div className="account-card">
          <p>{t.checkingAccess}</p>
        </div>
      </section>
    );
  }

  if (user) {
    return (
      <section className="account-page page-width">
        <div className="account-card profile-card">
          <div className="profile-avatar">
            <UserRound size={28} />
          </div>
          <p className="eyebrow">
            <span className="eyebrow-dot" /> {profileEditing ? t.editProfile : t.memberSince}
          </p>
          <h1>
            {profileEditing ? t.editProfile : <>{t.welcomeBack}, {user.name}</>}
          </h1>
          <p className="form-intro">{profileEditing ? t.editProfileIntro : t.accountIntro}</p>
          {profileEditing ? (
            <form className="login-fields profile-edit-form" onSubmit={onSubmitProfileUpdate} noValidate>
              <div className="form-grid two-col">
                <div className="field">
                  <Label htmlFor="profile-name">
                    {t.name} <em>*</em>
                  </Label>
                  <Input
                    id="profile-name"
                    autoComplete="name"
                    required
                    value={profileForm.name}
                    onChange={(event) =>
                      setProfileForm((current) => ({ ...current, name: event.target.value }))
                    }
                  />
                </div>
                <div className="field">
                  <Label htmlFor="profile-phone">
                    {t.phone} <small>({t.optional})</small>
                  </Label>
                  <Input
                    id="profile-phone"
                    autoComplete="tel"
                    inputMode="tel"
                    value={profileForm.phone}
                    onChange={(event) =>
                      setProfileForm((current) => ({ ...current, phone: event.target.value }))
                    }
                  />
                </div>
              </div>
              <div className="field">
                <Label htmlFor="profile-email">
                  {t.email} <em>*</em>
                </Label>
                <Input
                  id="profile-email"
                  autoComplete="email"
                  inputMode="email"
                  required
                  value={profileForm.email}
                  onChange={(event) =>
                    setProfileForm((current) => ({ ...current, email: event.target.value }))
                  }
                />
              </div>
              <div className="field">
                <Label htmlFor="profile-postcode">
                  {t.postcode} <small>({t.optional})</small>
                </Label>
                <Input
                  id="profile-postcode"
                  autoComplete="postal-code"
                  value={profileForm.postcode}
                  onChange={(event) =>
                    setProfileForm((current) => ({
                      ...current,
                      postcode: event.target.value.toUpperCase(),
                    }))
                  }
                />
              </div>
              <div className="form-grid two-col">
                <div className="field">
                  <Label htmlFor="profile-level">
                    {t.tennisLevel} <em>*</em>
                  </Label>
                  <select
                    id="profile-level"
                    required
                    className="native-select"
                    value={profileForm.tennisLevel}
                    onChange={(event) =>
                      setProfileForm((current) => ({ ...current, tennisLevel: event.target.value }))
                    }
                  >
                    <option value="">{language === 'zh' ? '请选择水平' : 'Select level'}</option>
                    {LEVELS.map((level) => (
                      <option key={level} value={level}>
                        {level}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="field">
                  <Label htmlFor="profile-format">
                    {t.preferredFormat} <em>*</em>
                  </Label>
                  <select
                    id="profile-format"
                    className="native-select"
                    value={profileForm.preferredFormat}
                    onChange={(event) =>
                      setProfileForm((current) => ({
                        ...current,
                        preferredFormat: event.target.value as PreferredFormat,
                      }))
                    }
                  >
                    {PREFERRED_FORMATS.map((format) => (
                      <option key={format} value={format}>
                        {preferredFormatName(format, t)}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
              <div className="field">
                <Label htmlFor="profile-time">
                  {t.preferredTime} <em>*</em>
                </Label>
                <select
                  id="profile-time"
                  className="native-select"
                  value={profileForm.preferredTime}
                  onChange={(event) =>
                    setProfileForm((current) => ({
                      ...current,
                      preferredTime: event.target.value as PreferredTime,
                    }))
                  }
                >
                  {PREFERRED_TIMES.map((time) => (
                    <option key={time} value={time}>
                      {preferredTimeLabel(time, t)}
                    </option>
                  ))}
                </select>
              </div>
              {profileError ? (
                <div className="inline-error">
                  <TriangleAlert size={16} /> {profileError}
                </div>
              ) : null}
              <div className="account-actions">
                <Button type="submit" size="lg" disabled={profileBusy}>
                  {profileBusy ? t.savingProfile : t.saveProfile}
                  <Check size={16} />
                </Button>
                <Button
                  type="button"
                  size="lg"
                  variant="outline"
                  disabled={profileBusy}
                  onClick={onCancelProfileEdit}
                >
                  {t.cancelEdit}
                </Button>
              </div>
            </form>
          ) : (
            <>
              <div className="profile-details">
                <div>
                  <small>{t.email}</small>
                  <strong>{user.email}</strong>
                </div>
                {user.phone ? (
                  <div>
                    <small>{t.phone}</small>
                    <strong>{user.phone}</strong>
                  </div>
                ) : null}
                <div>
                  <small>{t.postcode}</small>
                  <strong>{user.postcode}</strong>
                </div>
                <div>
                  <small>{t.tennisLevel}</small>
                  <strong>{user.tennisLevel}</strong>
                </div>
                <div>
                  <small>{t.preferredTime}</small>
                  <strong>{preferredTimeLabel(user.preferredTime, t)}</strong>
                </div>
                <div>
                  <small>{t.preferredFormat}</small>
                  <strong>{preferredFormatName(user.preferredFormat, t)}</strong>
                </div>
              </div>
              <div className="loyalty-card">
                <div className="loyalty-card-heading">
                  <div>
                    <p className="eyebrow muted">{t.loyaltyTitle}</p>
                    <h2>
                      {loyalty ? `${t.participationCount}: ${loyalty.participationCount}` : t.loyaltyTitle}
                    </h2>
                  </div>
                  <span className="loyalty-badge">10%</span>
                </div>
                {loyaltyLoading && !loyalty ? <p className="form-intro">{t.checkingAccess}</p> : null}
                {loyalty ? (
                  <>
                    <div
                      className="loyalty-progress"
                      aria-label={t.rewardProgress
                        .replace('{count}', String(loyalty.permanentDiscountEligible ? 10 : Math.min(loyalty.participationCount, 10)))
                        .replace('{target}', '10')}
                    >
                      <span
                        style={{
                          width: `${loyalty.permanentDiscountEligible ? 100 : Math.min(100, loyalty.participationCount * 10)}%`,
                        }}
                      />
                    </div>
                    <p className="form-intro">
                      {loyalty.permanentDiscountEligible
                        ? t.permanentDiscountActive
                        : t.nextReward.replace(
                            '{count}',
                            String(Math.max(1, 10 - loyalty.participationCount)),
                          )}
                    </p>
                    {!loyalty.legacyCouponsEnabled && loyalty.coupons.length ? (
                      <p className="form-intro">{t.legacyRewardsPaused}</p>
                    ) : null}
                    {loyalty.legacyCouponsEnabled ? (
                      loyalty.coupons.length ? (
                        <div className="coupon-list">
                          {loyalty.coupons.map((coupon) => (
                            <div className="coupon-row" key={coupon.id}>
                              <div>
                                <strong>{coupon.code}</strong>
                                <small>
                                  {coupon.discountPercent}% ·{' '}
                                  {t.couponExpires.replace(
                                    '{date}',
                                    formatDate(coupon.expiresAt.slice(0, 10), language),
                                  )}
                                </small>
                              </div>
                              <Badge variant={coupon.status === 'available' ? 'default' : 'secondary'}>
                                {coupon.status === 'available'
                                  ? t.applyCoupon
                                  : coupon.status === 'redeemed'
                                    ? t.couponUsed
                                    : coupon.status === 'reserved'
                                      ? t.couponPending
                                      : t.couponExpired}
                              </Badge>
                            </div>
                          ))}
                        </div>
                      ) : (
                        <p className="form-intro">{t.noCoupons}</p>
                      )
                    ) : null}
                  </>
                ) : null}
              </div>
              <div className="account-actions">
                <Button size="lg" onClick={onBeginProfileEdit}>
                  <Pencil size={16} />
                  {t.editProfile}
                </Button>
                <Button size="lg" variant="outline" onClick={onNavigateHome}>
                  {t.browseMore}
                  <ArrowRight size={16} />
                </Button>
                <Button size="lg" variant="outline" onClick={onLogout}>
                  {t.logout}
                </Button>
              </div>
            </>
          )}
        </div>
      </section>
    );
  }

  return (
    <section className="account-page page-width">
      <button type="button" className="back-link" onClick={onNavigateHome}>
        <ArrowLeft size={16} /> {t.backToHome}
      </button>
      <div className="account-card">
        <p className="eyebrow">
          <span className="eyebrow-dot" /> {t.accountTitle}
        </p>
        <h1>{authMode === 'login' ? t.signIn : t.createAccount}</h1>
        <p className="form-intro">{authMode === 'login' ? t.loginIntro : t.registerIntro}</p>
        <div className="auth-tabs" role="tablist">
          <button
            type="button"
            className={authMode === 'login' ? 'active' : ''}
            onClick={() => setAuthMode('login')}
          >
            {t.signIn}
          </button>
          <button
            type="button"
            className={authMode === 'register' ? 'active' : ''}
            onClick={() => setAuthMode('register')}
          >
            {t.createAccount}
          </button>
        </div>
        <form onSubmit={onSubmitUserAuth} noValidate>
          <div className="login-fields">
            {authMode === 'register' ? (
              <>
                <div className="form-grid two-col">
                  <div className="field">
                    <Label htmlFor="register-name">
                      {t.name} <em>*</em>
                    </Label>
                    <Input
                      id="register-name"
                      autoComplete="name"
                      required
                      value={registrationForm.name}
                      onChange={(event) =>
                        setRegistrationForm((current) => ({ ...current, name: event.target.value }))
                      }
                    />
                  </div>
                  <div className="field">
                    <Label htmlFor="register-phone">
                      {t.phone} <small>({t.optional})</small>
                    </Label>
                    <Input
                      id="register-phone"
                      autoComplete="tel"
                      inputMode="tel"
                      value={registrationForm.phone}
                      onChange={(event) =>
                        setRegistrationForm((current) => ({ ...current, phone: event.target.value }))
                      }
                    />
                  </div>
                </div>
                <div className="field">
                  <Label htmlFor="register-email">
                    {t.email} <em>*</em>
                  </Label>
                  <Input
                    id="register-email"
                    autoComplete="email"
                    inputMode="email"
                    required
                    value={registrationForm.email}
                    onChange={(event) =>
                      setRegistrationForm((current) => ({ ...current, email: event.target.value }))
                    }
                  />
                </div>
                <div className="field">
                  <Label htmlFor="register-password">
                    {t.password} <em>*</em> <small>({t.passwordHint})</small>
                  </Label>
                  <Input
                    id="register-password"
                    type="password"
                    autoComplete="new-password"
                    minLength={8}
                    required
                    value={registrationForm.password}
                    onChange={(event) =>
                      setRegistrationForm((current) => ({
                        ...current,
                        password: event.target.value,
                      }))
                    }
                  />
                </div>
                <div className="field">
                  <Label htmlFor="register-postcode">
                    {t.postcode} <small>({t.optional})</small>
                  </Label>
                  <Input
                    id="register-postcode"
                    autoComplete="postal-code"
                    value={registrationForm.postcode}
                    onChange={(event) =>
                      setRegistrationForm((current) => ({
                        ...current,
                        postcode: event.target.value.toUpperCase(),
                      }))
                    }
                  />
                </div>
                <div className="form-grid two-col">
                  <div className="field">
                    <Label htmlFor="register-level">
                      {t.tennisLevel} <em>*</em>
                    </Label>
                    <select
                      id="register-level"
                      required
                      className="native-select"
                      value={registrationForm.tennisLevel}
                      onChange={(event) =>
                        setRegistrationForm((current) => ({
                          ...current,
                          tennisLevel: event.target.value,
                        }))
                      }
                    >
                      <option value="">{language === 'zh' ? '请选择水平' : 'Select level'}</option>
                      {LEVELS.map((level) => (
                        <option key={level} value={level}>
                          {level}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div className="field">
                    <Label htmlFor="register-format">
                      {t.preferredFormat} <em>*</em>
                    </Label>
                    <select
                      id="register-format"
                      className="native-select"
                      value={registrationForm.preferredFormat}
                      onChange={(event) =>
                        setRegistrationForm((current) => ({
                          ...current,
                          preferredFormat: event.target.value as PreferredFormat,
                        }))
                      }
                    >
                      {PREFERRED_FORMATS.map((format) => (
                        <option key={format} value={format}>
                          {preferredFormatName(format, t)}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>
                <div className="field">
                  <Label htmlFor="register-time">
                    {t.preferredTime} <em>*</em>
                  </Label>
                  <select
                    id="register-time"
                    className="native-select"
                    value={registrationForm.preferredTime}
                    onChange={(event) =>
                      setRegistrationForm((current) => ({
                        ...current,
                        preferredTime: event.target.value as PreferredTime,
                      }))
                    }
                  >
                    {PREFERRED_TIMES.map((time) => (
                      <option key={time} value={time}>
                        {preferredTimeLabel(time, t)}
                      </option>
                    ))}
                  </select>
                </div>
              </>
            ) : (
              <>
                <div className="field">
                  <Label htmlFor="login-email">{t.email}</Label>
                  <Input
                    id="login-email"
                    autoComplete="email"
                    inputMode="email"
                    required
                    value={loginForm.email}
                    onChange={(event) =>
                      setLoginForm((current) => ({ ...current, email: event.target.value }))
                    }
                  />
                </div>
                <div className="field">
                  <Label htmlFor="login-password">{t.password}</Label>
                  <Input
                    id="login-password"
                    type="password"
                    autoComplete="current-password"
                    required
                    value={loginForm.password}
                    onChange={(event) =>
                      setLoginForm((current) => ({ ...current, password: event.target.value }))
                    }
                  />
                </div>
              </>
            )}
          </div>
          {authError ? (
            <div className="inline-error">
              <TriangleAlert size={16} /> {authError}
            </div>
          ) : null}
          <Button type="submit" size="lg" className="primary-wide account-submit" disabled={authBusy}>
            {authBusy
              ? authMode === 'login'
                ? t.signingIn
                : t.creatingAccount
              : authMode === 'login'
                ? t.signIn
                : t.createAccount}
            <ArrowRight size={16} />
          </Button>
        </form>
      </div>
    </section>
  );
}

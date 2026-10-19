'use client';

import { useEffect, useState, type SubmitEvent } from 'react';
import Star from 'lucide-react/dist/esm/icons/star.mjs';
import X from 'lucide-react/dist/esm/icons/x.mjs';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { IMAGE_TYPES, REVIEW_LIMITS, reviewMediaPrefix, VIDEO_TYPES, type ReviewMediaKind } from '@/lib/review-rules';
import type { Language } from '@/types/tennis';

type Context = {
  bookingId: string;
  firstName: string;
  venueName: string;
  venueNameZh: string;
  date: string;
  startTime: string;
  endTime: string;
  canSubmit: boolean;
  mediaEnabled: boolean;
  videoEnabled: boolean;
  review: {
    displayName: string;
    rating: number | null;
    body: string;
    status: string;
    media: Array<{ kind: ReviewMediaKind; url: string }>;
  } | null;
};

type Upload = {
  key: string;
  name: string;
  kind: ReviewMediaKind;
  progress: number;
  error?: string;
  result?: { url: string; pathname: string; width: number | null; height: number | null; durationSeconds: number | null };
};

const copy = {
  en: {
    title: 'How was your game?',
    loading: 'Loading…',
    invalid: 'This review link is invalid or has expired. If you need help, reply to your booking email.',
    unavailable: 'Reviews are unavailable right now. Please try again later.',
    closed: 'Reviews for this session are closed.',
    session: 'Session',
    name: 'Name shown with your review',
    namePlaceholder: 'First name or nickname',
    rating: 'Rating (optional)',
    body: 'Your review',
    bodyPlaceholder: 'How was the court, the level, the people?',
    media: 'Photos',
    mediaWithVideo: 'Photos and one video',
    mediaHint: `Up to ${REVIEW_LIMITS.images} photos.`,
    videoHint: `Up to ${REVIEW_LIMITS.images} photos and 1 video (max ${REVIEW_LIMITS.videoSeconds} seconds, 50MB — trim it first or record in 720p).`,
    addMedia: 'Add files',
    uploading: 'Uploading',
    remove: 'Remove',
    consentPublic: 'I agree that Tennis Match may show my review and name on its website.',
    consentMedia: 'I took these photos/videos or have consent from everyone shown (a parent or guardian for anyone under 18), and agree to them being shown publicly.',
    privacy: 'We store your review with your booking and show it only after a moderator approves it. Photos are resized and their location data removed before upload; video files are uploaded as they are. You can delete your review from this link for 90 days, or email us at any time to have it removed.',
    submit: 'Send review',
    sending: 'Sending…',
    thanks: 'Thank you! Your review will appear after a quick check.',
    yourReview: 'Your review',
    statusPending: 'Waiting for approval',
    statusApproved: 'Published',
    statusOther: 'Not published',
    delete: 'Delete my review',
    confirmDelete: 'Delete your review and its photos permanently?',
    deleted: 'Your review has been deleted.',
    invalidForm: 'Please add a name and a review, and tick the consent boxes.',
    tooManyImages: `You can add up to ${REVIEW_LIMITS.images} photos.`,
    tooManyVideos: 'You can add one video.',
    videoTooLong: `Videos can be up to ${REVIEW_LIMITS.videoSeconds} seconds.`,
    fileTooLarge: 'This file is too large.',
    fileType: 'This file type is not supported. Use JPEG, PNG, WebP, MP4 or MOV.',
    uploadFailed: 'Upload failed. Please try again.',
    submitFailed: 'We could not send your review. Please try again.',
    switchLanguage: '中文',
  },
  zh: {
    title: '这场球打得怎么样？',
    loading: '加载中…',
    invalid: '评价链接无效或已过期。如需帮助，请直接回复预订邮件。',
    unavailable: '评价功能暂时不可用，请稍后再试。',
    closed: '这场活动的评价已关闭。',
    session: '场次',
    name: '评价显示的名字',
    namePlaceholder: '名字或昵称',
    rating: '评分（可选）',
    body: '你的评价',
    bodyPlaceholder: '场地、水平、球友怎么样？',
    media: '照片',
    mediaWithVideo: '照片和一段视频',
    mediaHint: `最多 ${REVIEW_LIMITS.images} 张照片。`,
    videoHint: `最多 ${REVIEW_LIMITS.images} 张照片和 1 段视频（不超过 ${REVIEW_LIMITS.videoSeconds} 秒、50MB，建议先剪辑或用 720p 拍摄）。`,
    addMedia: '添加文件',
    uploading: '上传中',
    remove: '移除',
    consentPublic: '我同意 Tennis Match 在网站上公开展示我的评价和名字。',
    consentMedia: '照片/视频由我拍摄，或已获得画面中所有人的同意（未成年人需监护人同意），并同意公开展示。',
    privacy: '评价与预订一起保存，经管理员审核后才会公开。照片上传前会压缩并去掉位置信息；视频按原文件上传。90 天内可通过本链接删除评价，之后也可随时发邮件要求删除。',
    submit: '提交评价',
    sending: '提交中…',
    thanks: '谢谢！评价审核后就会展示。',
    yourReview: '你的评价',
    statusPending: '等待审核',
    statusApproved: '已公开',
    statusOther: '未公开',
    delete: '删除我的评价',
    confirmDelete: '确定永久删除评价和照片吗？',
    deleted: '评价已删除。',
    invalidForm: '请填写名字和评价，并勾选同意项。',
    tooManyImages: `最多添加 ${REVIEW_LIMITS.images} 张照片。`,
    tooManyVideos: '最多添加 1 段视频。',
    videoTooLong: `视频不能超过 ${REVIEW_LIMITS.videoSeconds} 秒。`,
    fileTooLarge: '文件太大。',
    fileType: '不支持这种文件格式，请使用 JPEG、PNG、WebP、MP4 或 MOV。',
    uploadFailed: '上传失败，请重试。',
    submitFailed: '评价提交失败，请重试。',
    switchLanguage: 'English',
  },
} as const;

type Copy = (typeof copy)[Language];

/** Re-encodes a photo as JPEG with the long edge at most 2048px, which also drops EXIF/GPS. */
async function compressImage(file: File) {
  const bitmap = await createImageBitmap(file, { imageOrientation: 'from-image' });
  const scale = Math.min(1, 2048 / Math.max(bitmap.width, bitmap.height));
  const canvas = document.createElement('canvas');
  canvas.width = Math.round(bitmap.width * scale);
  canvas.height = Math.round(bitmap.height * scale);
  canvas.getContext('2d')?.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
  bitmap.close();
  const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, 'image/jpeg', 0.85));
  if (!blob) throw new Error('compress_failed');
  return { file: new File([blob], 'photo.jpg', { type: 'image/jpeg' }), width: canvas.width, height: canvas.height };
}

function videoDuration(file: File) {
  return new Promise<number>((resolve, reject) => {
    const video = document.createElement('video');
    const url = URL.createObjectURL(file);
    video.preload = 'metadata';
    video.onloadedmetadata = () => {
      URL.revokeObjectURL(url);
      resolve(video.duration);
    };
    video.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error('metadata_failed'));
    };
    video.src = url;
  });
}

function extension(type: string) {
  return { 'video/mp4': 'mp4', 'video/quicktime': 'mov', 'video/webm': 'webm' }[type] ?? 'jpg';
}

export function ReviewForm() {
  const [language, setLanguage] = useState<Language>('en');
  const [token, setToken] = useState('');
  const [state, setState] = useState<'loading' | 'invalid' | 'unavailable' | 'ready' | 'sent' | 'deleted'>('loading');
  const [context, setContext] = useState<Context | null>(null);
  const [displayName, setDisplayName] = useState('');
  const [rating, setRating] = useState<number | null>(null);
  const [body, setBody] = useState('');
  const [consentPublic, setConsentPublic] = useState(false);
  const [consentMedia, setConsentMedia] = useState(false);
  const [uploads, setUploads] = useState<Upload[]>([]);
  const [message, setMessage] = useState('');
  const [busy, setBusy] = useState(false);
  const t: Copy = copy[language];

  // The token moves from the URL into memory so it does not linger in history or referrers.
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const value = params.get('t') ?? '';
    const initialLanguage: Language = params.get('lang') === 'zh' || navigator.language.toLowerCase().startsWith('zh') ? 'zh' : 'en';
    window.history.replaceState({}, '', '/review');
    let cancelled = false;
    void fetch(`/api/reviews?t=${encodeURIComponent(value)}`, { cache: 'no-store' })
      .then(async (response) => {
        if (cancelled) return;
        setLanguage(initialLanguage);
        setToken(value);
        if (response.status === 404) return setState('invalid');
        if (!response.ok) return setState('unavailable');
        const data = (await response.json()) as Context;
        setContext(data);
        setDisplayName(data.firstName);
        setState('ready');
      })
      .catch(() => {
        if (!cancelled) setState('unavailable');
      });
    return () => {
      cancelled = true;
    };
  }, []);

  function updateUpload(key: string, patch: Partial<Upload>) {
    setUploads((current) => current.map((item) => (item.key === key ? { ...item, ...patch } : item)));
  }

  async function addFiles(files: FileList | null) {
    if (!files || !context) return;
    setMessage('');
    const { upload } = await import('@vercel/blob/client');
    let images = uploads.filter((item) => item.kind === 'image').length;
    let videos = uploads.length - images;
    for (const original of Array.from(files)) {
      const kind: ReviewMediaKind = original.type.startsWith('video/') ? 'video' : 'image';
      const allowed = kind === 'video' ? context.videoEnabled && VIDEO_TYPES.includes(original.type) : IMAGE_TYPES.includes(original.type) || original.type.startsWith('image/');
      if (!allowed) {
        setMessage(t.fileType);
        continue;
      }
      if (kind === 'image' && ++images > REVIEW_LIMITS.images) {
        setMessage(t.tooManyImages);
        continue;
      }
      if (kind === 'video' && ++videos > REVIEW_LIMITS.videos) {
        setMessage(t.tooManyVideos);
        continue;
      }
      const key = crypto.randomUUID();
      setUploads((current) => [...current, { key, name: original.name, kind, progress: 0 }]);
      try {
        let file = original;
        let width: number | null = null;
        let height: number | null = null;
        let durationSeconds: number | null = null;
        if (kind === 'image') {
          ({ file, width, height } = await compressImage(original));
          if (file.size > REVIEW_LIMITS.imageBytes) throw new Error(t.fileTooLarge);
        } else {
          if (file.size > REVIEW_LIMITS.videoBytes) throw new Error(t.fileTooLarge);
          const duration = await videoDuration(file);
          if (duration > REVIEW_LIMITS.videoSeconds + 0.5) throw new Error(t.videoTooLong);
          durationSeconds = Math.round(duration);
        }
        const blob = await upload(`${reviewMediaPrefix(context.bookingId)}${key}.${extension(file.type)}`, file, {
          access: 'public',
          handleUploadUrl: '/api/reviews/upload',
          clientPayload: JSON.stringify({ t: token, kind }),
          contentType: file.type,
          onUploadProgress: ({ percentage }) => updateUpload(key, { progress: percentage }),
        });
        updateUpload(key, { progress: 100, result: { url: blob.url, pathname: blob.pathname, width, height, durationSeconds } });
      } catch (error) {
        const known = error instanceof Error && Object.values(t).includes(error.message as never);
        updateUpload(key, { error: known ? (error as Error).message : t.uploadFailed });
      }
    }
  }

  async function submit(event: SubmitEvent<HTMLFormElement>) {
    event.preventDefault();
    const media = uploads.filter((item) => item.result);
    if (!displayName.trim() || !body.trim() || !consentPublic || (media.length > 0 && !consentMedia)) {
      setMessage(t.invalidForm);
      return;
    }
    setBusy(true);
    setMessage('');
    try {
      const response = await fetch('/api/reviews', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          t: token,
          displayName,
          rating,
          body,
          language,
          consentPublic,
          consentMedia,
          media: media.map((item) => ({ kind: item.kind, ...item.result })),
        }),
      });
      if (response.ok) setState('sent');
      else setMessage(t.submitFailed);
    } catch {
      setMessage(t.submitFailed);
    } finally {
      setBusy(false);
    }
  }

  async function remove() {
    if (!window.confirm(t.confirmDelete)) return;
    setBusy(true);
    try {
      const response = await fetch(`/api/reviews?t=${encodeURIComponent(token)}`, { method: 'DELETE' });
      if (response.ok) setState('deleted');
      else setMessage(t.submitFailed);
    } finally {
      setBusy(false);
    }
  }

  const uploading = uploads.some((item) => !item.result && !item.error);
  const sessionLabel = context
    ? `${language === 'zh' ? context.venueNameZh || context.venueName : context.venueName} · ${context.date} ${context.startTime}–${context.endTime}`
    : '';

  return (
    <main className="review-page">
      <div className="review-card">
        <div className="review-head">
          <p className="eyebrow muted">Tennis Match</p>
          <button type="button" className="review-lang" onClick={() => setLanguage(language === 'zh' ? 'en' : 'zh')}>
            {t.switchLanguage}
          </button>
        </div>
        <h1>{t.title}</h1>
        {state === 'loading' ? <p>{t.loading}</p> : null}
        {state === 'invalid' ? <p>{t.invalid}</p> : null}
        {state === 'unavailable' ? <p>{t.unavailable}</p> : null}
        {state === 'sent' ? <p className="review-success">{t.thanks}</p> : null}
        {state === 'deleted' ? <p className="review-success">{t.deleted}</p> : null}
        {state === 'ready' && context ? (
          <>
            <p className="review-session">
              <small>{t.session}</small>
              {sessionLabel}
            </p>
            {context.review ? (
              <div className="review-existing">
                <h2>{t.yourReview}</h2>
                <p className="review-status">
                  {context.review.status === 'pending' ? t.statusPending : context.review.status === 'approved' ? t.statusApproved : t.statusOther}
                </p>
                <p><strong>{context.review.displayName}</strong>{context.review.rating ? ` · ${'★'.repeat(context.review.rating)}` : ''}</p>
                <p className="review-body">{context.review.body}</p>
                {context.review.media.length ? (
                  <div className="review-thumbs">
                    {context.review.media.map((item) =>
                      item.kind === 'image' ? (
                        <img key={item.url} src={item.url} alt="" />
                      ) : (
                        // oxlint-disable-next-line jsx-a11y/media-has-caption -- player-recorded clips have no captions
                        <video key={item.url} src={item.url} preload="metadata" controls playsInline />
                      ),
                    )}
                  </div>
                ) : null}
                <Button variant="destructive" onClick={() => void remove()} disabled={busy}>{t.delete}</Button>
              </div>
            ) : !context.canSubmit ? (
              <p>{t.closed}</p>
            ) : (
              <form className="review-form" onSubmit={(event) => void submit(event)}>
                <label>
                  <span>{t.name}</span>
                  <Input value={displayName} maxLength={REVIEW_LIMITS.nameMax} placeholder={t.namePlaceholder} onChange={(event) => setDisplayName(event.target.value)} />
                </label>
                <fieldset className="review-stars">
                  <legend>{t.rating}</legend>
                  {[1, 2, 3, 4, 5].map((value) => (
                    <button
                      type="button"
                      key={value}
                      aria-label={`${value}/5`}
                      aria-pressed={rating !== null && value <= rating}
                      onClick={() => setRating(rating === value ? null : value)}
                    >
                      <Star size={26} />
                    </button>
                  ))}
                </fieldset>
                <label>
                  <span>{t.body}</span>
                  <textarea
                    className="native-textarea"
                    rows={5}
                    maxLength={REVIEW_LIMITS.bodyMax}
                    placeholder={t.bodyPlaceholder}
                    value={body}
                    onChange={(event) => setBody(event.target.value)}
                  />
                  <small className="review-counter">{body.length}/{REVIEW_LIMITS.bodyMax}</small>
                </label>
                {context.mediaEnabled ? (
                  <div className="review-media">
                    <span>{context.videoEnabled ? t.mediaWithVideo : t.media}</span>
                    <small>{context.videoEnabled ? t.videoHint : t.mediaHint}</small>
                    <label className="review-add">
                      {t.addMedia}
                      <input
                        type="file"
                        multiple
                        accept={context.videoEnabled ? 'image/*,video/mp4,video/quicktime,video/webm' : 'image/*'}
                        onChange={(event) => {
                          void addFiles(event.target.files);
                          event.target.value = '';
                        }}
                      />
                    </label>
                    {uploads.length ? (
                      <ul className="review-uploads">
                        {uploads.map((item) => (
                          <li key={item.key}>
                            <span>{item.name}</span>
                            <small>{item.error ?? (item.result ? '✓' : `${t.uploading} ${Math.round(item.progress)}%`)}</small>
                            <button type="button" aria-label={t.remove} onClick={() => setUploads((current) => current.filter((entry) => entry.key !== item.key))}>
                              <X size={14} />
                            </button>
                          </li>
                        ))}
                      </ul>
                    ) : null}
                  </div>
                ) : null}
                <label className="review-check">
                  <input type="checkbox" checked={consentPublic} onChange={(event) => setConsentPublic(event.target.checked)} />
                  <span>{t.consentPublic}</span>
                </label>
                {uploads.some((item) => item.result) ? (
                  <label className="review-check">
                    <input type="checkbox" checked={consentMedia} onChange={(event) => setConsentMedia(event.target.checked)} />
                    <span>{t.consentMedia}</span>
                  </label>
                ) : null}
                <p className="review-privacy">{t.privacy}</p>
                <Button type="submit" disabled={busy || uploading}>{busy ? t.sending : t.submit}</Button>
              </form>
            )}
          </>
        ) : null}
        {message ? <p className="review-error" role="alert">{message}</p> : null}
      </div>
    </main>
  );
}

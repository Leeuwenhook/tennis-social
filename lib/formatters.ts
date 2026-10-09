import type { GameFormat, PreferredFormat } from '@/lib/demo-data';
import type {
  BookingStatus,
  Language,
  PreferredTime,
  ReservationRequestStatus,
  SessionImportIssueCode,
} from '@/types/tennis';

export function formatMoney(pence: number, language: Language) {
  return new Intl.NumberFormat(language === 'zh' ? 'zh-CN' : 'en-GB', {
    style: 'currency',
    currency: 'GBP',
    maximumFractionDigits: 0,
  }).format(pence / 100);
}

export function formatDate(date: string, language: Language) {
  return new Intl.DateTimeFormat(language === 'zh' ? 'zh-CN' : 'en-GB', {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
    timeZone: 'Europe/London',
  }).format(new Date(`${date}T12:00:00`));
}

export function formatLongDate(date: string, language: Language) {
  return new Intl.DateTimeFormat(language === 'zh' ? 'zh-CN' : 'en-GB', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
    timeZone: 'Europe/London',
  }).format(new Date(`${date}T12:00:00`));
}

export function parseMinutes(time: string) {
  const [hours, minutes] = time.split(':').map(Number);
  return hours * 60 + minutes;
}

export function formatDuration(startTime: string, endTime: string, language: Language) {
  const minutes = Math.max(0, parseMinutes(endTime) - parseMinutes(startTime));
  const hours = Math.floor(minutes / 60);
  const remainder = minutes % 60;
  if (language === 'zh') {
    return hours ? `${hours}小时${remainder ? ` ${remainder}分钟` : ''}` : `${remainder}分钟`;
  }
  return hours ? `${hours}h${remainder ? ` ${remainder}m` : ''}` : `${remainder}m`;
}

export function formatNames(
  formats: GameFormat[],
  labels: { singles: string; doubles: string },
) {
  return formats.map((format) => labels[format]).join(' · ');
}

export function preferredFormatName(
  format: PreferredFormat,
  labels: { singles: string; doubles: string; both: string },
) {
  return labels[format];
}

export function preferredTimeLabel(
  value: PreferredTime,
  t: {
    weekends: string;
    weekdayEvenings: string;
    anytime: string;
    mornings: string;
    afternoons: string;
  },
) {
  const labels: Record<PreferredTime, string> = {
    weekends: t.weekends,
    weekday_evenings: t.weekdayEvenings,
    anytime: t.anytime,
    mornings: t.mornings,
    afternoons: t.afternoons,
  };
  return labels[value];
}

export function bookingStatusLabel(
  status: BookingStatus,
  labels: Record<
    'bookingConfirmed' | 'pendingPayment' | 'expired' | 'paymentFailedStatus' | 'refunded' | 'cancelled',
    string
  >,
) {
  switch (status) {
    case 'confirmed':
      return labels.bookingConfirmed;
    case 'pending_payment':
      return labels.pendingPayment;
    case 'expired':
      return labels.expired;
    case 'payment_failed':
      return labels.paymentFailedStatus;
    case 'refunded':
      return labels.refunded;
    case 'cancelled':
      return labels.cancelled;
  }
}

export function importIssueLabel(code: SessionImportIssueCode, language: Language) {
  const labels: Record<SessionImportIssueCode, string> =
    language === 'zh'
      ? {
          venue: '场地名称',
          date: '日期',
          startTime: '开始时间',
          endTime: '结束时间',
          timeRange: '结束时间须晚于开始时间',
          description: '活动介绍',
          price: '价格',
          capacity: '名额',
          formats: '比赛形式',
          seekingLevels: '寻找水平',
          status: '状态',
          row: '行结构',
          duplicate: '重复场次',
        }
      : {
          venue: 'venue name',
          date: 'date',
          startTime: 'start time',
          endTime: 'end time',
          timeRange: 'end time must be later than start time',
          description: 'description',
          price: 'price',
          capacity: 'capacity',
          formats: 'format',
          seekingLevels: 'seeking levels',
          status: 'status',
          row: 'row structure',
          duplicate: 'duplicate schedule',
        };
  return labels[code];
}

export function requestStatusLabel(
  status: ReservationRequestStatus,
  labels: {
    pendingRequest: string;
    reviewingRequest: string;
    completedRequest: string;
    cancelled: string;
  },
) {
  if (status === 'reviewing') return labels.reviewingRequest;
  if (status === 'completed') return labels.completedRequest;
  if (status === 'cancelled') return labels.cancelled;
  return labels.pendingRequest;
}

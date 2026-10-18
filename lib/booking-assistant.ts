import { slotsForTimeRange, slotsFromText } from './partner-request-slots';

export function assistantPreferredSlots(draft: BookingAssistantDraft, userText = '') {
  const schedule = slotsForTimeRange(draft.startTime ?? '', draft.endTime ?? '');
  if (draft.venueBookingStatus === 'booked') return schedule;
  return draft.preferredSlots?.length ? draft.preferredSlots : schedule.length ? schedule : slotsFromText(userText);
}

export type BookingAssistantDraft = {
  venueBookingStatus?: 'booked' | 'not_booked' | 'unknown' | null;
  venueName?: string | null;
  postcode?: string | null;
  preferredSlots?: string[] | null;
  preferredDate?: string | null;
  startTime?: string | null;
  endTime?: string | null;
  contactName?: string | null;
  email?: string | null;
  phone?: string | null;
  message?: string | null;
  needsPartner?: boolean | null;
  tennisLevel?: string | null;
  gameFormat?: 'singles' | 'doubles' | null;
  /** Required details have been summarized and are ready for the user to submit. */
  complete?: boolean;
};

export function hasPartnerDetails(draft: BookingAssistantDraft) {
  return (
    draft.needsPartner === false ||
    (draft.needsPartner === true &&
      Boolean(draft.tennisLevel) &&
      Boolean(draft.gameFormat))
  );
}

export function isBookingConfirmation(content: string) {
  const value = content
    .trim()
    .toLowerCase()
    .replace(/[.!。！]+$/u, '')
    .trim();
  return [
    '确认',
    '确认提交',
    '确认并提交',
    'confirm',
    'confirm and submit',
  ].includes(value);
}

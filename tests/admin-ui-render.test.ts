import assert from 'node:assert/strict';
import { test } from 'node:test';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { AdminApp } from '../components/admin/admin-app';
import { AdminView, type AdminViewProps } from '../components/admin/admin-view';
import { RosterList } from '../components/admin/admin-overview';
import { AdminVenuesTab } from '../components/admin/admin-venues-tab';
import { emptyVenueDraft } from '../lib/tennis-utils';
import { translations } from '../lib/translations';

void test('admin SSR has its own shell without the public sign-in/register controls', () => {
  const html = renderToStaticMarkup(createElement(AdminApp));
  assert.match(html, /Tennis Match/);
  assert.equal(html.includes('register'), false);
  assert.equal(html.includes('site-user-menu'), false);
});
void test('authenticated admin renders bilingual mobile tab choices without unloaded summary zeroes', () => {
  for (const language of ['en', 'zh'] as const) {
    const props = {
      adminAuthChecked: true, adminAuthenticated: true, adminTab: 'overview', language, t: translations[language],
      reservationRequests: [], venueList: [], activeBookings: [], publishedCount: 0, openSpots: 0,
    } as unknown as AdminViewProps;
    const html = renderToStaticMarkup(createElement(AdminView, props));
    assert.match(html, /admin-tab-select/);
    assert.ok(html.includes(language === 'zh' ? '操作记录' : 'Activity'));
    assert.equal(html.includes('admin-stats'), false);
  }
});
void test('roster renders names, levels, contacts, amounts and pending status safely in both languages', () => {
  for (const language of ['en', 'zh'] as const) {
    const html = renderToStaticMarkup(createElement(RosterList, { language, roster: [{
      id: 'b', contactName: '<script>Ana</script>', email: 'ana@example.test', phone: '07000', participants: ['3.0', '3.5'],
      participantCount: 2, format: 'doubles', totalPence: 1200, status: 'pending_payment',
    }] }));
    assert.match(html, /&lt;script&gt;Ana/);
    assert.match(html, /ana@example.test/);
    assert.match(html, /3.0 \/ 3.5/);
    assert.match(html, /12/);
    assert.ok(html.includes(language === 'zh' ? '付款中' : 'paying'));
  }
});
void test('venue tab offers archive for used venues, restore for archived ones and shows field errors', () => {
  const base = { nameZh: 'x', areaZh: 'x', photo: '/a.jpg', photos: ['/a.jpg'], peakPricePence: 1200, offPeakPricePence: 800 };
  const venueList = [
    { ...base, id: 'used', name: 'Used Park', area: 'Hackney', sessionCount: 3, futureSessionCount: 2, requestCount: 0, updatedAt: '2026-10-20T09:00:00.000Z' },
    { ...base, id: 'unused', name: 'Quiet Park', area: 'Bow', sessionCount: 0, futureSessionCount: 0, requestCount: 0 },
    { ...base, id: 'old', name: 'Old Park', area: 'Mile End', sessionCount: 1, requestCount: 0, archivedAt: '2026-10-01T00:00:00.000Z' },
  ];
  for (const language of ['en', 'zh'] as const) {
    const t = translations[language];
    const props = {
      venueList, language, t, adminBusy: false, adminMessage: t.venueFixFields, venueEditorOpen: true,
      venueDraft: { ...emptyVenueDraft(venueList), peakPrice: '7.999' }, setVenueDraft: () => {},
      venueFieldIssues: ['name', 'peakPrice', 'courtCount'],
    } as unknown as AdminViewProps;
    const html = renderToStaticMarkup(createElement(AdminVenuesTab, props));
    assert.ok(html.includes(t.archiveVenue));
    assert.ok(html.includes(t.restoreVenue));
    assert.ok(html.includes(t.venueUsedBySessions.replace('{count}', '3')));
    assert.ok(html.includes(t.venueUpcomingSessions.replace('{count}', '2')));
    assert.ok(html.includes(t.archivedVenues.replace('{count}', '1')));
    assert.ok(html.includes(t.venuePriceNote));
    assert.ok(html.includes(t.venueNameRequired));
    assert.ok(html.includes(t.venuePriceInvalid));
    assert.ok(html.includes(t.venueCourtCountInvalid));
    assert.equal(html.includes(t.venueAreaRequired), false);
    assert.equal((html.match(/aria-invalid="true"/g) ?? []).length, 3);
    // The used venue shows Archive, so only the unused one has a Delete button.
    assert.equal(html.split(`</svg> ${t.delete}<`).length - 1, 1);
  }
});

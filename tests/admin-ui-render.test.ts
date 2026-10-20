import assert from 'node:assert/strict';
import { test } from 'node:test';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { AdminApp } from '../components/admin/admin-app';
import { AdminView, type AdminViewProps } from '../components/admin/admin-view';
import { RosterList } from '../components/admin/admin-overview';
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

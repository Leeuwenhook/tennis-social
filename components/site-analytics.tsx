'use client';

import { Analytics, type BeforeSendEvent } from '@vercel/analytics/react';

/**
 * Drops the query string before an analytics event leaves the browser: our
 * URLs can carry booking ids, Stripe checkout ids and signed review tokens.
 */
export function stripQuery(event: BeforeSendEvent): BeforeSendEvent {
  return { ...event, url: event.url.split('?')[0].split('#')[0] };
}

/** Vercel Web Analytics with an explicit route, so query-string views count separately. */
export function SiteAnalytics({ route, path }: { route: string; path: string }) {
  return <Analytics route={route} path={path} beforeSend={stripQuery} />;
}

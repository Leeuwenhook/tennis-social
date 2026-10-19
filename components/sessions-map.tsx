'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import type { Map as LeafletMap } from 'leaflet';

import type { Venue } from '@/lib/demo-data';
import { formatDate } from '@/lib/formatters';
import { findPostcode, geocodePostcodes } from '@/lib/postcode-geo';
import { availableSpots, dateFromToday, getVenue } from '@/lib/tennis-utils';
import type { Translations } from '@/lib/translations';
import type { Language, Session } from '@/types/tennis';

const copy = {
  en: {
    kicker: 'This week',
    title: 'Courts on the map',
    intro: 'Every session in the next 7 days. Tap a pin to see times and book.',
    loading: 'Loading map…',
    error: 'The map could not load. The session list below still works.',
    empty: 'No sessions with a mapped venue this week yet.',
  },
  zh: {
    kicker: '本周',
    title: '场地地图',
    intro: '未来 7 天的所有场次。点地图上的标记查看时间并报名。',
    loading: '地图加载中…',
    error: '地图加载失败，下方场次列表不受影响。',
    empty: '本周还没有能显示在地图上的场次。',
  },
} as const;

type VenueGroup = { venue: Venue; postcode: string; sessions: Session[] };

/** Groups next-7-day sessions by venue, keeping the venue's best-known postcode. */
export function weekVenueGroups(sessions: Session[], venueList: Venue[], today = dateFromToday(0)) {
  const lastDay = new Date(`${today}T12:00:00Z`);
  lastDay.setUTCDate(lastDay.getUTCDate() + 6);
  const last = lastDay.toISOString().slice(0, 10);
  const groups = new Map<string, VenueGroup>();
  for (const session of sessions) {
    if (session.date < today || session.date > last) continue;
    const venue = getVenue(session.venueId, venueList);
    const group = groups.get(venue.id) ?? {
      venue,
      postcode: findPostcode(venue.postcode ?? '', venue.address ?? '', venue.area),
      sessions: [],
    };
    group.sessions.push(session);
    groups.set(venue.id, group);
  }
  return [...groups.values()];
}

function popupContent(group: VenueGroup, language: Language, t: Translations, onOpenSession: (id: string) => void) {
  const root = document.createElement('div');
  root.className = 'cs-map-popup';
  const title = document.createElement('strong');
  title.textContent = language === 'zh' ? group.venue.nameZh || group.venue.name : group.venue.name;
  root.append(title);
  for (const session of group.sessions) {
    const spots = availableSpots(session);
    const button = document.createElement('button');
    button.type = 'button';
    button.textContent = `${formatDate(session.date, language)} ${session.startTime}–${session.endTime} · ${
      spots === 0 ? t.full : `${spots} ${spots === 1 ? t.spotLeft : t.spotsLeft}`
    }`;
    button.addEventListener('click', () => onOpenSession(session.id));
    root.append(button);
  }
  return root;
}

export function SessionsMap({
  sessions,
  venueList,
  language,
  t,
  onOpenSession,
}: {
  sessions: Session[];
  venueList: Venue[];
  language: Language;
  t: Translations;
  onOpenSession: (id: string) => void;
}) {
  const c = copy[language];
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<LeafletMap | null>(null);
  const [visible, setVisible] = useState(false);
  const [state, setState] = useState<'loading' | 'ready' | 'error'>('loading');
  const [mappedCount, setMappedCount] = useState(0);
  const groups = useMemo(() => weekVenueGroups(sessions, venueList), [sessions, venueList]);
  // Popups are built when opened, so they read the latest props without rebuilding the map.
  const popupProps = useRef({ language, t, onOpenSession });
  useEffect(() => {
    popupProps.current = { language, t, onOpenSession };
  }, [language, t, onOpenSession]);

  // Leaflet and the tiles load only once the map scrolls near the viewport.
  useEffect(() => {
    const element = containerRef.current;
    if (!element || visible) return;
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries.some((entry) => entry.isIntersecting)) setVisible(true);
      },
      { rootMargin: '200px' },
    );
    observer.observe(element);
    return () => observer.disconnect();
  }, [visible]);

  useEffect(() => {
    const element = containerRef.current;
    if (!visible || !element) return;
    let cancelled = false;
    void (async () => {
      try {
        const [{ default: L }, coordinates] = await Promise.all([
          import('leaflet'),
          geocodePostcodes(groups.map((group) => group.postcode)),
        ]);
        if (cancelled) return;
        mapRef.current?.remove();
        const map = L.map(element, { scrollWheelZoom: false }).setView([51.507, -0.1], 11);
        mapRef.current = map;
        L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
          maxZoom: 18,
          attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
        }).addTo(map);
        const points: [number, number][] = [];
        for (const group of groups) {
          const point = coordinates.get(group.postcode);
          if (!point) continue;
          const open = group.sessions.some((session) => availableSpots(session) > 0);
          const icon = L.divIcon({
            className: `cs-map-pin ${open ? '' : 'is-full'}`,
            html: `<span>${group.sessions.length}</span>`,
            iconSize: [30, 30],
            iconAnchor: [15, 15],
          });
          L.marker([point.lat, point.lng], { icon, title: group.venue.name })
            .bindPopup(() => {
              const { language: lang, t: copyT, onOpenSession: openSession } = popupProps.current;
              return popupContent(group, lang, copyT, openSession);
            })
            .addTo(map);
          points.push([point.lat, point.lng]);
        }
        if (points.length) map.fitBounds(points, { padding: [32, 32], maxZoom: 14 });
        setMappedCount(points.length);
        setState('ready');
      } catch {
        if (!cancelled) setState('error');
      }
    })();
    return () => {
      cancelled = true;
      mapRef.current?.remove();
      mapRef.current = null;
    };
  }, [visible, groups]);

  if (!groups.length) return null;

  return (
    <section className="cs-map page-width" aria-labelledby="cs-map-title">
      <div className="cs-map-head">
        <p className="cs-kicker muted">{c.kicker}</p>
        <h2 id="cs-map-title">{c.title}</h2>
        <p>{c.intro}</p>
      </div>
      <div className="cs-map-frame">
        <div ref={containerRef} className="cs-map-canvas" />
        {state !== 'ready' ? (
          <div className="cs-map-status">{state === 'error' ? c.error : c.loading}</div>
        ) : !mappedCount ? (
          <div className="cs-map-status">{c.empty}</div>
        ) : null}
      </div>
    </section>
  );
}

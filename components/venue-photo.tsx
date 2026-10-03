'use client';

import { useState } from 'react';
import ArrowLeft from 'lucide-react/dist/esm/icons/arrow-left.mjs';
import ArrowRight from 'lucide-react/dist/esm/icons/arrow-right.mjs';
import type { Venue } from '@/lib/demo-data';

export function VenuePhoto({
  venue,
  alt,
  className = '',
  controls = true,
}: {
  venue: Venue;
  alt: string;
  className?: string;
  controls?: boolean;
}) {
  const photos = venue.photos?.length ? venue.photos : [venue.photo];
  const [index, setIndex] = useState(0);
  const photo = photos[Math.min(index, photos.length - 1)] ?? venue.photo;

  return (
    <div className={`venue-photo-gallery ${className}`}>
      <img src={photo} alt={alt} />
      {controls && photos.length > 1 ? (
        <div className="venue-photo-controls">
          <button
            type="button"
            aria-label="Previous venue photo"
            onClick={(event) => {
              event.stopPropagation();
              setIndex((current) => (current - 1 + photos.length) % photos.length);
            }}
          >
            <ArrowLeft size={14} />
          </button>
          <span>
            {index + 1}/{photos.length}
          </span>
          <button
            type="button"
            aria-label="Next venue photo"
            onClick={(event) => {
              event.stopPropagation();
              setIndex((current) => (current + 1) % photos.length);
            }}
          >
            <ArrowRight size={14} />
          </button>
        </div>
      ) : null}
    </div>
  );
}

import type { Venue } from './demo-data';

export function generateVenueDescriptions(venue: Venue) {
  const location = [venue.area, venue.address, venue.postcode]
    .filter(Boolean)
    .join(', ');
  const locationZh = [
    venue.areaZh || venue.area,
    venue.addressZh || venue.address,
    venue.postcode,
  ]
    .filter(Boolean)
    .join('，');
  return {
    description: `Enjoy tennis at ${venue.name || 'the tennis courts'}${location ? ` in ${location}` : ''}.`,
    descriptionZh: `欢迎来到${venue.nameZh || venue.name || '网球场'}打网球${locationZh ? `，场地位于${locationZh}` : ''}。`,
  };
}

export function resolveVenueDescriptions(venue: Venue) {
  const generated = generateVenueDescriptions(venue);
  return {
    description: venue.description?.trim() || generated.description,
    descriptionZh: venue.descriptionZh?.trim() || generated.descriptionZh,
  };
}

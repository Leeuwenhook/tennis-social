-- Venue court details from web research on 2026-10-20.
-- Sources: docs/plans/2026-10-20_venue-court-details.md
-- Only values with confident sources are set; unknown columns are omitted per row.
-- DO NOT RUN without review.

BEGIN;

-- Archbishops Park
UPDATE venues SET court_count = 2, court_setting = 'outdoor', floodlights = false, updated_at = '2026-10-20T22:59:21Z' WHERE id = 'venue-d4032f96-c0a8-4cb7-9f48-dfc7aad74390';
-- Avondale Park (floodlights medium confidence (ClubSpark "floodlit area" + per-court Lighting flag))
UPDATE venues SET court_count = 3, court_setting = 'outdoor', floodlights = true, updated_at = '2026-10-20T22:59:21Z' WHERE id = 'venue-3be0f3eb-6020-4e01-9edc-8fca59a818ef';
-- Barn Elms Sports Centre ("limited floodlight courts"; number of lit courts unknown)
UPDATE venues SET court_count = 16, court_setting = 'outdoor', floodlights = true, updated_at = '2026-10-20T22:59:21Z' WHERE id = 'venue-51452487-af0f-422f-81e8-58e1051c4369';
-- Bethnal Green Gardens
UPDATE venues SET court_count = 4, court_setting = 'outdoor', floodlights = true, updated_at = '2026-10-20T22:59:21Z' WHERE id = 'bethnal-green';
-- Burgess Park (6 of 7 floodlit)
UPDATE venues SET court_count = 7, court_setting = 'outdoor', floodlights = true, updated_at = '2026-10-20T22:59:21Z' WHERE id = 'venue-ab53bc21-450a-4f17-a976-c04229c219c7';
-- Canning Town Rec Ground (floodlights unknown)
UPDATE venues SET court_count = 2, court_setting = 'outdoor', updated_at = '2026-10-20T22:59:21Z' WHERE id = 'venue-5cedf89f-d203-4a0c-bd69-60736f8c9663';
-- Chestnuts Park
UPDATE venues SET court_count = 2, court_setting = 'outdoor', floodlights = false, updated_at = '2026-10-20T22:59:21Z' WHERE id = 'venue-7d968863-8f55-44ce-974d-53f218eab105';
-- Clapham Common (5 of 8 floodlit)
UPDATE venues SET court_count = 8, court_setting = 'outdoor', floodlights = true, updated_at = '2026-10-20T22:59:21Z' WHERE id = 'venue-52978f8c-459a-4ca3-8a3b-fcf0143b2200';
-- Eel Brook Common (floodlights unknown)
UPDATE venues SET court_count = 2, court_setting = 'outdoor', updated_at = '2026-10-20T22:59:21Z' WHERE id = 'venue-7ef70074-06c3-4184-a833-3dd2ce9c8a48';
-- Finsbury Park (6 of 8 floodlit)
UPDATE venues SET court_count = 8, court_setting = 'outdoor', floodlights = true, updated_at = '2026-10-20T22:59:21Z' WHERE id = 'venue-9622eb04-33ea-4f55-988f-541ed843b56b';
-- Geraldine Mary Harmsworth Park
UPDATE venues SET court_count = 2, court_setting = 'outdoor', floodlights = true, updated_at = '2026-10-20T22:59:21Z' WHERE id = 'venue-d11ec70a-b3b2-474a-8d3c-766c321c4b95';
-- Joe White Garden
UPDATE venues SET court_count = 1, court_setting = 'outdoor', floodlights = false, updated_at = '2026-10-20T22:59:21Z' WHERE id = 'venue-70060584-2963-49dd-8bde-5abb4d811d33';
-- Kennington Park (all 5 floodlit)
UPDATE venues SET court_count = 5, court_setting = 'outdoor', floodlights = true, updated_at = '2026-10-20T22:59:21Z' WHERE id = 'venue-f9a37735-6ef8-47c0-94ed-9331e01763cc';
-- Kilburn Grange Park (floodlights unknown)
UPDATE venues SET court_count = 3, court_setting = 'outdoor', updated_at = '2026-10-20T22:59:21Z' WHERE id = 'venue-c11b66c6-4db9-47fb-a1f3-2961080f99d3';
-- King Edward Memorial Park (floodlights unknown; refurb planned 2027)
UPDATE venues SET court_count = 2, court_setting = 'outdoor', updated_at = '2026-10-20T22:59:21Z' WHERE id = 'king-edward-memorial-park';
-- Lee Valley Hockey and Tennis Centre (4 indoor + 6 outdoor; outdoor floodlights unknown)
UPDATE venues SET court_count = 10, court_setting = 'mixed', updated_at = '2026-10-20T22:59:21Z' WHERE id = 'venue-bb9b3cef-19bd-405d-91a9-aeb6265a62f6';
-- Poplar Rec Ground (floodlights unknown)
UPDATE venues SET court_count = 2, court_setting = 'outdoor', updated_at = '2026-10-20T22:59:21Z' WHERE id = 'poplar-rec-ground';
-- Ravenscourt Park (floodlights unknown)
UPDATE venues SET court_count = 7, court_setting = 'outdoor', updated_at = '2026-10-20T22:59:21Z' WHERE id = 'venue-198c620c-23cc-468e-b700-499c241cb6c6';
-- Southwark Park
UPDATE venues SET court_count = 4, court_setting = 'outdoor', floodlights = false, updated_at = '2026-10-20T22:59:21Z' WHERE id = 'venue-0128aa95-1e47-4d94-9519-8aa54c9f5d22';
-- St John's Park
UPDATE venues SET court_count = 2, court_setting = 'outdoor', floodlights = true, updated_at = '2026-10-20T22:59:21Z' WHERE id = 'venue-c9b1dfa7-ec04-4b2c-8b66-ba54779be97c';
-- Stratford Park (all 6 floodlit)
UPDATE venues SET court_count = 6, court_setting = 'outdoor', floodlights = true, updated_at = '2026-10-20T22:59:21Z' WHERE id = 'venue-387ee876-8216-4ea8-b33f-a5fca39280d9';
-- Tanner St Park
UPDATE venues SET court_count = 4, court_setting = 'outdoor', floodlights = false, updated_at = '2026-10-20T22:59:21Z' WHERE id = 'venue-d21a3852-451f-4959-8f37-e5063d7d9e04';
-- Vauxhall Park
UPDATE venues SET court_count = 2, court_setting = 'outdoor', floodlights = false, updated_at = '2026-10-20T22:59:21Z' WHERE id = 'vauxhall-park';
-- Victoria Park (floodlights unverified (Dec 2024 snapshot said none))
UPDATE venues SET court_count = 4, court_setting = 'outdoor', updated_at = '2026-10-20T22:59:21Z' WHERE id = 'victoria-park';

COMMIT;

ALTER TABLE "venues" ADD COLUMN "free_cancellation_hours" integer;

-- Public booking policies checked on 2026-10-21. NULL means no cash-refund
-- window was published (credit/rescheduling only or non-refundable).
UPDATE "venues" SET "free_cancellation_hours" = CASE "id"
  WHEN 'venue-d4032f96-c0a8-4cb7-9f48-dfc7aad74390' THEN 2 -- Archbishop's Park
  WHEN 'venue-ab53bc21-450a-4f17-a976-c04229c219c7' THEN 3 -- Burgess Park
  WHEN 'venue-52978f8c-459a-4ca3-8a3b-fcf0143b2200' THEN 2 -- Clapham Common
  WHEN 'venue-d11ec70a-b3b2-474a-8d3c-766c321c4b95' THEN 3 -- Geraldine Mary Harmsworth Park
  WHEN 'venue-f9a37735-6ef8-47c0-94ed-9331e01763cc' THEN 2 -- Kennington Park
  WHEN 'venue-0128aa95-1e47-4d94-9519-8aa54c9f5d22' THEN 3 -- Southwark Park
  WHEN 'venue-d21a3852-451f-4959-8f37-e5063d7d9e04' THEN 3 -- Tanner St Park
  WHEN 'vauxhall-park' THEN 24
  WHEN 'venue-3be0f3eb-6020-4e01-9edc-8fca59a818ef' THEN 12 -- Avondale Park
  WHEN 'venue-51452487-af0f-422f-81e8-58e1051c4369' THEN 12 -- Barn Elms Sports Centre
  WHEN 'venue-7ef70074-06c3-4184-a833-3dd2ce9c8a48' THEN 12 -- Eel Brook Common
  WHEN 'venue-198c620c-23cc-468e-b700-499c241cb6c6' THEN 12 -- Ravenscourt Park
  WHEN 'venue-9622eb04-33ea-4f55-988f-541ed843b56b' THEN 6 -- Finsbury Park
  WHEN 'venue-70060584-2963-49dd-8bde-5abb4d811d33' THEN 24 -- Joe White Garden
  WHEN 'venue-c11b66c6-4db9-47fb-a1f3-2961080f99d3' THEN NULL -- Kilburn Grange Park
  WHEN 'venue-7d968863-8f55-44ce-974d-53f218eab105' THEN 24 -- Chestnuts Park
  WHEN 'bethnal-green' THEN 24
  WHEN 'king-edward-memorial-park' THEN 24
  WHEN 'poplar-rec-ground' THEN 24
  WHEN 'venue-c9b1dfa7-ec04-4b2c-8b66-ba54779be97c' THEN 24 -- St John's Park
  WHEN 'victoria-park' THEN 24
  WHEN 'venue-5cedf89f-d203-4a0c-bd69-60736f8c9663' THEN 24 -- Canning Town Rec Ground
  WHEN 'venue-387ee876-8216-4ea8-b33f-a5fca39280d9' THEN 24 -- Stratford Park
  WHEN 'venue-bb9b3cef-19bd-405d-91a9-aeb6265a62f6' THEN NULL -- Lee Valley: credit/reschedule only
  ELSE "free_cancellation_hours"
END;

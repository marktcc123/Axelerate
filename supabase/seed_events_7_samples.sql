-- =============================================================================
-- Seven sample rows for public.events (columns: title, description, image_url,
-- location, event_date, min_tier, spots_total, spots_left, gallery_url).
--
-- Run in Supabase Dashboard → SQL → New query.
-- min_tier values match app labels: Member / Elite / Staff / City Manager / Partner
-- (see lib/types.ts: TIER_LABEL_TO_KEY, EVENT_TIER_WEIGHTS).
--
-- If your table uses min_tier_required (enum) instead of min_tier (text), rename
-- the column and use enum values: student, staff, city_manager, partner, etc.
-- =============================================================================

INSERT INTO public.events (
  title,
  description,
  image_url,
  location,
  event_date,
  min_tier,
  spots_total,
  spots_left,
  gallery_url
) VALUES
(
  'UCLA Spring Creator Meetup',
  'In-person meetup for campus creators: content ideas, editing basics, and intro to brand partnerships. Light snacks and Axelerate merch raffle.',
  'https://images.unsplash.com/photo-1523580494863-6f3031224c94?w=1200&q=80',
  'Ackerman Union, UCLA Campus, Los Angeles',
  '2026-05-10 18:00:00+00',
  'Member',
  80,
  54,
  NULL
),
(
  'Elite Night: Brand x Creator Mixer',
  'Elite and above: intimate roundtables with local lifestyle brands and collab opportunities.',
  'https://images.unsplash.com/photo-1511578314322-379afb476865?w=1200&q=80',
  'Santa Monica Pier Area (private lounge)',
  '2026-05-18 20:00:00+00',
  'Elite',
  40,
  22,
  NULL
),
(
  'Staff Workshop: UGC Brief Writing Lab',
  'Staff-only session: break down high-converting briefs, live group rewrites and peer review.',
  'https://images.unsplash.com/photo-1540575467063-178a50c2df87?w=1200&q=80',
  'WeWork Hollywood, Los Angeles',
  '2026-06-02 15:00:00+00',
  'Staff',
  35,
  35,
  NULL
),
(
  'City Manager Summit · LA Chapter',
  'Closed-door City Manager session: regional recap, resource planning, and Q3 campus calendar co-design.',
  'https://images.unsplash.com/photo-1475721027785-f74eccf877e2?w=1200&q=80',
  'Downtown LA — The Bloc Rooftop',
  '2026-06-14 17:30:00+00',
  'City Manager',
  24,
  9,
  NULL
),
(
  'Partner Circle: Product Drop Preview',
  'Partner-only closed preview of next-season Perks picks and feedback session.',
  'https://images.unsplash.com/photo-1556742049-0cfed4f6a45d?w=1200&q=80',
  'Arts District, Los Angeles',
  '2026-06-22 19:00:00+00',
  'Partner',
  16,
  16,
  'https://www.instagram.com/explore/tags/axelerate/'
),
(
  'Coffee & Content: Morning Sprint',
  'For Members: two-hour focused creation block plus coffee. Great for deadlines and batching content.',
  'https://images.unsplash.com/photo-1509042239860-f550ce710b93?w=1200&q=80',
  'Sawtelle Japantown, Los Angeles',
  '2026-04-20 14:00:00+00',
  'Member',
  50,
  41,
  NULL
),
(
  'Campus Pop-Up: Skincare Sampling Day',
  'Open pop-up: K-Beauty trials and check-in tasks; complete for bonus XP (limited capacity).',
  'https://images.unsplash.com/photo-1556228720-195a672e8a03?w=1200&q=80',
  'Westwood Village, Los Angeles',
  '2026-05-03 12:00:00+00',
  'Member',
  120,
  88,
  NULL
);

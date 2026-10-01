-- =============================================================================
-- Elite Foods and Snacks — seed data (TRD section 23)
-- =============================================================================
--
-- PLACEHOLDER PRICES AND DESCRIPTIONS
-- -----------------------------------
-- Only Dodo Ikire's variant prices are given in the PRD. Every other price,
-- description and image below is PLACEHOLDER data pending business
-- confirmation (AGENTS.md section 27). Replace before production use.
--
-- Apply with the Supabase CLI:
--   supabase db reset
-- =============================================================================

-- -----------------------------------------------------------------------------
-- Fried snacks
-- -----------------------------------------------------------------------------
insert into public.products (name, slug, description, category, is_available)
values
  ('Dodo Ikire', 'dodo-ikire',
   'Crunchy fried dough snack. PLACEHOLDER description.',
   'fried-snacks', true),
  ('Akara Chips', 'akara-chips',
   'Crispy chips made from bean cakes. PLACEHOLDER description.',
   'fried-snacks', true),
  ('Chin Chin', 'chin-chin',
   'Sweet crunchy snack. PLACEHOLDER description.',
   'fried-snacks', true),
  ('Puff Puff', 'puff-puff',
   'Soft, spongy fried dough balls. PLACEHOLDER description.',
   'fried-snacks', true)
on conflict (slug) do nothing;

-- -----------------------------------------------------------------------------
-- Nuts and grains
-- -----------------------------------------------------------------------------
insert into public.products (name, slug, description, category, is_available)
values
  ('Kuli Kuli', 'kuli-kuli',
   'Crunchy spiced groundnut snack. PLACEHOLDER description.',
   'nuts-and-grains', true),
  ('Groundnuts', 'groundnuts',
   'Roasted groundnuts. PLACEHOLDER description.',
   'nuts-and-grains', true),
  ('Cashew Nuts', 'cashew-nuts',
   'Roasted cashew nuts. PLACEHOLDER description.',
   'nuts-and-grains', true)
on conflict (slug) do nothing;

-- -----------------------------------------------------------------------------
-- Drinks
-- -----------------------------------------------------------------------------
insert into public.products (name, slug, description, category, is_available)
values
  ('Zobo Drink', 'zobo-drink',
   'Refreshing hibiscus drink. PLACEHOLDER description.',
   'drinks', true),
  ('Tigernut Drink', 'tigernut-drink',
   'Nutty tigernut drink. PLACEHOLDER description.',
   'drinks', true),
  ('Soy Milk Drink', 'soy-milk-drink',
   'Chilled soy milk drink. PLACEHOLDER description.',
   'drinks', true)
on conflict (slug) do nothing;

-- -----------------------------------------------------------------------------
-- Variants
-- -----------------------------------------------------------------------------
-- Dodo Ikire prices come from the PRD. All others are PLACEHOLDER values.
--
-- A product must have at least one valid variant (TRD section 6.3), so every
-- product above gets at least one row here.
--
-- The `where not exists` guard makes this insert safe to re-run.
-- product_variants has no unique constraint on (product_id, label) -- only a
-- NOT NULL on label and a non-unique index -- so without this guard a second
-- run would silently insert a duplicate variant for every row below instead of
-- failing. Mirrors the `on conflict (slug) do nothing` style used above.
insert into public.product_variants (product_id, label, price)
select p.id, v.label, v.price
from public.products p
join (values
  -- Dodo Ikire: PRD section 5.1
  ('dodo-ikire', 'Small', 300),
  ('dodo-ikire', 'Medium', 500),
  ('dodo-ikire', 'Large', 1000),

  -- PLACEHOLDER prices
  ('akara-chips', 'Small', 250),
  ('akara-chips', 'Large', 450),

  ('chin-chin', 'Small', 200),
  ('chin-chin', 'Large', 400),

  ('puff-puff', 'Single', 200),
  ('puff-puff', 'Pack of 6', 1000),

  ('kuli-kuli', 'Small', 300),
  ('kuli-kuli', 'Large', 550),

  ('groundnuts', '100g', 250),
  ('groundnuts', '250g', 600),

  ('cashew-nuts', '100g', 800),
  ('cashew-nuts', '250g', 1900),

  ('zobo-drink', 'Bottle', 500),
  ('zobo-drink', '1L', 900),

  ('tigernut-drink', 'Bottle', 500),
  ('tigernut-drink', '1L', 900),

  ('soy-milk-drink', 'Bottle', 450),
  ('soy-milk-drink', '1L', 850)
) as v(slug, label, price) on v.slug = p.slug
where not exists (
  select 1
  from public.product_variants existing
  where existing.product_id = p.id
    and existing.label = v.label
);

-- -----------------------------------------------------------------------------
-- Availability demo
-- -----------------------------------------------------------------------------
-- Puff Puff starts unavailable so the unavailable state can be reviewed without
-- an admin session. Set to true (or use the admin toggle) once reviewed.
update public.products set is_available = false where slug = 'puff-puff';

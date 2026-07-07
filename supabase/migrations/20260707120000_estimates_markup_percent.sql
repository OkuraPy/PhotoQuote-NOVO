-- Embedded-markup scheme (F11 P0 — "margin leaks"): the internal markup is now folded INTO
-- line_items.unit_price by the app (a multiplier, like the regional one), so every document
-- reconciles: total = subtotal + tax. This column only records WHICH % was embedded, so the
-- editor can recover the pre-markup base price (base = unit_price / (1 + markup_percent/100)).
--
-- margin_rate / margin_percent stay for LEGACY rows (old scheme: the totals trigger added
-- margin on top of subtotal + tax). New estimates write them as 0, so the trigger adds nothing.
alter table estimates add column if not exists markup_percent numeric(6,2) not null default 0;

comment on column estimates.markup_percent is
  'Internal markup % already embedded in line_items.unit_price (new scheme). margin_rate/margin_percent are legacy (margin summed on top by update_estimate_totals) and are written as 0 for new estimates.';

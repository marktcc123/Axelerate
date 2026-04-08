-- Toggle which products appear in the Perks Shop "Friday Night Drop" banner (Table Editor / SQL).
ALTER TABLE public.products
  ADD COLUMN IF NOT EXISTS show_in_friday_night_drop boolean NOT NULL DEFAULT false;

COMMENT ON COLUMN public.products.show_in_friday_night_drop IS
  'When true, product is included in the Friday Night Drop carousel; each row can set its own drop_time for countdown.';

CREATE INDEX IF NOT EXISTS idx_products_show_fn_drop
  ON public.products (show_in_friday_night_drop)
  WHERE show_in_friday_night_drop = true;

-- Match previous behavior: anything already marked as drop or with a drop_time stays visible until you turn it off in the dashboard.
UPDATE public.products
SET show_in_friday_night_drop = true
WHERE is_drop = true OR drop_time IS NOT NULL;

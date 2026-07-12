-- Phase 108: seed the `custom` category referenced by registryMapper / admin defaults.
-- Without this row, inserts with category_id='custom' fail FK (often shown as a generic create error).

insert into public.categories (id, display_name, sort_order)
values ('custom', 'מותאם אישית', 100)
on conflict (id) do update
set
  display_name = excluded.display_name,
  sort_order = excluded.sort_order;

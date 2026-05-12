-- Force PostgREST to reload its schema cache so newly created tables become visible.
-- This fixes PGRST205: "Could not find the table ... in the schema cache".
select pg_notify('pgrst', 'reload schema');

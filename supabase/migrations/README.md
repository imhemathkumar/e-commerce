Apply Supabase migrations and refresh schema

If you see the runtime error: "Could not find the table 'public.addresses' in the schema cache" it means the migration that creates `public.addresses` hasn't been applied to the database used by your frontend (or the schema cache needs reloading).

Quick options:

1) Supabase Dashboard (recommended)
- Open your Supabase project dashboard -> SQL editor.
- Open `supabase/migrations/20250917164827_super_band.sql` in your editor and paste the SQL into the Dashboard SQL editor.
- Run the query.
- The migration includes `NOTIFY pgrst, 'reload schema';` which should prompt the REST API to reload the schema. If not, run:
  NOTIFY pgrst, 'reload schema';

2) psql (remote DB)
- Get your database connection string from Supabase (Settings -> Database -> Connection string).
- Run:

  psql "<CONN_STRING>" -c "SELECT to_regclass('public.addresses');"
  psql "<CONN_STRING>" -f "./supabase/migrations/20250917164827_super_band.sql"
  psql "<CONN_STRING>" -c "NOTIFY pgrst, 'reload schema';"

3) Supabase CLI / local dev
- If using the supabase CLI with a local DB, apply the SQL file (or restart the local Supabase stack):

  supabase stop
  supabase start

Verification
- Ensure env variables in the frontend point to the same DB (VITE_SUPABASE_URL, VITE_SUPABASE_ANON_KEY).
- Try adding an address from the UI again.
- Optionally test via REST API:

  curl -i "https://<project>.supabase.co/rest/v1/addresses?limit=1" -H "apikey: <ANON_KEY>" -H "Authorization: Bearer <ANON_KEY>"

If you need, I can also provide a minimal SQL snippet that only creates the `addresses` table and issues the NOTIFY; tell me if you prefer that instead of running the large migration file.

Troubleshooting: network / "Failed to fetch"
- If you see a browser error or `TypeError: Failed to fetch`, check:
  - That `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` in your environment match the Supabase project you executed the SQL against.
  - Your app is allowed by Supabase CORS / allowed origins (Supabase Dashboard -> API -> Settings -> Allowed origins).
  - Your network / firewall isn't blocking requests to the Supabase endpoint.

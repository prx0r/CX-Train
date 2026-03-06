# Connexion Training Hub – Setup & Usage

## Viewing the Dashboard

### Local development

1. **Install dependencies**
   ```bash
   npm install
   ```

2. **Configure environment**
   - Copy `.env.example` to `.env`
   - Add your Supabase credentials:
     - `NEXT_PUBLIC_SUPABASE_URL`
     - `NEXT_PUBLIC_SUPABASE_ANON_KEY`
     - `SUPABASE_SERVICE_ROLE_KEY`

3. **Run the dev server**
   ```bash
   npm run dev
   ```

4. **Open the app**
   - Home: http://localhost:3000
   - Sign up at http://localhost:3000/sign-up
   - After sign-in you’ll be redirected to the dashboard

### Production (Vercel)

- Live URL: **https://training-jade-ten.vercel.app**
- Ensure Vercel has the same Supabase env vars set
- Redeploy after pushing changes

### Demo data (optional)

To populate realistic example data (Tom, Fernando, Jake, Nathan with differing tenures):

```bash
node scripts/run-demo-seed.mjs
```

Requires `DATABASE_URL` in `.env`. Or run `supabase/seed-demo.sql` in the Supabase SQL Editor.

### First admin user

After the first user signs up, promote them to admin in Supabase SQL Editor:

```sql
UPDATE users SET role = 'admin' WHERE email = 'your@email.com';
```

---

## Linking with ChatGPT (Custom GPT Actions)

### 1. Get the OpenAPI schema

- File: `gpt-actions-openapi.yaml` in the project root

### 2. Configure your Custom GPT

1. Open your GPT in **Configure** → **Actions** → **Add actions**
2. **Import schema**
   - Open `gpt-actions-openapi.yaml` from the project root
   - Copy the **entire file contents** and paste into the Schema field
   - Do **not** paste only the API key – the schema must include the full OpenAPI spec with `servers`, `paths`, etc.
3. **Authentication**
   - Set **Authentication type** to **API Key**
   - **Auth type**: Custom
   - **Header name**: `x-api-key`
   - **Value**: your bot’s API key (from Supabase: `SELECT api_key FROM bots WHERE id = 'call_sim'`)

### 3. API key

Get the key from Supabase:

```sql
SELECT api_key FROM bots WHERE id = 'call_sim';
```

Or from the Supabase Dashboard: **Table Editor** → **bots** → `call_sim` row → `api_key` column.

### 4. Server URL

The schema uses:

```
https://training-jade-ten.vercel.app/api
```

If you use a different deployment URL, update the `servers` section in `gpt-actions-openapi.yaml`.

### 5. Available actions

- **getTraineeProgress** – `GET /progress/{name}?bot_id=call_sim` – Call at session start
- **submitSession** – `POST /session` – Call after the user says “end call”

---

## Troubleshooting

- **"Could not find a valid URL in 'servers'"** – Ensure the schema has a valid `servers` URL and you’re pasting the full YAML, not just the API key.
- **401 Invalid API key** – Confirm the `x-api-key` header matches the bot’s `api_key` in the database.
- **500 on dashboard** – Check Supabase env vars in Vercel and that the `users` table has an `auth_id` column for Supabase Auth.

# CX-Train -- Setup & Usage (OpenRouter MVP)

## Viewing the Dashboard

### Local development

1. **Install dependencies**
   ```bash
   npm install
   ```

2. **Configure environment**
   - Copy `.env.example` to `.env.local`
   - Set your AI provider (default: OpenCode Go):
     - `AI_API_KEY` from [opencode.ai](https://opencode.ai) (Go subscription)
     - Or switch to OpenRouter: uncomment OpenRouter lines in `.env.example`

3. **Test AI connection**
   ```bash
   node scripts/test-openrouter.mjs
   ```

4. **Run the dev server**
   ```bash
   npm run dev
   ```

5. **Open the app**
   - Home: http://localhost:3000
   - Sign up at http://localhost:3000/sign-up
   - After sign-in you'll be redirected to the dashboard

### Production (Vercel)

- Live URL: **https://training-jade-ten.vercel.app**
- Ensure Vercel has the same Supabase env vars set
- Redeploy after pushing changes

### First admin user

After the first user signs up, promote them to admin in Supabase SQL Editor:

```sql
UPDATE users SET role = 'admin' WHERE email = 'your@email.com';
```

---

## Database migrations

If you have an existing database, run new migrations in the Supabase SQL Editor.

---

## Troubleshooting

- **AI 401** -- Check `AI_API_KEY` is set and valid. Run `node scripts/test-openrouter.mjs`.
- **AI 429** -- Rate limited. Wait and retry.
- **500 on dashboard** -- Check Supabase env vars in Vercel.

# Connexion Training Hub — Deploy Guide

## TL;DR — Free & Full Featured

| Service | Cost | What you get |
|---------|------|--------------|
| **Vercel** | Free (Hobby) | Host the app. Your boss visits a URL. No downloads. |
| **Supabase** | Free tier | Database + file storage for screenshots |
| **Clerk** | Free (10k MAU) | Auth, sign-in, roles |

**Yes — admin can edit everything in the dashboard.** System prompts, personalities, pathways, cleared-for-live toggle. It all works the same when deployed.

---

## Vercel vs Cloudflare

| | Vercel | Cloudflare Pages |
|---|--------|------------------|
| **Next.js** | Native, zero config | Needs adapter, some limits |
| **Deploy** | Connect GitHub → Deploy | More setup |
| **Free tier** | Yes | Yes |

**Recommendation:** Use **Vercel** for this Next.js app. It’s built for Next.js and works out of the box. Cloudflare is fine for static sites, but Next.js on Cloudflare needs extra config and can hit compatibility issues.

---

## Step 1: Supabase (Database)

I can’t run Supabase for you — it’s a cloud service. You run the SQL in the dashboard.

### 1.1 Create project

1. Go to [supabase.com](https://supabase.com) → Sign up / Log in
2. **New project** → pick org → name it (e.g. `connexion-hub`)
3. Set a DB password and region → **Create project**
4. Wait for it to finish provisioning

### 1.2 Run schema

1. In the project, open **SQL Editor**
2. **New query**
3. Copy the full contents of `supabase/schema.sql` from this repo
4. Paste into the editor → **Run**
5. New query again
6. Copy the full contents of `supabase/seed.sql`
7. Paste → **Run**

### 1.3 Storage bucket

1. Go to **Storage**
2. **New bucket** → name: `ticket-screenshots`
3. Leave it **private** → Create

### 1.4 Get keys

1. **Project Settings** (gear) → **API**
2. Copy:
   - **Project URL**
   - **anon public** key
   - **service_role** key (keep this secret)

### 1.5 Get API key for GPT

1. **SQL Editor** → New query
2. Run: `SELECT api_key FROM bots WHERE id = 'call_sim';`
3. Copy the value — you’ll use it in the Custom GPT Actions

---

## Step 2: Clerk (Auth)

1. Go to [clerk.com](https://clerk.com) → Sign up / Log in
2. **Create application** → name it (e.g. `connexion-hub`)
3. Enable **Email** (and Google etc. if you want)
4. **API Keys** → copy:
   - Publishable key
   - Secret key
5. **Webhooks** → Add endpoint:
   - URL: `https://YOUR-VERCEL-URL.vercel.app/api/webhooks/clerk` (update after deploy)
   - Events: `user.created`, `user.updated`
   - Copy the **Signing secret**

---

## Step 3: Deploy to Vercel

### 3.1 Push to GitHub

```bash
cd "c:\Users\explo\Documents\1aMachineLearning\Python\training"
git init
git add .
git commit -m "Connexion Training Hub"
# Create repo on github.com, then:
git remote add origin https://github.com/YOUR-USERNAME/connexion-hub.git
git push -u origin main
```

### 3.2 Deploy

1. Go to [vercel.com](https://vercel.com) → Sign in with GitHub
2. **Add New** → **Project**
3. Import the `connexion-hub` repo
4. **Environment Variables** (before deploy):

| Name | Value |
|------|-------|
| `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY` | from Clerk |
| `CLERK_SECRET_KEY` | from Clerk |
| `CLERK_WEBHOOK_SECRET` | from Clerk webhook |
| `NEXT_PUBLIC_SUPABASE_URL` | from Supabase |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | from Supabase |
| `SUPABASE_SERVICE_ROLE_KEY` | from Supabase |
| `NEXT_PUBLIC_APP_URL` | `https://YOUR-PROJECT.vercel.app` |

5. **Deploy**

### 3.3 Update Clerk webhook

1. In Clerk → Webhooks
2. Set the endpoint URL to: `https://YOUR-PROJECT.vercel.app/api/webhooks/clerk`
3. Save

### 3.4 Add allowed origins in Clerk

1. Clerk → **Settings** → **Paths**
2. Add your Vercel URL to allowed origins / redirect URLs if needed

---

## Step 4: First admin user

1. Visit `https://YOUR-PROJECT.vercel.app`
2. Sign up with your email
3. In Supabase **SQL Editor**:

```sql
UPDATE users SET role = 'admin' WHERE email = 'your@email.com';
```

---

## Step 5: Custom GPT

1. Open your Call Simulator GPT → **Configure** → **Actions**
2. Paste the schema from `gpt-actions-openapi.yaml`
3. Set **Authentication** → API Key
4. Header: `x-api-key`
5. Value: the `api_key` from `SELECT api_key FROM bots WHERE id = 'call_sim'`
6. Server URL: `https://YOUR-PROJECT.vercel.app/api`

---

## Share with your boss

Send him:

**https://YOUR-PROJECT.vercel.app**

He opens it in Chrome or Edge. No installs, no downloads. He signs in (or you create his account) and sees the dashboard. If he’s an admin, he gets the full admin view.

---

## Checklist

- [ ] Supabase project created
- [ ] `schema.sql` run
- [ ] `seed.sql` run
- [ ] `ticket-screenshots` bucket created
- [ ] Clerk app created
- [ ] Code pushed to GitHub
- [ ] Vercel project created, env vars set
- [ ] Deployed
- [ ] Clerk webhook URL updated
- [ ] Your user set to admin
- [ ] Custom GPT Actions configured with API key and server URL

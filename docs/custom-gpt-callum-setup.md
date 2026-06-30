# Callum Custom GPT Setup Guide

## Prerequisites

- Deployed Callum backend at a public HTTPS URL
- `CALLUM_ACTIONS_KEY` set as environment variable on the deployment
- Access to ChatGPT Enterprise Custom GPT builder

---

## Step 1: Deploy Backend

Ensure the app is deployed to a public HTTPS domain that ChatGPT servers can reach.

```bash
# Generate a strong API key
openssl rand -hex 32

# Set as environment variable on your deployment
# e.g. Vercel: vercel env add CALLUM_ACTIONS_KEY
# e.g. Render: add to environment variables
```

Verify the deployment is reachable:

```bash
curl -i https://YOUR-DOMAIN.com/api/actions/health
# Expected: 401 (no auth header)

curl -i \
  -H "Authorization: Bearer $CALLUM_ACTIONS_KEY" \
  https://YOUR-DOMAIN.com/api/actions/health
# Expected: 200 {"ok":true,"service":"callum-actions","auth":"valid"}
```

---

## Step 2: Create Custom GPT

1. Go to `https://chatgpt.com/gpts/editor`
2. Click **Create a Custom GPT**
3. Set the **Name**: `Callum — Connexion Helpdesk Assistant`
4. Set the **Description**: `Auditable MSP decision engine for ticket classification, T1/T2 ownership, SLA priority, and escalation guidance.`

---

## Step 3: Paste Instructions

Open the **Instructions** section and paste the contents of `docs/custom-gpt-callum-instructions.md`.

Key points:
- The GPT must call Actions for ticket decisions, not answer from memory
- Never invent taxonomy categories or escalation rules
- Offer to flag answers and create proposals instead of applying changes directly

---

## Step 4: Add Actions

1. Open the **Actions** section
2. Click **Import from URL** or **Import from YAML**
3. Paste the contents of `docs/callum-actions.openapi.yaml`
4. **Important:** Before importing, replace `https://YOUR-CALLUM-DOMAIN.com` with your actual deployed domain

---

## Step 5: Configure Authentication

In the Actions settings:

| Setting | Value |
|---------|-------|
| Authentication type | `API Key` |
| Auth type | `Bearer` |
| API Key | Paste the value of `CALLUM_ACTIONS_KEY` |

Important:
- The key must match exactly what is set on the backend
- Do not leave placeholder text
- The GPT will send: `Authorization: Bearer <your-key>`

---

## Step 6: Test the Configuration

In the GPT Builder preview, paste:

```
Customer says they cannot log in after a password reset. They say it is urgent and they need access today. No other information is in the ticket yet.

Is this T1 or T2 and what should I reply?
```

Expected response includes:
1. Recommended action
2. Classification
3. T1/T2 ownership
4. Missing information
5. Suggested client response
6. SLA reasoning
7. Sources used
8. Confidence
9. Unsupported or inferred claims

---

## Troubleshooting

### GPT Builder says "server URL is not under the expected root origin"

**Cause:** The domain in the OpenAPI schema does not match the domain where the GPT Action is configured to send requests.

**Fix:** Make sure the `servers[0].url` in `callum-actions.openapi.yaml` matches the actual deployed domain exactly.

### Health check returns 401

**Cause:** The API key does not match between the backend env var and the GPT Action settings.

**Fix:** Run `openssl rand -hex 32` to generate a new key, set it in both places, and test with curl.

### Analyse endpoint returns "Unauthorized"

**Cause:** The GPT is sending the wrong API key or the backend is reading a different env var.

**Fix:** 
```bash
# Verify the env var is set on the deployed instance
echo $CALLUM_ACTIONS_KEY

# Test with the exact key
curl -i \
  -H "Authorization: Bearer $CALLUM_ACTIONS_KEY" \
  https://YOUR-DOMAIN.com/api/actions/health
```

---

## Files Reference

| File | Purpose |
|------|---------|
| `lib/actions-auth.ts` | Shared auth helper for all `/api/actions/*` routes |
| `app/api/actions/health/route.ts` | Auth health check endpoint |
| `app/api/actions/ticket-assist/analyse/route.ts` | Main ticket analysis endpoint |
| `app/api/actions/taxonomy/search/route.ts` | Taxonomy search endpoint |
| `app/api/actions/answers/[answerId]/flag/route.ts` | Answer flagging endpoint |
| `app/api/actions/proposals/route.ts` | Change proposal endpoint |
| `docs/callum-actions.openapi.yaml` | OpenAPI 3.1 schema for GPT Actions |
| `docs/custom-gpt-callum-instructions.md` | Custom GPT system prompt |
| `docs/custom-gpt-callum-setup.md` | This file — setup guide |

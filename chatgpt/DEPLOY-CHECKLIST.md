# Deploy checklist (ChatGPT-facing)

- [ ] HTTPS URL (Vercel/Coolify existing path) serving the Next app.
- [ ] Env: `CALLUM_ACTIONS_KEY` set (long random); OpenRouter keys stay
      server-side; never expose provider keys to GPTs.
- [ ] Wire `verifyActionsKey` (lib/callum-auth.ts) into all 14 mapped
      routes — parity checker lists the 10 still missing; rerun to green.
- [ ] Per-manager keys or single shared key? Decide + record (shared key
      is fastest, per-manager is auditable).
- [ ] Publish 3 Custom GPTs (candidate/manager/tech) privately in the
      Enterprise workspace; attach Actions schemas; submit for admin
      approval.
- [ ] Replace `https://YOUR-DOMAIN` in all three yamls with the real host.
- [ ] Smoke each operation from outside (curl with bearer key) before
      any in-client test.
- [ ] Supabase: confirm no ChatGPT path reads it (see SUPABASE-DEPENDENTS.txt);
      taxonomy source-of-truth decision recorded before go-live.

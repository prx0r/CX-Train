# Voice upgrade (typed first, realtime second)

Current: turn-based relay (record → STT → chat → TTS). Works, no barge-in.
Keep as fallback forever — it is also the offline/dev path.

Upgrade path, in order:
1. Keep relay; prove typed ChatGPT flows green (this package).
2. Swap relay transport for Realtime speech-to-speech on the candidate
   call only (biggest realism win; scorer untouched).
3. GPT-Live client delegation as alternative (keep sim brain, add voice).
4. SIP/phone assessments last (needs telephony provider + dispatch).
5. Re-cost per assessment at each step (audio tokens vs Kokoro-cheap);
   caller-quality changes implicate standards versioning — re-freeze
   packs before comparing scores across transports.

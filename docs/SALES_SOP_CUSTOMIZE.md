# Sales SOP — what the AI already knows vs what you should customize

The live coach uses a **built-in SOP** (opening → gatekeeper → discovery → pitch → objection → close) plus your **playbook** from winning calls. You do **not** need to teach the AI your whole business from scratch.

## Already wired in (no input needed)

| Topic | Default in code |
|--------|------------------|
| Offer | $599 one-time website |
| Buyer | Local service businesses with weak/no site (your scraper niches) |
| Geo | San Antonio area |
| Delivery | Live within ~3 days on average |
| Call flow | Full phase SOP + objection matrix |
| Opening style | Niche + area + $599 first; **Apex** only if they ask who you are |
| Compliance | No fake Google guarantees, no pressure, DNC respect |
| Learning | Playbook DB + post-call scoring against same SOP |

## Optional env overrides (Vercel / `.env.local`)

Only set these if the defaults are wrong:

| Variable | Example |
|----------|---------|
| `COACH_COMPANY_NAME` | `Calvo Web` |
| `COACH_OFFER_PRICE` | `599` or `$499` |
| `COACH_OFFER_SUMMARY` | What's included in one sentence |
| `COACH_DELIVERY_DAYS` | `live within 3 days on average` |
| `COACH_PAYMENT_PROCESS` | How you invoice (Stripe link, Zelle, etc.) |
| `COACH_SEND_INFO_URL` | What you text when they want info |
| `COACH_TARGET_GEO` | If you expand beyond San Antonio |

## Worth sending the AI once (copy/paste in chat or add to env)

These **cannot** be guessed and make you top-tier vs generic:

1. **Your exact opener** — the sentence you say when they pick up (if different from SOP).
2. **Proof** — 1–2 example site URLs or “before/after” you text prospects.
3. **What’s included in $599** — pages, revisions, logo, hosting first year?, Google Business help?
4. **Hard no’s** — niches you skip, max drive time, businesses you won’t call.
5. **Close mechanics** — deposit or full pay upfront? contract? refund policy?
6. **Best objection you always win with** — your personal killer line for “too expensive” or “send info”.

If you send those six bullets, we can drop them into `sales-sop.ts` or env in one pass.

## What you do **not** need to provide

- Lead list format (scraper + Supabase)
- Cold call structure (SOP covers it)
- How to use the dialer app
- ML training data exports
- Separate agent per script step (stage router handles it)

## How it works on a call

1. Transcript chunk → **detect stage** (opening, objection, close, …).
2. Inject **that stage’s SOP** + master offer + **playbook lines** for niche.
3. Gemini returns **one line** for you to say.
4. UI shows stage pill (e.g. “Objection”).
5. After call → score vs same SOP → update playbook.

Code: `apps/dialer/src/lib/coach/sales-sop.ts`, `call-stage.ts`, `sales-config.ts`.

# KOL sign-in email — SMTP runbook

**Status:** sign-in is non-functional for real visitors until Step 2 is done.
**Supabase project:** `zmlkduvvlzfgoqzjxzzl` · **Live app:** https://etsyc.vercel.app

## Why it's broken

`/sign-in` calls `supabase.auth.signInWithOtp()` and the user types back a 6-digit code
(`src/lib/auth/actions.ts` in the deployed build — archived at
`.archive/kol-v1-2026-07-22/src/lib/auth/actions.ts`). No custom SMTP was ever configured, so
Supabase is still using its **built-in email service**, which:

- only delivers to addresses belonging to members of the Supabase org, and
- is rate-limited to a couple of messages per hour.

Anyone else asks for a code and it never arrives. This is the only auth path, and it gates
`/account` and `/seller`.

---

### Two failures, one prerequisite

1. **The email is a link, not a code.** Verified in the dashboard on 2026-07-23 — the stock
   *Magic link or OTP* body reads "Your sign-in link / Follow the link below to sign in", with no
   `{{ .Token }}`. The form wants six typed digits and the build has no `/auth/callback` route or
   `exchangeCodeForSession` call, so the link is a dead end too.
2. **Only org members receive anything at all.** The built-in service won't deliver to anyone else.

**These cannot be fixed in either order — the templates are locked.** The dashboard shows
"Set up custom SMTP to edit templates" with the Subject field disabled, and **Enable custom SMTP is
currently off**. Custom SMTP is a hard prerequisite for the template fix, so Steps 0–2 come first
whether you like it or not.

---

## Step 0 — you need a sending domain (the one real blocker)

Resend (and every other real provider) will not send from `etsyc.vercel.app` — you can't add DNS
records to `vercel.app`.

**Checked 2026-07-23: no domain is owned.** Vercel Domains (team `shaianudani-engs-projects`, Hobby)
is empty; there is no Resend account and no Cloudflare account; nothing in the repo and no `vercel`
or `gh` CLI installed. So one has to be bought.

Availability checked the same day: `etsyc.com` **taken**, `shopkol.com` **taken**,
**`kolmakers.com` available at $11.25/yr**. Buying through Vercel keeps DNS in the same dashboard
the app already deploys from, which makes Step 1's records a two-minute job.

Pick one:

| Path | What it costs | Trade-off |
|---|---|---|
| **A. Own a domain** (recommended) | ~$12/yr at Cloudflare/Namecheap | Best deliverability, and you'll want it for launch anyway. Point it at Vercel too. |
| **B. SendGrid Single Sender** | free, 100/day | No domain needed — verify one personal address instead. Sending from an `@gmail.com` address via a third party often lands in spam. Fine for testing, weak for launch. |

The rest of this runbook assumes **Path A with Resend** (the stack named in `CLAUDE.md`). If you go
Path B, only Step 1 changes — the SMTP host/port/user come from SendGrid instead.

---

## Step 1 — Resend: verify the domain, get SMTP credentials

1. https://resend.com/domains → **Add Domain** → enter your domain (use a subdomain like
   `mail.yourdomain.com` so a bad send never harms your root-domain reputation).
2. Resend shows 3 DNS records (MX + two TXT: SPF and DKIM). Add them at your registrar, then hit
   **Verify**. Propagation is usually minutes.
3. https://resend.com/api-keys → **Create API Key**, permission **Sending access**. Copy it once
   (`re_…`) — it is also your SMTP password.

Resend SMTP settings you'll need next:

```
Host:     smtp.resend.com
Port:     465
Username: resend
Password: <your re_… API key>
```

---

## Step 2 — Supabase: turn on custom SMTP

https://supabase.com/dashboard/project/zmlkduvvlzfgoqzjxzzl/auth/smtp
*(if that tab has moved: Authentication → Emails → SMTP Settings)*

Toggle **Enable Custom SMTP**, then fill in:

| Field | Value |
|---|---|
| Sender email | `hello@mail.yourdomain.com` (must be on the verified domain) |
| Sender name | `KOL` |
| Host | `smtp.resend.com` |
| Port | `465` |
| Username | `resend` |
| Password | your `re_…` API key |

Save. **Paste the key straight from Resend into this form — don't route it through chat or a file.**

---

## Step 3 — fix the email templates (this is what usually breaks)

https://supabase.com/dashboard/project/zmlkduvvlzfgoqzjxzzl/auth/templates

These fields stay greyed out until Step 2 is saved. Once SMTP is on, the Subject and Body become
editable.

The stock templates send a **magic link**. The app only accepts a typed code, so a link-only email
is a dead end for the user. Two templates are in play:

- **Magic link or OTP** — sent to returning users.
- **Confirm sign up** — sent on a first-ever sign-in (`shouldCreateUser: true`, so first sign-in
  *is* signup).

Update **both**, or half your users get the wrong email.

For each: set the subject to `Your KOL sign-in code`, and replace the whole message body with the
contents of [kol-otp-email.html](kol-otp-email.html) — a KOL-palette template that shows
`{{ .Token }}` (the 6 digits) and no link. Save each one.

> Quick sanity check after saving: the body must contain `{{ .Token }}` and must **not** contain
> `{{ .ConfirmationURL }}`.

---

## Step 4 — expiry and rate limits

**Authentication → Providers → Email**
(https://supabase.com/dashboard/project/zmlkduvvlzfgoqzjxzzl/auth/providers)

- **Email OTP Expiration** → `600` seconds. The default is an hour, which is a needlessly long
  window for a 6-digit code — and the template you just pasted says "expires in 10 minutes", so
  this makes the copy true.
- **Email OTP Length** → confirm it's `6`. The app's Zod schema hard-rejects anything else
  (`otpCodeSchema` = `/^\d{6}$/`).

**Authentication → Rate Limits**
(https://supabase.com/dashboard/project/zmlkduvvlzfgoqzjxzzl/auth/rate-limits)

- **Rate limit for sending emails** → raise from the built-in default to `100` per hour. Comfortably
  under Resend's free tier (100/day, 3,000/month) as a burst ceiling, and enough that a launch day
  doesn't lock people out. Watch the Resend dashboard and raise the daily plan if real traffic
  approaches it.
- Leave the OTP-verification limit at its default — the app already surfaces a friendly message on
  429 (`friendlySendError` / `friendlyVerifyError`).

---

## Step 5 — verify end to end

1. Open https://etsyc.vercel.app/sign-in in a private window.
2. Enter an address that is **not** a Supabase org member (a friend's, or a `+test` alias on a
   non-member domain).
3. Confirm the email arrives — check https://resend.com/emails for the delivery log if it doesn't.
4. Confirm the email shows six digits, not a link.
5. Type the code → you should land on **`/feed`** (the buyer landing; `handle_new_user` forces
   `role='buyer'` on new accounts).
6. Check the Supabase **auth.users** table for the new row, and **profiles** for the matching
   `role='buyer'` row.

Failure triage:

| Symptom | Cause |
|---|---|
| Nothing arrives, nothing in Resend logs | SMTP not saved, or Supabase still on built-in service |
| Resend log says "domain not verified" | DNS records not propagated — re-verify in Resend |
| Email arrives with a link, no digits | Step 3 not applied to that template (usually **Confirm signup** was missed) |
| "Too many codes requested" | Rate limit from Step 4 still at the built-in default |

---

## One thing to check before your next deploy

The auth code that's live now lives in `.archive/kol-v1-2026-07-22/` on `main`. The current
`apps/kol/` (the Maker's Issue front-end rebuild) has **no** `/sign-in`, `/account`, or `/seller`
route. Whichever directory Vercel builds from decides whether the next deploy keeps auth. Worth
confirming in the Vercel project's **Root Directory** setting before you ship again — this SMTP work
is wasted if the next deploy drops the sign-in page.

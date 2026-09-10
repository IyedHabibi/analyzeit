# Privacy Policy — AnalyzeIt

**Last updated: 9 September 2026**

This is a draft written by the developer. **Have a qualified lawyer read it
before you publish it.** It describes what the software actually does, which is
the part that has been verified; whether the wording satisfies your obligations
in your jurisdiction is not something this document can settle.

---

## The short version

Starting a lesson requires a free account. We store the email address you sign
in with, an optional display name if you choose to set one, and which exercises
you have solved. Nothing else.

There is no password: you sign in with a six-digit code sent to your email, so
there is nothing to leak and nothing for you to remember.

There is no analytics, no tracking, no advertising, no third-party scripts that
watch you, and no cookie banner because there is nothing to consent to beyond
keeping you signed in.

---

## Who is responsible

Iyed Habibi is the data controller.
Contact: through the links in the site footer.

## What is collected, and when

**Before you sign in — nothing.**
Browsing the home page collects nothing at all: no analytics, no page views, no
cookies beyond your light/dark preference. The sign-in service is not even
contacted until you ask to sign in.

**With an account:**

| Data | Why | Where |
|---|---|---|
| Email address | To identify your account and let you sign back in | Supabase (auth) |
| Display name | Only if you set one. Shown to you; not published anywhere | Supabase (account metadata) |
| Which exercises you solved, and when | So your progress follows you between devices | Supabase (`progress` table) |

That is the complete list. There is no avatar, no activity log, no IP log kept
by us, no "last seen", and no record of wrong answers, time spent, or pages
visited. The display name is optional, is shown only back to you, and is not
published anywhere.

## What is not collected

No analytics of any kind. No advertising or marketing trackers. No session
recording. No fingerprinting. No third-party embeds that could observe you. We
do not sell, rent or share your data with anyone, because there is nothing
collected that would be worth selling.

## Cookies

The only browser storage used is:

- `localStorage` for your progress and your light/dark preference — set by the
  page itself, readable only by this site, never transmitted;
- a session token, if you sign in, so you stay signed in.

Both are strictly necessary for functionality you asked for. No advertising or
analytics cookies are set, which is why there is no consent banner.

## Legal basis (GDPR)

- **Contract** — storing your email and progress is necessary to provide the
  account you asked for.
- **Consent** — you choose whether to create an account at all; withdrawn by
  deleting it. Browsing the site without one collects nothing.

## Where your data is held

Account data and progress are stored by **Supabase Inc.**, our hosting
processor, in their EU (Frankfurt) region. Supabase acts on our instructions
under a Data Processing Agreement.

## How long it is kept

Until you delete it. There is no automatic expiry. Delete your account and the
progress rows are removed with it in the same operation.

## Your rights

Under GDPR you may access, correct, export, delete, or restrict processing of
your data, and complain to your local supervisory authority.

Two of these are built into the app rather than requiring you to write to
anyone. Open the account menu in the header:

- **Download a copy** gives you everything held about you as a JSON file.
- **Delete saved progress** removes every progress row from the server.

For full account deletion, including your email address, contact us through the
footer links. We will action it within 30 days.

## Children

This site is not directed at children under 16, and we do not knowingly create
accounts for them.

## Security

Progress rows are protected by PostgreSQL Row Level Security: the database
itself refuses to return or accept a row belonging to a different account. This
is enforced by the database, not by the JavaScript in your browser, so it holds
even if the page code were tampered with. There are no passwords at all: sign-in
is a one-time six-digit code, so there is no password to steal, reuse or leak.

We cannot promise perfect security — nobody honestly can — but the amount of
data at risk is deliberately kept as small as the product allows.

## Changes

If this policy changes materially, the change will be noted here with a new
date. Continuing to use an account after that means you accept the updated
policy.

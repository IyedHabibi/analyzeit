# Privacy Policy — AnalyzeIt

**Last updated: 9 September 2026**

This is a draft written by the developer. **Have a qualified lawyer read it
before you publish it.** It describes what the software actually does, which is
the part that has been verified; whether the wording satisfies your obligations
in your jurisdiction is not something this document can settle.

---

## The short version

You can use AnalyzeIt without an account. If you do, **nothing you do here
leaves your browser** — not your answers, not your progress, not a page view.

If you choose to create an account, we store two things: the email address you
sign in with, and which exercises you have solved. Nothing else.

There is no analytics, no tracking, no advertising, no third-party scripts that
watch you, and no cookie banner because there is nothing to consent to beyond
keeping you signed in.

---

## Who is responsible

Iyed Habibi is the data controller.
Contact: through the links in the site footer.

## What is collected, and when

**Without an account — nothing.**
Your progress is stored in your own browser using `localStorage`. It never
reaches a server. Clearing your browser data deletes it, and we cannot recover
it, because we never had it.

**With an account:**

| Data | Why | Where |
|---|---|---|
| Email address | To identify your account and let you sign back in | Supabase (auth) |
| Password (hashed) | Only if you chose email/password sign-in. Stored hashed by Supabase; never in plain text and never visible to us | Supabase (auth) |
| Google account id and email | Only if you chose Google sign-in | Supabase (auth) |
| Which exercises you solved, and when | So your progress follows you between devices | Supabase (`progress` table) |

That is the complete list. There is no profile, no display name, no avatar, no
activity log, no IP log kept by us, no "last seen", and no record of wrong
answers, time spent, or pages visited.

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
- **Consent** — creating an account is entirely optional, and withdrawn by
  deleting your account.

## Where your data is held

Account data and progress are stored by **Supabase Inc.**, our hosting
processor, in their EU (Frankfurt) region. Supabase acts on our instructions
under a Data Processing Agreement.

If you sign in with Google, Google processes that sign-in under
[their own privacy policy](https://policies.google.com/privacy).

## How long it is kept

Until you delete it. There is no automatic expiry. Delete your account and the
progress rows are removed with it in the same operation.

## Your rights

Under GDPR you may access, correct, export, delete, or restrict processing of
your data, and complain to your local supervisory authority.

Two of these are built into the app rather than requiring you to write to
anyone. Open the account menu in the header:

- **Export my data** downloads everything held about you as a JSON file.
- **Delete my saved progress** removes every progress row from the server.

For full account deletion, including your email address, contact us through the
footer links. We will action it within 30 days.

## Children

This site is not directed at children under 16, and we do not knowingly create
accounts for them.

## Security

Progress rows are protected by PostgreSQL Row Level Security: the database
itself refuses to return or accept a row belonging to a different account. This
is enforced by the database, not by the JavaScript in your browser, so it holds
even if the page code were tampered with. Passwords are hashed by Supabase and
are never visible to us.

We cannot promise perfect security — nobody honestly can — but the amount of
data at risk is deliberately kept as small as the product allows.

## Changes

If this policy changes materially, the change will be noted here with a new
date. Continuing to use an account after that means you accept the updated
policy.

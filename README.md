# Rally v1.0 Foundation

Head-to-head rankings for racket sports. Converted from the single-file
prototype into a production Next.js + TypeScript + Tailwind project.

**Nothing about the app changed.** Same screens, same design, same ELO,
Official and Record rankings, same predictions, same fixtures and seasons. Only
the project *structure* changed, so it can live on a real website and grow.

---

## What's in here

```
src/
├── app/                  Next.js pages (layout, home page, global CSS)
├── core/                 THE RATINGS ENGINE — pure logic, no React
│   ├── constants.ts        START_ELO, K, level tables
│   ├── levels.ts           level-at-a-date lookups
│   ├── elo.ts              level-weighted ELO
│   ├── official.ts         the Official ranking
│   ├── predict.ts          match win probability
│   ├── rank.ts             per-mode ranks, streaks
│   └── types.ts            shared data shapes
├── lib/
│   ├── theme.ts            colours, fonts, shared styles
│   ├── format.ts           small helpers
│   └── storage.ts          ← THE SUPABASE SEAM (see below)
├── data/seed.ts          starting players and match history
└── components/           UI split by area (table, profile, games, compare, settings)
```

### Two things worth knowing

**1. `src/core/` is deliberately separate.** It is plain TypeScript with no
React and no browser code. That means it can later run **server-side**, so
ratings are calculated in one trusted place and can't be faked by a client —
exactly as the architecture document requires. You don't have to do anything
now; it's just already in the right shape.

**2. `src/lib/storage.ts` is where Supabase plugs in.** Right now it saves to
the browser's own storage. That means **data does not sync between people yet** —
your phone and Charlie's phone each keep their own copy. Replacing the three
functions in that one file with Supabase calls is what makes it truly shared.
No other file needs changing.

---

## Supabase setup (do this first)

The app now starts at a Welcome screen and needs Supabase for accounts.
Until the two keys below exist it shows a setup screen rather than a blank page.

1. Go to <https://supabase.com> and create a free account.
2. Click **New project**. Give it a name (e.g. `rally`), set a database
   password, pick the region closest to you, and create it. It takes a minute.
3. In the project, go to **Project Settings → API**. You need two values:
   the **Project URL** and the **anon public** key.
4. In the project folder, create a file called exactly `.env.local`
   (copy `.env.local.example`) and paste them in:

```
NEXT_PUBLIC_SUPABASE_URL=https://xxxxxxxx.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJhbGciOi...
```

5. Install the new dependency and restart:

```bash
npm install
npm run dev
```


### Create the database tables

After adding your keys, open Supabase -> **SQL Editor** -> **New query**, paste
the whole of `supabase/schema.sql` from this project, and click **Run**.

That creates two tables (`leagues` and `league_members`) and the security rules
that stop people reading leagues they don't belong to.

### Turn off email confirmation while testing

By default Supabase emails a confirmation link before an account works. For
your own testing that's a nuisance. In Supabase go to
**Authentication → Providers → Email** and turn **Confirm email** off. Turn it
back on before real people sign up.

### When you deploy to Vercel

Add the same two values in Vercel under **Settings → Environment Variables**.
`.env.local` is git-ignored on purpose, so it never reaches GitHub.

---

## What this version does

- Starts at a **Welcome screen**: Create account / Log in.
- Real Supabase accounts (email + password). Sessions persist across refreshes.
- After login, if you belong to no league: **Create League** or **Join League**.
- **Create** makes a real league in the database and gives it a 6-character
  join code. **Join** takes someone else's code.
- The main Rally app only opens once you're in a league — and it opens
  **empty**, not with the old Seacourt demo data.
- More than one league? You get a picker.

**Known limitation, by design at this stage:** leagues and membership live in
Supabase, but *players and matches inside a league are still stored in the
browser*. So two people in the same league won't see each other's results yet.
Moving that data into Postgres is the next piece of work, and
`src/lib/storage.ts` is the seam where it happens.

## Run it on your own computer (optional)

You need [Node.js](https://nodejs.org) installed (the "LTS" version).

```bash
npm install
npm run dev
```

Then open <http://localhost:3000>.

---

## Putting it on GitHub

GitHub is where the code lives. Vercel reads it from there.

1. Create a free account at <https://github.com>.
2. Click the **+** (top right) → **New repository**.
3. Name it `rally`. Leave it **Private** for now. Don't tick "Add a README"
   (this project already has one). Click **Create repository**.
4. On the next screen choose **uploading an existing file**.
5. Drag in **everything from this project folder** — all the files and the
   `src` folder. Do *not* upload `node_modules` if you have it (the
   `.gitignore` file tells Git to skip it anyway).
6. Scroll down, click **Commit changes**.

That's it — your code is now on GitHub.

> Prefer the command line? From inside the project folder:
> ```bash
> git init
> git add .
> git commit -m "Rally: initial project"
> git branch -M main
> git remote add origin https://github.com/YOUR-USERNAME/rally.git
> git push -u origin main
> ```

---

## Deploying to Vercel (getting a real URL)

1. Go to <https://vercel.com> and **Sign up with GitHub**.
2. Click **Add New… → Project**.
3. Find your `rally` repository and click **Import**.
4. Don't change any settings — Vercel detects Next.js automatically.
5. Click **Deploy**.

After a minute or two you'll get a live URL like `rally-xxxx.vercel.app`.
Send that to anyone and it opens on their phone.

### Updating the site later

Every time you push a change to GitHub, Vercel rebuilds and updates the site
automatically. People just refresh the page to get the new version. That's the
whole update loop:

```
change code → push to GitHub → Vercel redeploys → everyone refreshes
```

---

## What comes next (Stage 2)

In the order recommended:

1. **Deploy this as-is first.** Prove the pipeline works before adding
   anything. This step has no database and no logins on purpose.
2. **Add Supabase authentication** — email login is enough to start. Apple
   sign-in can be switched on before you invite a real number of people (it's
   required if you ever ship an iOS app).
3. **Move the data into Supabase** by reimplementing `src/lib/storage.ts`.
   This is the important one: it's what makes history permanent and shared
   between phones instead of living in each browser.
4. **Test the real loop:** log a match → the other player sees it → they
   confirm → both profiles and the rankings update → close the site → come back
   tomorrow → it's all still there.
5. **Then invite the tester group**, and start caring about backups and bug
   reports.

`.env.local.example` shows the two Supabase values you'll need at step 2.
Copy it to `.env.local` when you get there. Nothing in it is needed today.

### A note on the seed data

`src/data/seed.ts` contains real and estimated match history used to build and
test the app. That's fine for development. Before real people rely on it, don't
present estimated matches as anyone's genuine lifetime record — let people log
their own.

---

## Honest notes

- TypeScript is set to non-strict (`strict: false`). The prototype was written
  in plain JavaScript, and a full strict-typing pass would have meant rewriting
  logic — which risks changing behaviour. This keeps the app identical today
  and lets typing be tightened file by file later.
- Tailwind is installed and configured, but the components still use the
  prototype's inline styles. Both work fine together. Converting styles to
  Tailwind is cosmetic and can be done gradually — it isn't needed to ship.

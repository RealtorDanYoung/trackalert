# TrackAlert — Phoenix Valley Rail Crossing Alerts
### Community-powered railroad crossing status for the Greater Phoenix Metro

---

## What This Is
A mobile-first web app that lets Phoenix Valley commuters report and view real-time
railroad crossing blockages. Community reports auto-expire after 12 minutes.
Covers BNSF and Union Pacific corridors across 30+ crossings in 9 cities.

**Cities covered:** Surprise, El Mirage, Peoria, Glendale, Phoenix, Tempe, Mesa, Gilbert, Chandler

---

## Tech Stack
- **Frontend:** React + Vite (PWA-ready, installable on iOS/Android)
- **Map:** Mapbox GL JS
- **Backend:** Supabase (Postgres + Realtime subscriptions)
- **Hosting:** Vercel (free tier)

---

## Setup: Step by Step

### Step 1 — Get a Mapbox Token (5 min, free)
1. Go to https://account.mapbox.com
2. Create a free account
3. Copy your **Default public token** (starts with `pk.`)

### Step 2 — Set Up Supabase (10 min, free)
1. Go to https://app.supabase.com → New project
2. Give it a name (e.g. "trackalert") and set a database password
3. Once created, go to **SQL Editor** → New query
4. Paste and run the contents of `supabase-schema.sql`
5. Go to **Database → Replication** → enable the `reports` table
6. Go to **Settings → API** → copy your **Project URL** and **anon/public** key

### Step 3 — Configure Environment Variables
```bash
cp .env.example .env.local
```
Edit `.env.local` and fill in:
```
VITE_MAPBOX_TOKEN=pk.your_token_here
VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_ANON_KEY=eyJ...your_anon_key
```

### Step 4 — Run Locally
```bash
npm install
npm run dev
```
Open http://localhost:3000

### Step 5 — Deploy to Vercel (10 min, free)
1. Push this folder to a GitHub repo
2. Go to https://vercel.com → New Project → Import from GitHub
3. In **Environment Variables**, add your three `.env.local` values
4. Click Deploy — your app is live at `trackalert.vercel.app` (or custom domain)

---

## Adding a Custom Domain
In Vercel: Settings → Domains → Add domain
Recommended: `trackalert.com`, `valleyrailalert.com`, or `phoenixtrackwatch.com`
Domain registration: ~$12/year at Namecheap or Google Domains

---

## Making It Installable (PWA)
The app is already PWA-configured. Once deployed:
- **iOS:** Open in Safari → Share → "Add to Home Screen"
- **Android:** Open in Chrome → "Add to Home Screen" prompt appears automatically

This gives users an app icon on their phone without the App Store.

---

## Revenue Path (Owner/Operator)

### Phase 1 — Build the user base (months 1-3)
- Share in East Valley Facebook groups, Nextdoor, Gilbert/Mesa/Chandler community pages
- Post in your KW network — "local living" angle for real estate brand
- Target: 500 active monthly users

### Phase 2 — Monetize (months 3-6)
1. **Local business sponsorships** — "Crossing alert sponsored by [Business]" banner
   Target: auto shops, restaurants near crossings, insurance agents
   Rate: $200-500/month per sponsor
2. **Realtor tool** — license the crossing data overlay to other agents
3. **Premium commuter alerts** — push notifications for $0.99/month

### Phase 3 — Scale / Exit (months 6-18)
1. **Municipal partnership** — pitch to Mesa, Gilbert, Chandler city traffic depts
2. **AZ511 integration** — ADOT has shown interest in crowd-sourced crossing data
3. **Acquisition target** — traffic apps (Waze/Google), local media companies

---

## Crossing Data Source
Base crossing locations derived from FRA Rail Crossing Locator public data.
BNSF Phoenix Subdivision and UP Phoenix Subdivision routing from public railroad records.
FRA crossing IDs included for each location for verification.

To add more crossings: edit `src/data/crossings.js`

---

## Owner Contact
Dan Young · TrackAlert LLC (recommended entity)
Phoenix Valley Realtor · Keller Williams Integrity First Realty
dan@danyoung.realestate

---

*Built with React, Mapbox, and Supabase. Deploy cost: $0/month on free tiers.*

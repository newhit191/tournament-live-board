# Tournament Live Board

Broadcast-style tournament website built with Next.js, Tailwind CSS, and Google Sheets as the source of truth.

## What is included

- Public marketing-style homepage
- Tournament directory with live and history sections
- Tournament overview page
- Big-screen display page for the current featured match
- Match detail page with per-set scores and total-score winner logic
- Admin login gate with a shared backstage password
- Admin tournament list, control room shell, and match control shell
- Google Sheets reader with mock-data fallback for local demo work
- JSON API routes for tournament listing and tournament detail

## Tech stack

- Next.js App Router
- Tailwind CSS v4
- Google Sheets API via `googleapis`

## Quick start

1. Install dependencies

```bash
npm install
```

2. Create your local environment file

```bash
cp .env.example .env.local
```

3. Start the dev server

```bash
npm run dev
```

4. Open [http://localhost:3000](http://localhost:3000)

## Environment variables

- `ADMIN_PASSWORD`
  Shared password for `/admin/login`
- `GOOGLE_SHEETS_SPREADSHEET_ID`
  Spreadsheet that stores tournament data
- `GOOGLE_SHEETS_CLIENT_EMAIL`
  Service account email with access to the spreadsheet
- `GOOGLE_SHEETS_PRIVATE_KEY`
  Service account private key, with newlines escaped as `\n`
- `NEXT_PUBLIC_SITE_URL`
  Optional site URL for deployment metadata

If the Google Sheets variables are missing, the app automatically falls back to local mock tournament data so the UI still works.

## Google Sheet tabs

Create these tabs in one spreadsheet:

- `tournaments`
- `players`
- `matches`
- `match_sets`
- `standings`
- `event_log`

The detailed field plan lives in [docs/plans/2026-03-25-tournament-live-board-design.md](./docs/plans/2026-03-25-tournament-live-board-design.md).

## Current scope

This scaffold focuses on:

- Product structure
- Visual direction
- Routing
- Shared types and score aggregation
- Google Sheets reading
- Admin/public separation

The next implementation step is wiring admin score controls and tournament creation into server actions that write back to Google Sheets.

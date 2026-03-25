# Tournament Live Board Design

## Product Goal

Build a tournament website that feels like an official event site while staying practical for a 1-2 person crew. One operator controls the public display on a big screen, and one operator updates the event from an admin console. The first version should be polished enough to use as a real demo and practical enough to run small events.

The stack will use Next.js, Tailwind CSS, and the Google Sheets API. Google Sheets is the source of truth for tournament data. The web app owns the UI, validation, orchestration, and derived views. The product supports one-on-one competitions with either single elimination or round robin per tournament.

## Core Decisions

- One Google Spreadsheet stores all tournaments.
- The system supports multiple tournaments via `tournament_id`.
- Each tournament uses exactly one format: `single_elimination` or `round_robin`.
- Matches can contain multiple sets, and the winner is decided by the sum of all set scores.
- Admin access uses a single shared password for version one.
- The public site includes current tournaments and historical tournament browsing.
- The public display highlights a featured live match chosen by the admin.

## Google Sheet Structure

Use one spreadsheet with these tabs:

### `tournaments`

One row per tournament.

- `tournament_id`
- `slug`
- `name`
- `format`
- `status`
- `win_score_rule`
- `current_match_id`
- `theme`
- `started_at`
- `ended_at`
- `created_at`
- `updated_at`

### `players`

One row per player entry.

- `player_id`
- `tournament_id`
- `display_name`
- `seed`
- `status`
- `created_at`

### `matches`

One row per match.

- `match_id`
- `tournament_id`
- `round_name`
- `round_order`
- `match_order`
- `player1_id`
- `player2_id`
- `player1_total`
- `player2_total`
- `winner_id`
- `state`
- `is_featured`
- `scheduled_label`
- `updated_at`

### `match_sets`

One row per set inside a match.

- `set_id`
- `match_id`
- `set_no`
- `player1_score`
- `player2_score`
- `note`
- `updated_at`

### `standings`

Primarily for round robin derived rankings.

- `tournament_id`
- `player_id`
- `wins`
- `losses`
- `points_for`
- `points_against`
- `point_diff`
- `rank`
- `updated_at`

### `event_log`

Append-only audit trail for admin actions.

- `log_id`
- `tournament_id`
- `match_id`
- `action`
- `payload`
- `created_at`

## Page Architecture

The site will split into public and admin surfaces.

### Public

- `/`
  Marketing-style landing page with active tournaments and product positioning.
- `/tournaments`
  Browse page showing live, completed, and historical tournaments.
- `/tournaments/[slug]`
  Tournament overview with participants, status, and schedule summary.
- `/tournaments/[slug]/display`
  Big-screen display with a featured match in the center and surrounding schedule context.
- `/tournaments/[slug]/matches/[matchId]`
  Match detail page with set-by-set scores and total scores.

### Admin

- `/admin/login`
  Shared password login.
- `/admin/tournaments`
  Tournament list and creation screen.
- `/admin/tournaments/[id]`
  Tournament control room for players, schedule generation, format state, and featured match selection.
- `/admin/tournaments/[id]/matches/[matchId]`
  Match control page with set editing, direct score entry, and total recalculation.

## Data Flow

Google Sheets is the source of truth. The browser never talks to Google Sheets directly.

1. Admin users interact with Next.js pages under `/admin`.
2. Admin forms call server actions or route handlers in the Next.js app.
3. The server validates the admin session and reads or writes Google Sheets data.
4. The server computes derived state such as match totals, winners, and round robin standings.
5. Public pages fetch normalized data from server-side loaders or route handlers.
6. The display page refreshes on an interval to reflect near-live changes from the admin console.

For score updates, the server updates `match_sets`, recomputes `matches.player1_total` and `matches.player2_total`, sets `winner_id` when one player leads after the intended scoring flow, recalculates standings when needed, and appends an event log entry.

## Initial UX Direction

The visual language should feel like a premium esports broadcast package mixed with a modern event microsite. The display page should be the memorable centerpiece: oversized scoreboards, layered gradients, dramatic typography, and a control-room feel rather than a generic dashboard. Public pages should feel editorial and cinematic. Admin pages should be darker, denser, and optimized for fast operation.

## Error Handling

- Missing or malformed Google Sheets configuration should surface a clear setup state in admin.
- Score update failures should preserve form state and show actionable messages.
- Public pages should degrade gracefully with empty states when tournaments or matches are absent.
- Derived calculations should be centralized to avoid inconsistent totals across pages.

## Testing Strategy

- Unit test score aggregation helpers and bracket generation helpers.
- Unit test round robin standings calculation.
- Smoke test core routes and schema normalization.
- Add at least one integration test path for creating a tournament and updating a match.

## First Implementation Scope

- Scaffold the Next.js app with Tailwind and an App Router structure.
- Create the shared domain types and sheet schema definitions.
- Build the landing page, tournament browse page, overview page, display page, and admin shell.
- Add Google Sheets configuration plumbing and mocked fallback data for local development.
- Implement initial route handlers and helper functions for reading normalized tournament data.

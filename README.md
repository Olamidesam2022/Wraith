# Wraith

Wraith turns repository maintenance risk into a house you can explore. It combines file history and dependency data to surface stale, load-bearing files and areas with frequent fixes.

## Setup

```sh
npm install
npm run dev
```

Open `http://localhost:3000`. To enable authenticated live scans, add a GitHub token to `.env.local` (`GITHUB_TOKEN=`). Create a token from [GitHub settings](https://github.com/settings/personal-access-tokens/new). The scan route uses it only for GitHub GraphQL requests. Never commit `.env.local`.

## Cached snapshots

The bundled fixture keeps the example available before a live snapshot exists. To replace or add a cached example, put a GitHub token in `.env.local`, start the Next.js app, then run:

```sh
npm run snapshot -- owner/repo
```

The command reads `GITHUB_TOKEN` from `.env.local`, calls the local `/api/scan` route, and writes a token-free snapshot under `public/snapshots/`. The example button uses a matching generated snapshot automatically and falls back to the bundled fixture when none exists. `.env.local` is ignored by Git. No live scan is part of setup or build.

## Architecture

- `src/app/` contains the server-renderable App Router pages and the `/api/scan` route.
- `src/scanner/` separates pure import parsing, path resolution, scan selection and snapshot building from GraphQL transport.
- `src/scoring/` computes deterministic file scores, room health and ranked findings from a `RepoSnapshot`.
- `src/house/`, `src/motion/`, `src/exorcism/` and `src/ui/` hold the renderer, animation system, task specs and interface.
- Shared data contracts live in `src/types.ts`; scoring and scan constants live in `src/config.ts`.

## GitHub rate limiting

The per-IP limiter currently stores buckets in process memory. It does not persist across serverless instances, so separate instances can each admit their own request budget. `src/scanner/rateLimit.ts` exposes the `RateLimitStore` interface and `setRateLimitStore()` injection point; replace the default adapter at deploy time with Vercel KV or Upstash Redis to share counters across instances.

## Scoring

Scores range from 0 to 100. Ghost risk combines the normalized number of dependents with the share of file commits by authors inactive in the repository for at least a year and file silence. Cobweb score measures silence. Poltergeist score measures recent fix or revert activity. File risk weights ghost, cobweb and poltergeist scores at 60%, 20% and 20%. Room health falls exponentially as file risk is added.

The scanner caps live scans at 50 files without a visitor token and 400 with one. It reports skipped files, unsupported dependency languages, missing dependency data, and partial history or tree results. JavaScript, TypeScript and Python imports are resolved; other languages receive history-only scoring.

## Tests

```sh
npm test
npm run build
```

## Motion and accessibility

House timelines and the lazy physics layer register with the master motion clock. The clock pauses when the tab is hidden; Calm mode and reduced-motion preferences disable impact motion. The Effects menu controls intensity, physics, ghosts, dust, rain, gravity, earthquake, history replay, room collapse, and a wrecking ball. Physics is capped at 150 bodies and 300 particles, with adaptive quality reduction. Long effects can be skipped with Escape or the visible skip control. House controls support keyboard panning, zoom, reset, room opening, and finding details. Ghosts can be selected, dragged, and thrown; cobweb findings can be torn. The house uses inline SVG and the findings view supports risk, path, and room filters.

The landing includes a Lenis scroll narrative, a `?` shortcut sheet, and an optional synthesized sine cue. Sound starts off; the visitor must turn it on, after which scan actions play a 70 ms cue capped at 0.08 gain. Ambient dust, simple rain, room and ghost impacts, and bats are included. The full cursor-pulled fog field, spider and lantern simulations, room swapping, a complete debris shatter ritual, cursor ember trail, full scroll-scrub story, and route-wide animated transitions are not implemented. These effects need additional interaction and accessibility work; the current play layer prioritizes bounded physics, readable controls, and reduced-motion behavior.

## Licences

- GSAP is used for house timelines under the GSAP standard license: https://gsap.com/standard-license/.
- Lenis is MIT licensed. Motion is MIT licensed (listed in dependencies; not currently used at runtime).
- Fraunces, Inter and IBM Plex Mono are loaded using `next/font/google`, so Next downloads and subsets the font files during build rather than storing font binaries in this repository. The `public/licenses/` files record their SIL Open Font License attribution; retain the upstream licence with any self-hosted font binaries.

## Vercel deployment

Set `GITHUB_TOKEN` in the Vercel project environment for authenticated scans. The `/api/scan` route uses Node.js and sets `maxDuration` to 60 seconds. Scans cap repository tree entries and selected files, batch history queries, and stop issuing GitHub requests after a 55-second request budget; a scan that reaches the deadline returns a generic service error without exposing the token. Vercel plan limits can be lower than 60 seconds, so set `maxDuration` and the request budget in `src/app/api/scan/route.ts` to values supported by the deployment. The limiter is process-local; replace its `RateLimitStore` adapter in `src/scanner/rateLimit.ts` with Vercel KV or Upstash Redis to coordinate across instances. There is no scan proxy outside the Next route.

## Portfolio case study

### Problem

Repository maintenance risk is hidden across commit history and import relationships. Stale, load-bearing files can become risky while still appearing healthy in a file list.

### Design decisions

Wraith uses a dark house metaphor to group files by folder, with distinct shapes and labels alongside color. The list view remains available for direct inspection and filters. Reports include scan limitations so missing dependency data is visible.

### Scoring approach

The scanner separates pure import and path logic from GitHub GraphQL transport. Deterministic scoring combines stale file history, authorship inactivity, dependents and fix churn; the house fixture is scored by the production functions.

### What I learned

Risk explanations need to stay tied to source evidence. Bounded scans, explicit unsupported-language reporting and visible dependents make the visual result easier to trust than a single unexplained health number.

# Wraith

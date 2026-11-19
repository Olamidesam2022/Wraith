# Wraith

Wraith turns repository maintenance risk into a house you can explore. It combines file history and dependency data to surface stale, load-bearing files and areas with frequent fixes.

## Setup

```sh
npm install
npm run dev
```

Open `http://localhost:3000`. To enable authenticated live scans, add a GitHub token to `.env.local` (`GITHUB_TOKEN=`). Create a token from [GitHub settings](https://github.com/settings/personal-access-tokens/new). The scan route uses it only for GitHub GraphQL requests. Never commit `.env.local`.

## Cached snapshots

The cached demo snapshots still need to be generated once a token is set. Start the Next.js app, then run:

```sh
npm run snapshot -- expressjs/express
```

The command reads `GITHUB_TOKEN` from `.env.local`, calls the local `/api/scan` route, and writes a token-free snapshot under `public/snapshots/`. Run it for two or three public repositories to prepare the offline examples. No live scan is part of setup or build.

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

# Wraith

import { NextRequest, NextResponse } from 'next/server';
import { githubGraphql, GithubScanError, scanGithubRepository, type GraphqlTransport } from '@/scanner/github';
import { allowScan } from '@/scanner/rateLimit';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 60;

const scanBudgetMs = 55_000;

export async function POST(request: NextRequest) {
  const forwardedFor = request.headers.get('x-forwarded-for');
  const ip = forwardedFor?.split(',')[0]?.trim() || request.headers.get('x-real-ip') || 'unknown';
  if (!await allowScan(ip)) return NextResponse.json({ error: 'RATE_LIMITED', message: 'Too many scans from this connection. Try again shortly.' }, { status: 429 });

  let body: { repoUrl?: unknown; token?: unknown };
  try { body = await request.json() as typeof body; }
  catch { return NextResponse.json({ error: 'INVALID_REQUEST', message: 'Send a repository URL to scan.' }, { status: 400 }); }
  if (typeof body.repoUrl !== 'string') return NextResponse.json({ error: 'INVALID_REQUEST', message: 'Send a repository URL to scan.' }, { status: 400 });

  const visitorToken = typeof body.token === 'string' && body.token.length <= 500 ? body.token : '';
  const token = visitorToken || process.env.GITHUB_TOKEN || '';
  if (!token) return NextResponse.json({ error: 'TOKEN_REQUIRED', message: 'Add a GitHub token for a live scan, or load a cached example.' }, { status: 401 });

  try {
    const deadline = Date.now() + scanBudgetMs;
    const boundedTransport: GraphqlTransport = (query, accessToken) => {
      const remaining = deadline - Date.now();
      if (remaining <= 0) throw new GithubScanError('GITHUB_ERROR');
      return githubGraphql(query, accessToken, (input, init) => fetch(input, {
        ...init,
        signal: AbortSignal.timeout(remaining),
      }));
    };
    const snapshot = await scanGithubRepository(body.repoUrl, token, boundedTransport, Boolean(token));
    return NextResponse.json({ snapshot });
  } catch (error) {
    if (error instanceof GithubScanError) {
      if (error.code === 'RATE_LIMITED') return NextResponse.json({ error: error.code, message: 'GitHub rate limited this scan. Try a cached example or wait before retrying.' }, { status: 429 });
      if (error.code === 'REPO_NOT_FOUND') return NextResponse.json({ error: error.code, message: 'Repository not found or not publicly accessible.' }, { status: 404 });
    }
    return NextResponse.json({ error: 'GITHUB_ERROR', message: 'GitHub could not complete this scan. Try again shortly.' }, { status: 502 });
  }
}

import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import ScannerExperience from '../../src/ui/ScannerExperience';
import { housePreviewSnapshot } from '../../src/fixtures/houseReport';

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

describe('landing and scanner flow', () => {
  it('loads a bundled offline fixture when no generated example snapshot exists', async () => {
    const fetchMock = vi.fn(async () => new Response(null, { status: 404 }));
    vi.stubGlobal('fetch', fetchMock);
    render(<ScannerExperience />);
    fireEvent.click(screen.getByRole('button', { name: /Try a famous repo/ }));
    expect(await screen.findByText(/Illustrative fixture data/)).toBeTruthy();
    expect(fetchMock).toHaveBeenCalledWith('/snapshots/expressjs-express.json', { cache: 'force-cache' });
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('sends a visitor token only to the scan route and clears the input after success', async () => {
    const privateToken = 'synthetic-token-never-a-real-secret';
    const fetchMock = vi.fn(async (_input: RequestInfo | URL, _init?: RequestInit) => new Response(JSON.stringify({ snapshot: housePreviewSnapshot }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    }));
    vi.stubGlobal('fetch', fetchMock);
    render(<ScannerExperience />);
    fireEvent.change(screen.getByLabelText('Public GitHub repository'), { target: { value: 'https://github.com/owner/repo' } });
    fireEvent.click(screen.getByText('Add a GitHub token for a larger scan'));
    fireEvent.change(screen.getByLabelText('GitHub token'), { target: { value: privateToken } });
    fireEvent.click(screen.getByRole('button', { name: 'Scan repository' }));
    await waitFor(() => expect(screen.getByText(/What the history left behind/)).toBeTruthy());
    const request = fetchMock.mock.calls[0];
    expect(String(request[0])).toBe('/api/scan');
    expect(JSON.parse(String(request[1]?.body))).toMatchObject({ token: privateToken, repoUrl: 'https://github.com/owner/repo' });
    expect(screen.queryByLabelText('GitHub token')).toBeNull();
    expect(Object.keys(localStorage)).toHaveLength(0);
    expect(Object.keys(sessionStorage)).toHaveLength(0);
    expect(document.body.textContent).not.toContain(privateToken);
  });

  it('offers the offline fixture when the scan route reports a rate limit', async () => {
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(new Response(JSON.stringify({ error: 'RATE_LIMITED', message: 'GitHub rate limited this scan.' }), { status: 429 }))
      .mockResolvedValueOnce(new Response(null, { status: 404 }));
    vi.stubGlobal('fetch', fetchMock);
    render(<ScannerExperience />);
    fireEvent.change(screen.getByLabelText('Public GitHub repository'), { target: { value: 'https://github.com/owner/repo' } });
    fireEvent.click(screen.getByRole('button', { name: 'Scan repository' }));
    expect(await screen.findByText('GitHub rate limited this scan.')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Load the offline example' }));
    expect(await screen.findByText(/Illustrative fixture data/)).toBeTruthy();
  });
});

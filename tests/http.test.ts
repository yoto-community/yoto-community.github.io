import { describe, expect, it, vi } from 'vitest';
import { HttpError, fetchJson } from '../scripts/lib/http';

describe('fetchJson', () => {
  it('retries after a 429 and returns the payload', async () => {
    const fetchImpl = vi
      .fn()
      .mockResolvedValueOnce(new Response('', { status: 429, headers: { 'retry-after': '0' } }))
      .mockResolvedValueOnce(new Response(JSON.stringify({ ok: true }), { status: 200 }));

    await expect(
      fetchJson('https://api.github.com/repos/a/b', { token: 't' }, fetchImpl as typeof fetch),
    ).resolves.toEqual({ ok: true });
    expect(fetchImpl).toHaveBeenCalledTimes(2);
  });

  it('throws on a 404 without retrying', async () => {
    const fetchImpl = vi.fn().mockResolvedValue(new Response('', { status: 404 }));
    await expect(
      fetchJson('https://api.github.com/repos/a/b', {}, fetchImpl as typeof fetch),
    ).rejects.toThrow('HTTP 404');
    expect(fetchImpl).toHaveBeenCalledTimes(1);
  });

  it('handles 403 with retries and succeeds', async () => {
    const fetchImpl = vi
      .fn()
      .mockResolvedValueOnce(new Response('', { status: 403, headers: { 'retry-after': '0' } }))
      .mockResolvedValueOnce(new Response(JSON.stringify({ ok: true }), { status: 200 }));

    await expect(
      fetchJson('https://api.github.com/repos/a/b', { token: 't' }, fetchImpl as typeof fetch),
    ).resolves.toEqual({ ok: true });
    expect(fetchImpl).toHaveBeenCalledTimes(2);
  });

  it('throws HttpError after retries exhausted on 403', async () => {
    const fetchImpl = vi
      .fn()
      .mockResolvedValueOnce(new Response('', { status: 403, headers: { 'retry-after': '0' } }))
      .mockResolvedValueOnce(new Response('', { status: 403, headers: { 'retry-after': '0' } }))
      .mockResolvedValueOnce(new Response('', { status: 403, headers: { 'retry-after': '0' } }))
      .mockResolvedValueOnce(new Response('', { status: 403, headers: { 'retry-after': '0' } }));

    await expect(
      fetchJson('https://api.github.com/repos/a/b', { retries: 3 }, fetchImpl as typeof fetch),
    ).rejects.toThrow('HTTP 403 for https://api.github.com/repos/a/b');
    expect(fetchImpl).toHaveBeenCalledTimes(4);
  });

  it('does not produce NaN in retry-after handling', async () => {
    const fetchImpl = vi.fn().mockResolvedValue(
      new Response('', {
        status: 403,
        headers: { 'retry-after': 'invalid' },
      }),
    );

    await expect(
      fetchJson('https://api.github.com/repos/a/b', { retries: 0 }, fetchImpl as typeof fetch),
    ).rejects.toThrow('HTTP 403 for https://api.github.com/repos/a/b');
    expect(fetchImpl).toHaveBeenCalledTimes(1);
  });

  it('treats a negative retries value as zero retries', async () => {
    const fetchImpl = vi
      .fn()
      .mockResolvedValue(new Response('', { status: 403, headers: { 'retry-after': '0' } }));

    await expect(
      fetchJson('https://api.github.com/repos/a/b', { retries: -1 }, fetchImpl as typeof fetch),
    ).rejects.toBeInstanceOf(HttpError);
    expect(fetchImpl).toHaveBeenCalledTimes(1);
  });

  it('treats a NaN retries value as the default retry count', async () => {
    const fetchImpl = vi
      .fn()
      .mockResolvedValue(new Response('', { status: 403, headers: { 'retry-after': '0' } }));

    await expect(
      fetchJson(
        'https://api.github.com/repos/a/b',
        { retries: Number.NaN },
        fetchImpl as typeof fetch,
      ),
    ).rejects.toBeInstanceOf(HttpError);
    expect(fetchImpl).toHaveBeenCalledTimes(4);
  });

  it('parses an HTTP-date retry-after header and retries', async () => {
    const fetchImpl = vi
      .fn()
      .mockResolvedValueOnce(
        // A past HTTP-date yields a negative delay, clamped to zero.
        new Response('', {
          status: 429,
          headers: { 'retry-after': 'Wed, 21 Oct 2015 07:28:00 GMT' },
        }),
      )
      .mockResolvedValueOnce(new Response(JSON.stringify({ ok: true }), { status: 200 }));

    await expect(
      fetchJson('https://api.github.com/repos/a/b', {}, fetchImpl as typeof fetch),
    ).resolves.toEqual({ ok: true });
    expect(fetchImpl).toHaveBeenCalledTimes(2);
  });

  it('caps a far-future HTTP-date retry-after at 30 seconds', async () => {
    vi.useFakeTimers();
    try {
      const fetchImpl = vi
        .fn()
        .mockResolvedValueOnce(
          new Response('', {
            status: 429,
            headers: { 'retry-after': 'Wed, 21 Oct 2037 07:28:00 GMT' },
          }),
        )
        .mockResolvedValueOnce(new Response(JSON.stringify({ ok: true }), { status: 200 }));

      const pending = fetchJson('https://api.github.com/repos/a/b', {}, fetchImpl as typeof fetch);

      await vi.advanceTimersByTimeAsync(29_000);
      expect(fetchImpl).toHaveBeenCalledTimes(1);

      await vi.advanceTimersByTimeAsync(1_000);
      await expect(pending).resolves.toEqual({ ok: true });
      expect(fetchImpl).toHaveBeenCalledTimes(2);
    } finally {
      vi.useRealTimers();
    }
  });
});

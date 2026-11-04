import { describe, expect, it, vi } from 'vitest';
import { checkUrl } from '../scripts/lib/links';

const fetchMock = (responses: Response[]) => {
  const impl = vi.fn();
  for (const response of responses) impl.mockResolvedValueOnce(response);
  return impl;
};

describe('checkUrl', () => {
  it('accepts a 200 HEAD', async () => {
    const fetchImpl = vi.fn().mockResolvedValue(new Response('', { status: 200 }));
    await expect(checkUrl('https://example.com', fetchImpl as typeof fetch)).resolves.toEqual({
      url: 'https://example.com',
      ok: true,
      status: 200,
    });
    expect(fetchImpl).toHaveBeenCalledTimes(1);
  });

  it('probes with HEAD before anything else', async () => {
    const fetchImpl = fetchMock([new Response('', { status: 200 })]);
    await checkUrl('https://example.com', fetchImpl as typeof fetch);
    expect(fetchImpl.mock.calls[0]?.[1]).toMatchObject({ method: 'HEAD' });
  });

  it('retries with GET when HEAD is not allowed', async () => {
    const fetchImpl = fetchMock([
      new Response('', { status: 405 }),
      new Response('', { status: 200 }),
    ]);
    const result = await checkUrl('https://example.com', fetchImpl as typeof fetch);
    expect(result.ok).toBe(true);
    expect(fetchImpl).toHaveBeenCalledTimes(2);
    expect(fetchImpl.mock.calls[1]?.[1]).toMatchObject({ method: 'GET' });
  });

  it.each([403, 501])('retries with GET on %i', async (status) => {
    const fetchImpl = fetchMock([new Response('', { status }), new Response('', { status: 200 })]);
    const result = await checkUrl('https://example.com', fetchImpl as typeof fetch);
    expect(result).toEqual({ url: 'https://example.com', ok: true, status: 200 });
    expect(fetchImpl.mock.calls[1]?.[1]).toMatchObject({ method: 'GET' });
  });

  it('reports a 404 as dead', async () => {
    const fetchImpl = vi.fn().mockResolvedValue(new Response('', { status: 404 }));
    const result = await checkUrl('https://example.com', fetchImpl as typeof fetch);
    expect(result).toMatchObject({ ok: false, status: 404 });
  });

  it('reports a network error as dead', async () => {
    const fetchImpl = vi.fn().mockRejectedValue(new Error('timeout'));
    const result = await checkUrl('https://example.com', fetchImpl as typeof fetch);
    expect(result).toMatchObject({ ok: false, status: 0 });
  });

  it('reports a failed GET after a refused HEAD as dead', async () => {
    const fetchImpl = vi
      .fn()
      .mockResolvedValueOnce(new Response('', { status: 405 }))
      .mockRejectedValueOnce(new Error('timeout'));
    await expect(checkUrl('https://example.com', fetchImpl as typeof fetch)).resolves.toEqual({
      url: 'https://example.com',
      ok: false,
      status: 0,
    });
  });
});

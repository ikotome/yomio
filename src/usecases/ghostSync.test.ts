import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import type { Mock } from 'vitest';

const chromeStub = { runtime: { getURL: (p: string) => p } } as const;
(globalThis as unknown as { chrome?: unknown }).chrome = chromeStub;

// initGhostSyncで使うモジュールのモック
vi.mock('@supabase/supabase-js', () => ({
  createClient: () => ({})
}));

vi.mock('../lib/supabaseHelpers', () => ({
  insertGhostPositions: async () => ({ error: null }),
  fetchGhostPositions: async () => ({ data: [], error: null })
}));


describe('初期化できる', () => {
  let fetchSpy: Mock | undefined;
  let addSpy: unknown;

  beforeEach(() => {
    // 単純なchromeのモック
    (globalThis as unknown as { chrome?: unknown }).chrome = chromeStub;

    const fetchMock = vi.fn().mockResolvedValue({ json: async () => ({ SUPABASE_URL: 'https://x', SUPABASE_ANON_KEY: 'y', SHOW_SELF_GHOST: false }) });
    vi.stubGlobal('fetch', fetchMock);
    fetchSpy = fetchMock as Mock;

  addSpy = vi.spyOn(window, 'addEventListener');
    localStorage.clear();
  });

  afterEach(() => {
    vi.restoreAllMocks();
    localStorage.clear();
  });

  it('例外が発生せず、セッションとリスナーが設定される', async () => {
    const { initGhostSync } = await import('./ghostSync');
    await expect(initGhostSync()).resolves.not.toThrow();
    const sid = localStorage.getItem('ghost_session');
    expect(typeof sid).toBe('string');
  expect((addSpy as { mock?: unknown }).mock).toBeDefined();
  const calls = (addSpy as { mock: { calls: unknown[][] } }).mock.calls.map((c) => c[0]);
  expect(calls).toContain('beforeunload');

    expect(fetchSpy).toHaveBeenCalled();

    window.dispatchEvent(new Event('beforeunload'));
  });
});

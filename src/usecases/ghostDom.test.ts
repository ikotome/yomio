import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';

const chromeStub = { runtime: { getURL: (p: string) => p } } as const;
(globalThis as unknown as { chrome?: unknown }).chrome = chromeStub;


describe('ghostDom', () => {
  beforeEach(() => {
    // ensure a clean DOM
    document.body.innerHTML = '';
  });
  afterEach(() => {
    vi.restoreAllMocks();
    document.body.innerHTML = '';
  });

  it('おばけを追加したり、削除できる', () => {
    return (async () => {
      const mod = await import('./ghostDom');
      const { ghosts, ensureGhostCount, cleanupGhosts } = mod;

      expect(ghosts.length).toBe(0);
      ensureGhostCount(3);
      expect(ghosts.length).toBe(3);
      const imgs = document.querySelectorAll('img.ghost');
      expect(imgs.length).toBe(3);

      // 削除
      ensureGhostCount(1);
      expect(ghosts.length).toBe(1);
      expect(document.querySelectorAll('img.ghost').length).toBe(1);

      // すべて削除
      cleanupGhosts();
      expect(ghosts.length).toBe(0);
      expect(document.querySelectorAll('img.ghost').length).toBe(0);
    })();
  });

  it('MAX_GHOSTSを超えない', () => {
    return (async () => {
      const mod = await import('./ghostDom');
      const { ghosts, ensureGhostCount, cleanupGhosts, MAX_GHOSTS } = mod;
      ensureGhostCount(MAX_GHOSTS + 10);
      expect(ghosts.length).toBe(MAX_GHOSTS);
      cleanupGhosts();
    })();
  });
});

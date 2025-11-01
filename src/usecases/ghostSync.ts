import { createClient, SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '../types/supabase';
import { debounce } from './debounce';
import { ghosts, ensureGhostCount, cleanupGhosts, GHOST_H, GHOST_W, MAX_GHOSTS } from './ghostDom';
import type { GhostInsert, GhostRow } from '../lib/supabaseHelpers';

export async function initGhostSync() {
  try {
    const res = await fetch(chrome.runtime.getURL('config.json'));
    const config = await res.json();
    const SUPABASE_URL = config.SUPABASE_URL;
    const SUPABASE_ANON_KEY = config.SUPABASE_ANON_KEY;
    const showSelfGhost = Boolean(config.SHOW_SELF_GHOST ?? false);

    const supabaseClient: SupabaseClient<Database> = createClient<Database>(SUPABASE_URL, SUPABASE_ANON_KEY);

    const sessionId = localStorage.getItem('ghost_session') || crypto.randomUUID();
    localStorage.setItem('ghost_session', sessionId);
    const currentPage = window.location.href;

    async function sendScrollPosition(stayed = false) {
      const data: GhostInsert = {
        session_id: sessionId,
        page_url: currentPage,
        scroll_top: window.scrollY,
        scroll_left: window.scrollX,
        viewport_height: window.innerHeight,
        viewport_width: window.innerWidth,
        stayed: stayed === true
  } as GhostInsert;
      try {
        const { insertGhostPositions } = await import('../lib/supabaseHelpers');
        const r = await insertGhostPositions(supabaseClient, [data]);
        if (r.error) console.error('Supabase insert error:', r.error);
      } catch (e) {
        console.error('Supabase insert exception:', e);
      }
    }

    const DEBOUNCE_SEND_DELAY = 10000; // ms
    const debouncedSend = debounce(() => sendScrollPosition(true), DEBOUNCE_SEND_DELAY);
    window.addEventListener('scroll', debouncedSend, { passive: true });

    // 初回は現在位置を送る
    sendScrollPosition(false);

    let moveIntervalId: number | null = null;

    async function moveGhosts() {
      try {
        const { fetchGhostPositions } = await import('../lib/supabaseHelpers');
        const q = await fetchGhostPositions(supabaseClient, currentPage, showSelfGhost ? null : sessionId, MAX_GHOSTS);
        if (q.error) {
          console.error('Supabase fetch error:', q.error);
          ensureGhostCount(0);
          return;
        }

  const rows = (q.data || []) as GhostRow[];
        if (!rows.length) {
          ensureGhostCount(0);
          return;
        }

  const latestBySession = new Map<string, GhostRow>();
  rows.forEach((r: GhostRow) => {
          const sid = r.session_id || '__unknown__';
          const cur = latestBySession.get(sid);
          if (!cur) latestBySession.set(sid, r);
          else if (new Date(String(r.created_at)).getTime() > new Date(String(cur.created_at)).getTime()) latestBySession.set(sid, r);
        });

        const show = Array.from(latestBySession.values())
          .sort((a: GhostRow, b: GhostRow) => new Date(String(b.created_at)).getTime() - new Date(String(a.created_at)).getTime())
          .slice(0, MAX_GHOSTS);

        ensureGhostCount(show.length);

        const currentScrollY = window.scrollY;
        const currentScrollX = window.scrollX;

  show.forEach((row: GhostRow, idx: number) => {
          const ghost = ghosts[idx];
          if (!ghost) return;

          const scrollTop = Number(row.scroll_top ?? 0);
          const vh = Number(row.viewport_height) || window.innerHeight;
          const docCenterY = scrollTop + vh / 2;

          const scrollLeft = row.scroll_left != null ? Number(row.scroll_left) : 0;
          const vw = Number(row.viewport_width) || window.innerWidth;
          const docCenterX = scrollLeft + vw / 2;

          const jitterY = (Math.random() * 60 - 30);
          const jitterX = (Math.random() * 120 - 60);

          let top = docCenterY - currentScrollY - GHOST_H / 2 + jitterY;
          let left = docCenterX - currentScrollX - GHOST_W / 2 + jitterX;

          top = Math.max(0, Math.min(top, window.innerHeight - GHOST_H));
          left = Math.max(0, Math.min(left, window.innerWidth - GHOST_W));

          ghost.style.top = `${top}px`;
          ghost.style.left = `${left}px`;
        });
      } catch (err) {
        console.error('moveGhosts error:', err);
      }
    }

    moveIntervalId = setInterval(moveGhosts, 2000);
    const boundMove = moveGhosts.bind(null);
    window.addEventListener('scroll', boundMove);
    window.addEventListener('resize', boundMove);
    moveGhosts();

    function cleanup() {
      if (moveIntervalId) {
        clearInterval(moveIntervalId);
        moveIntervalId = null;
      }
      window.removeEventListener('scroll', boundMove);
      window.removeEventListener('resize', boundMove);
      window.removeEventListener('scroll', debouncedSend as EventListener);
      debouncedSend.cancel?.();
      cleanupGhosts();
    }

    window.addEventListener('beforeunload', () => {
      try { sendScrollPosition(true); } catch { /* ignore */ }
      cleanup();
    });

  } catch (e) {
    console.error('initGhostSync error:', e);
  }
}

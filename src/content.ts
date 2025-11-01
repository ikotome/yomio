// -------------------------------
// キャラクター差し替え用定数
// -------------------------------
import { createClient, SupabaseClient } from '@supabase/supabase-js';
import type { Database } from './types/supabase';

type GhostInsert = Database['public']['Tables']['ghost_positions']['Insert'];
type GhostRow = Database['public']['Tables']['ghost_positions']['Row'];

const GHOST_IMAGE = chrome.runtime.getURL('assets/ghost.svg');
const ghosts: HTMLImageElement[] = [];
const GHOST_W = 60;
const GHOST_H = 60;
const MAX_GHOSTS = 30; // 表示上限

// -------------------------------
// ユーティリティ
// -------------------------------
/** 単純なデバウンス */
type Debounced<T extends unknown[]> = ((...args: T) => void) & { cancel?: () => void };

/** 単純なデバウンス */
function debounce<T extends unknown[]>(fn: (...args: T) => void, wait: number): Debounced<T> {
  let t: ReturnType<typeof setTimeout> | null = null;
  const wrapped = (...args: T) => {
    if (t) clearTimeout(t as ReturnType<typeof setTimeout>);
    t = setTimeout(() => {
      t = null;
      fn(...args);
    }, wait);
  };
  (wrapped as Debounced<T>).cancel = () => {
    if (t) clearTimeout(t as ReturnType<typeof setTimeout>);
    t = null;
  };
  return wrapped as Debounced<T>;
}

function createGhostElement() {
  const g = document.createElement('img');
  g.src = GHOST_IMAGE;
  g.classList.add('ghost');
  Object.assign(g.style, {
    position: 'fixed',
    width: `${GHOST_W}px`,
    height: `${GHOST_H}px`,
    pointerEvents: 'none',
    zIndex: '9999',
    opacity: '1',
    display: 'block',
    left: '0px',
    top: '0px',
    transition: 'top 1.5s ease-in-out, left 1.5s ease-in-out'
  });
  document.body.appendChild(g);
  return g;
}

function ensureGhostCount(n: number) {
  const target = Math.max(0, Math.min(n, MAX_GHOSTS));
  while (ghosts.length < target) ghosts.push(createGhostElement());
  while (ghosts.length > target) {
    const g = ghosts.pop();
    if (g && g.parentNode) g.parentNode.removeChild(g);
  }
}

// -------------------------------
// 初期化（async/await に統一）
// -------------------------------
async function initGhostSync() {
  // 主要な外部リソースの読み込みとクライアント生成
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

    // スクロール位置を送信する（エラーはログのみ）
    async function sendScrollPosition(stayed = false) {
      const data: GhostInsert = {
        session_id: sessionId,
        page_url: currentPage,
        scroll_top: window.scrollY,
        scroll_left: window.scrollX,
        viewport_height: window.innerHeight,
        viewport_width: window.innerWidth,
        stayed: stayed === true
      };
      try {
        const { insertGhostPositions } = await import('./lib/supabaseHelpers');
        const r = await insertGhostPositions(supabaseClient, [data]);
        if (r.error) console.error('Supabase insert error:', r.error);
      } catch (e) {
        console.error('Supabase insert exception:', e);
      }
    }

    // デバウンスして送信
    const DEBOUNCE_SEND_DELAY = 10000; // ms
    const debouncedSend = debounce(() => sendScrollPosition(true), DEBOUNCE_SEND_DELAY);
    window.addEventListener('scroll', debouncedSend, { passive: true });

    // 初回は現在位置を送る
    sendScrollPosition(false);

    // 他ユーザーの位置を取得してゴーストを動かす
    let moveIntervalId: number | null = null;
    async function moveGhosts() {
      try {
        const { fetchGhostPositions } = await import('./lib/supabaseHelpers');
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

  // セッションごとに最新を採用
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

    // 定期的にフェッチ＆移動。アンロード時にクリーンアップする
    moveIntervalId = setInterval(moveGhosts, 2000);
    const boundMove = moveGhosts.bind(null);
    window.addEventListener('scroll', boundMove);
    window.addEventListener('resize', boundMove);
    moveGhosts();

    // ページ外れ時にタイマー/リスナを解除し、要素を片付ける
    function cleanup() {
      if (moveIntervalId) {
        clearInterval(moveIntervalId);
        moveIntervalId = null;
      }
      window.removeEventListener('scroll', boundMove);
      window.removeEventListener('resize', boundMove);
        window.removeEventListener('scroll', debouncedSend as EventListener);
        debouncedSend.cancel?.();
      // DOMからゴーストを削除
      while (ghosts.length) {
        const g = ghosts.pop();
        if (g && g.parentNode) g.parentNode.removeChild(g);
      }
    }

    window.addEventListener('beforeunload', () => {
      // 可能なら最終位置を送る（非同期だが試みる）
      try { sendScrollPosition(true); } catch { /* ignore */ }
      cleanup();
    });

  } catch (e) {
    console.error('initGhostSync error:', e);
  }
}

initGhostSync();

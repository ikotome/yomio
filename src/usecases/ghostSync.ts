import { createClient, SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '../types/supabase';
import { debounce } from './debounce';
import { ghosts, ensureGhostCount, cleanupGhosts, GHOST_H, GHOST_W, MAX_GHOSTS } from './ghostDom';
import type { GhostInsert, GhostRow } from '../lib/supabaseHelpers';

let cachedClient: SupabaseClient<Database> | null = null;

function getSupabaseClient(url: string, anonKey: string): SupabaseClient<Database> {
  if (cachedClient) return cachedClient;
  // 固定 storageKey で同一タブ/再初期化時も同一クライアントを共有
  cachedClient = createClient<Database>(url, anonKey, {
    auth: {
      storageKey: 'yomio-auth',
      // この拡張ではログインを扱わないため、ストレージ衝突を避ける目的で無効化
      persistSession: false,
      autoRefreshToken: false,
      detectSessionInUrl: false
    }
  });
  return cachedClient;
}

export async function initGhostSync(): Promise<() => void> {
  try {
    const res = await fetch(chrome.runtime.getURL('config.json'));
    const config = await res.json();
    const SUPABASE_URL = config.SUPABASE_URL;
    const SUPABASE_ANON_KEY = config.SUPABASE_ANON_KEY;
    const showSelfGhost = Boolean(config.SHOW_SELF_GHOST ?? false);

  const supabaseClient: SupabaseClient<Database> = getSupabaseClient(SUPABASE_URL, SUPABASE_ANON_KEY);

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
  // なめらか移動用の内部状態（目標・現在位置・速度）
  const state: Array<{ x: number; y: number; tx: number; ty: number; vx: number; vy: number } | null> = [];

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
  // state配列の長さ合わせ
  for (let i = state.length; i < ghosts.length; i++) state[i] = null;
  while (state.length > ghosts.length) state.pop();

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

          // ジッターはCSSの微小アニメに任せ、座標は純粋に中心へ
          let top = docCenterY - currentScrollY - GHOST_H / 2;
          let left = docCenterX - currentScrollX - GHOST_W / 2;

          top = Math.max(0, Math.min(top, window.innerHeight - GHOST_H));
          left = Math.max(0, Math.min(left, window.innerWidth - GHOST_W));

          // 初回は位置確定→フェードイン、以後は目標だけ更新して滑らかに追従
          const firstPlacement = ghost.style.opacity === '0' || ghost.style.visibility === 'hidden';
          if (firstPlacement || !state[idx]) {
            state[idx] = { x: left, y: top, tx: left, ty: top, vx: 0, vy: 0 };
            ghost.style.left = `${left}px`;
            ghost.style.top = `${top}px`;
            ghost.style.visibility = 'visible';
            // リフロー確定後にフェードイン
            void ghost.offsetHeight;
            requestAnimationFrame(() => { ghost.style.opacity = '1'; });
          } else {
            state[idx]!.tx = left;
            state[idx]!.ty = top;
          }
        });
      } catch (err) {
        console.error('moveGhosts error:', err);
      }
    }

    moveIntervalId = setInterval(moveGhosts, 2000);
    // 60fps 目安の補間ループ（ポジションをなめらかに更新）
    let rafId: number | null = null;
    let lastTs = 0;
    const smoothStep = (ts: number) => {
      if (!lastTs) lastTs = ts;
      let dt = (ts - lastTs) / 1000;
      // タブ切替等での長いフレームは上限
      if (dt > 0.05) dt = 0.05;
      lastTs = ts;

  const aMax = 320;   // px/s^2 加速度上限（少し増）
  const vMax = 270;   // px/s 速度上限（少し増）
  const kp = 4.4;     // ばね係数（やや増）
  const kd = 5.6;     // 減衰（わずかに弱め）

      for (let i = 0; i < ghosts.length; i++) {
        const g = ghosts[i];
        const s = state[i];
        if (!g || !s) continue;

        const dx = s.tx - s.x;
        const dy = s.ty - s.y;
        // 目標に向かう加速度（クリティカルダンピング寄り）
        let ax = dx * kp - s.vx * kd;
        let ay = dy * kp - s.vy * kd;
        // 加速度をクランプ
        const aLen = Math.hypot(ax, ay) || 0;
        if (aLen > aMax) { ax = (ax / aLen) * aMax; ay = (ay / aLen) * aMax; }

        s.vx += ax * dt;
        s.vy += ay * dt;

        // 最高速度をクランプ
        const vLen = Math.hypot(s.vx, s.vy) || 0;
        if (vLen > vMax) { s.vx = (s.vx / vLen) * vMax; s.vy = (s.vy / vLen) * vMax; }

        s.x += s.vx * dt;
        s.y += s.vy * dt;
        g.style.left = `${s.x}px`;
        g.style.top = `${s.y}px`;
      }
      rafId = requestAnimationFrame(smoothStep);
    };
    rafId = requestAnimationFrame(smoothStep);
    const boundMove = moveGhosts.bind(null);
    window.addEventListener('scroll', boundMove);
    window.addEventListener('resize', boundMove);
    moveGhosts();

  function cleanup() {
      if (moveIntervalId) {
        clearInterval(moveIntervalId);
        moveIntervalId = null;
      }
      if (rafId) {
        cancelAnimationFrame(rafId);
        rafId = null;
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
  }, { once: true });
    // 呼び出し側で停止できるように cleanup を返す
    return cleanup;
  } catch (e) {
    console.error('initGhostSync error:', e);
  }
  // 例外時は no-op の停止関数を返す
  return () => {};
}

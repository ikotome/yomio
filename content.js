// -------------------------------
// キャラクター差し替え用定数
// -------------------------------
const GHOST_IMAGE = chrome.runtime.getURL('assets/ghost.svg');
const ghosts = [];
const GHOST_W = 60;
const GHOST_H = 60;
const MAX_GHOSTS = 30; // 表示上限
// 開発時に自分のゴースト（同一 session_id）を表示したい場合は true にする
const SHOW_SELF_GHOST = false;

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

function ensureGhostCount(n) {
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
  try {
    const res = await fetch(chrome.runtime.getURL('config.json'));
    const config = await res.json();
    const SUPABASE_URL = config.SUPABASE_URL;
    const SUPABASE_ANON_KEY = config.SUPABASE_ANON_KEY;

    const supabaseClient = supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

    const sessionId = localStorage.getItem('ghost_session') || crypto.randomUUID();
    localStorage.setItem('ghost_session', sessionId);
    const currentPage = window.location.href;

    // スクロール位置を送信する（失敗時はログを出すのみ。自動リトライ等の混乱するフォールバックは削除）
    async function sendScrollPosition(stayed = false) {
      const data = {
        session_id: sessionId,
        page_url: currentPage,
        scroll_top: window.scrollY,
        scroll_left: window.scrollX,
        viewport_height: window.innerHeight,
        viewport_width: window.innerWidth,
        stayed: stayed === true
      };
      try {
        const r = await supabaseClient.from('ghost_positions').insert([data]);
        if (r.error) {
          // エラーは記録するが、混乱を招く自動フォールバックは行わない
          console.error('Supabase insert error:', r.error);
        }
      } catch (e) {
        console.error('Supabase insert exception:', e);
      }
    }

    // デバウンスして送信
    const DEBOUNCE_SEND_DELAY = 10000; // ms
    let sendTimer = null;
    window.addEventListener('scroll', () => {
      if (sendTimer) clearTimeout(sendTimer);
      sendTimer = setTimeout(() => {
        sendScrollPosition(true);
        sendTimer = null;
      }, DEBOUNCE_SEND_DELAY);
    }, { passive: true });

    // 初回は現在位置を送る（必要なければコメントアウトして下さい）
    sendScrollPosition(false);

    // 他ユーザーの位置を取得してゴーストを動かす（単一のフェイルパス、過剰なフォールバックは無し）
    async function moveGhosts() {
      try {
        // クエリは開発用フラグで自セッションを含める/除外する
        let qBuilder = supabaseClient
          .from('ghost_positions')
          .select('session_id, page_url, scroll_top, scroll_left, viewport_height, viewport_width, stayed, created_at')
          .eq('page_url', currentPage);

        if (!SHOW_SELF_GHOST) {
          qBuilder = qBuilder.neq('session_id', sessionId);
        }

        const q = await qBuilder.order('created_at', { ascending: false }).limit(MAX_GHOSTS);

        if (q.error) {
          console.error('Supabase fetch error:', q.error);
          ensureGhostCount(0);
          return;
        }

        const data = q.data || [];
        if (!data.length) {
          ensureGhostCount(0);
          return;
        }

        // 同一セッションの最新のみを採用
        const latestBySession = new Map();
        data.forEach(r => {
          const sid = r.session_id || '__unknown__';
          const cur = latestBySession.get(sid);
          if (!cur) latestBySession.set(sid, r);
          else if (new Date(r.created_at).getTime() > new Date(cur.created_at).getTime()) latestBySession.set(sid, r);
        });

        const show = Array.from(latestBySession.values())
          .sort((a, b) => new Date(b.created_at) - new Date(a.created_at))
          .slice(0, MAX_GHOSTS);

        ensureGhostCount(show.length);

        const currentScrollY = window.scrollY;
        const currentScrollX = window.scrollX;

        show.forEach((row, idx) => {
          const ghost = ghosts[idx];
          if (!ghost) return;

          const scrollTop = Number(row.scroll_top || 0);
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

    setInterval(moveGhosts, 2000);
    window.addEventListener('scroll', moveGhosts);
    window.addEventListener('resize', moveGhosts);
    moveGhosts();
  } catch (e) {
    console.error('initGhostSync error:', e);
  }
}

initGhostSync();

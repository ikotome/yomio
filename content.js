// -------------------------------
// キャラクター差し替え用
// -------------------------------
const GHOST_IMAGE = chrome.runtime.getURL("assets/ghost.svg");

// -------------------------------
// ゴースト要素作成（動的）
// -------------------------------
const ghosts = [];
const GHOST_W = 60;
const GHOST_H = 60;
const MAX_GHOSTS = 30; // 上限（表示負荷対策）

function createGhostElement() {
  const g = document.createElement("img");
  g.src = GHOST_IMAGE;
  g.classList.add("ghost");
  g.style.position = "fixed";
  g.style.width = `${GHOST_W}px`;
  g.style.height = `${GHOST_H}px`;
  g.style.pointerEvents = "none";
  g.style.zIndex = '9999';
  g.style.opacity = '1';
  g.style.display = 'block';
  g.style.left = '0px';
  g.style.top = '0px';
  g.style.transition = "top 1.5s ease-in-out, left 1.5s ease-in-out";
  document.body.appendChild(g);
  console.debug('[ghost] created element', g);
  return g;
}

function ensureGhostCount(n) {
  const target = Math.max(0, Math.min(n, MAX_GHOSTS));
  console.debug('[ghost] ensureGhostCount target=', target, 'current=', ghosts.length);
  while (ghosts.length < target) {
    ghosts.push(createGhostElement());
  }
  while (ghosts.length > target) {
    const g = ghosts.pop();
    if (g && g.parentNode) g.parentNode.removeChild(g);
  }
}

// -------------------------------
// Supabase 初期化
// -------------------------------
fetch(chrome.runtime.getURL('config.json'))
  .then(res => res.json())
  .then(config => {
    const SUPABASE_URL = config.SUPABASE_URL;
    const SUPABASE_ANON_KEY = config.SUPABASE_ANON_KEY;

    const supabaseClient = supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

  const sessionId = localStorage.getItem('ghost_session') || crypto.randomUUID();
  localStorage.setItem('ghost_session', sessionId);
  const currentPage = window.location.href; // 現在のページで絞り込むための識別子

    // -------------------------------
    // 自分のスクロール位置を送信
    // -------------------------------
    function sendScrollPosition(stayed = false) {
      const data = {
        session_id: sessionId,
        page_url: currentPage,
        scroll_top: window.scrollY,
        scroll_left: window.scrollX,
        viewport_height: window.innerHeight,
        viewport_width: window.innerWidth,
        stayed: stayed === true
      };
      supabaseClient.from('ghost_positions').insert([data])
        .then(res => {
          if (res.error) {
            // もし stayed カラムが存在しないなどでエラーになったら、stayed を外して再送する
            const msg = (res.error && res.error.message) ? String(res.error.message) : '';
            if (msg.includes('stayed') || msg.includes('column') && msg.includes('stayed')) {
              const data2 = { ...data };
              delete data2.stayed;
              supabaseClient.from('ghost_positions').insert([data2])
                .then(res2 => { if (res2.error) console.error('Supabase insert retry error:', res2.error); });
            } else {
              console.error('Supabase insert error:', res.error);
            }
          }
        });
    }
    // 送信は「スクロールイベント後に最後のスクロールから10秒経過したら一度送る」方式にする
    // （デバウンス）
    const DEBOUNCE_SEND_DELAY = 10000; // ms
    let sendTimer = null;

    window.addEventListener('scroll', () => {
      // 既存のタイマーがあればリセットして、最後のスクロールから DEBOUNCE_SEND_DELAY 後に送信する
      if (sendTimer) clearTimeout(sendTimer);
      sendTimer = setTimeout(() => {
        sendScrollPosition(true);
        sendTimer = null;
      }, DEBOUNCE_SEND_DELAY);
    }, { passive: true });

    // （オプション）初回は送らない設計にする場合は以下をコメントアウトしてください。
    // 初回送信（ページ読み込み時に現在位置を一度送る）
    sendScrollPosition(false);

    // -------------------------------
    // 人気位置にゴーストを移動
    // -------------------------------
    async function moveGhosts() {
      const oneMinuteAgo = new Date(Date.now() - 60*1000).toISOString();
      console.debug('[ghost] moveGhosts called at', new Date().toISOString());
      try {
        // 初回取得は時間で絞りすぎると行が0件になることがあるため
        // まずは page_url と session を条件に取得してみる（時間条件はサーバー側の ordered fetch で試す）
        const res = await supabaseClient
          .from('ghost_positions')
          .select('session_id, page_url, scroll_top, scroll_left, viewport_height, viewport_width, stayed, created_at')
          .eq('page_url', currentPage)
          .neq('session_id', sessionId);

        if (res.error) {
          console.error('Supabase initial fetch error:', res.error);
          return;
        }

        let data = res.data || [];
        console.debug('[ghost] fetched rows:', data.length, data.slice(0,5));
        if (!data.length) {
          // 既存ゴーストは消す
          ensureGhostCount(0);
          return;
        }

        // サーバー側で最新の MAX_GHOSTS 件のみ取得する（可能であれば）。
        // created_at 降順で取得して最新を優先する。
        try {
          const q = await supabaseClient
            .from('ghost_positions')
            .select('session_id, page_url, scroll_top, scroll_left, viewport_height, viewport_width, stayed, created_at')
            .gte('created_at', oneMinuteAgo)
            .eq('page_url', currentPage)
            .neq('session_id', sessionId)
            .order('created_at', { ascending: false })
            .limit(MAX_GHOSTS);
          if (q.error) {
            console.error('Supabase ordered fetch error:', q.error);
            data = data.slice(0, MAX_GHOSTS);
          } else {
            data = q.data || data.slice(0, MAX_GHOSTS);
          }
          console.debug('[ghost] ordered fetch rows:', data.length, data.slice(0,5));
        } catch (e) {
          // サーバー側でのソート/制限が使えない場合はクライアント側でトリム
          data = data.slice(-MAX_GHOSTS);
        }

        // セッションごとに最新のレコードのみを採用する（同一 session_id の複数情報は最新1件にまとめる）
        const latestBySession = new Map();
        data.forEach(r => {
          const sid = r.session_id || '__unknown__';
          const cur = latestBySession.get(sid);
          if (!cur) {
            latestBySession.set(sid, r);
          } else {
            const curTime = new Date(cur.created_at).getTime();
            const rTime = new Date(r.created_at).getTime();
            if (rTime > curTime) latestBySession.set(sid, r);
          }
        });

        const show = Array.from(latestBySession.values())
          .sort((a, b) => new Date(b.created_at) - new Date(a.created_at))
          .slice(0, MAX_GHOSTS);
        console.debug('[ghost] show rows:', show.length, show.map(r => ({sid: r.session_id, at: r.created_at, stayed: r.stayed}))); 

        // レコード数に応じてゴースト数を合わせる（1データ = 1ゴースト）
        ensureGhostCount(show.length);

        const currentScrollY = window.scrollY;
        const currentScrollX = window.scrollX;

        show.forEach((row, idx) => {
          const ghost = ghosts[idx];
          if (!ghost) return;

          const scrollTop = Number(row.scroll_top || 0);
          const vh = Number(row.viewport_height) || window.innerHeight;
          const docCenterY = scrollTop + vh / 2;

          const scrollLeft = row.scroll_left != null ? Number(row.scroll_left) : null;
          const vw = Number(row.viewport_width) || window.innerWidth;
          const docCenterX = (scrollLeft != null ? scrollLeft : 0) + vw / 2;

          const jitterY = (Math.random() * 60 - 30);
          const jitterX = (Math.random() * 120 - 60);

          let top = docCenterY - currentScrollY - GHOST_H / 2 + jitterY;
          let left = docCenterX - currentScrollX - GHOST_W / 2 + jitterX;

          top = Math.max(0, Math.min(top, window.innerHeight - GHOST_H));
          left = Math.max(0, Math.min(left, window.innerWidth - GHOST_W));

          ghost.style.top = `${top}px`;
          ghost.style.left = `${left}px`;
          console.debug('[ghost] positioned', idx, {top, left, session_id: row.session_id});
        });
      } catch (err) {
        console.error('Supabase select error:', err);
      }
    }

    setInterval(moveGhosts, 2000);
    window.addEventListener("scroll", moveGhosts);
    window.addEventListener("resize", moveGhosts);
    // 初回実行してゴースト数をすぐ反映
    moveGhosts();
  });

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
  g.style.transition = "top 1.5s ease-in-out, left 1.5s ease-in-out";
  document.body.appendChild(g);
  return g;
}

function ensureGhostCount(n) {
  const target = Math.max(0, Math.min(n, MAX_GHOSTS));
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
    function sendScrollPosition() {
      const data = {
        session_id: sessionId,
        page_url: currentPage,
        scroll_top: window.scrollY,
        scroll_left: window.scrollX,
        viewport_height: window.innerHeight,
        viewport_width: window.innerWidth
      };
      supabaseClient.from('ghost_positions').insert([data])
        .then(res => {
          if (res.error) console.error('Supabase insert error:', res.error);
        });
    }
    setInterval(sendScrollPosition, 5000);

    // -------------------------------
    // 人気位置にゴーストを移動
    // -------------------------------
    async function moveGhosts() {
      const oneMinuteAgo = new Date(Date.now() - 60*1000).toISOString();
      try {
        const res = await supabaseClient
          .from('ghost_positions')
          .select('session_id, page_url, scroll_top, scroll_left, viewport_height, viewport_width, created_at')
          .gte('created_at', oneMinuteAgo)
          .eq('page_url', currentPage);

        let data = res.data || [];
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
            .select('session_id, page_url, scroll_top, scroll_left, viewport_height, viewport_width, created_at')
            .gte('created_at', oneMinuteAgo)
            .eq('page_url', currentPage)
            .order('created_at', { ascending: false })
            .limit(MAX_GHOSTS);
          data = q.data || data.slice(0, MAX_GHOSTS);
        } catch (e) {
          // サーバー側でのソート/制限が使えない場合はクライアント側でトリム
          data = data.slice(-MAX_GHOSTS);
        }

        // レコード数に応じてゴースト数を合わせる（1データ = 1ゴースト）
        ensureGhostCount(data.length);

        const currentScrollY = window.scrollY;
        const currentScrollX = window.scrollX;

        data.forEach((row, idx) => {
          const ghost = ghosts[idx];
          if (!ghost) return;

          const scrollTop = Number(row.scroll_top || 0);
          const vh = Number(row.viewport_height) || window.innerHeight;
          const docCenterY = scrollTop + vh / 2;

          // 横位置は送られていれば使い、なければビューポート中心を使う
          const scrollLeft = row.scroll_left != null ? Number(row.scroll_left) : null;
          const vw = Number(row.viewport_width) || window.innerWidth;
          const docCenterX = (scrollLeft != null ? scrollLeft : 0) + vw / 2;

          // 少しランダムに振る
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
        console.error('Supabase select error:', err);
      }
    }

    setInterval(moveGhosts, 2000);
    window.addEventListener("scroll", moveGhosts);
    window.addEventListener("resize", moveGhosts);
    // 初回実行してゴースト数をすぐ反映
    moveGhosts();
  });

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
    // 送信はスクロールがあったときに行う（初回は必ず送信）
    const SEND_INTERVAL = 5000;
    const SCROLL_STOP_DEBOUNCE = 250; // スクロール停止検出のデバウンス(ms)
    const STAY_DURATION = 10000; // 10秒以上滞在したら stayed=true を送る

    let scrollDirty = false;
    let scrollStopTimer = null;
    let stayTimer = null;
    let lastSentStayedAt = 0; // 重複送信防止

    // スクロールイベントでフラグを立て、停止検出と滞在判定タイマーを管理する
    window.addEventListener('scroll', () => {
      scrollDirty = true;

      // スクロールが続く間は停止タイマーをリセット
      if (scrollStopTimer) clearTimeout(scrollStopTimer);
      if (stayTimer) {
        clearTimeout(stayTimer);
        stayTimer = null;
      }

      // スクロールが停止したと見なすまで待つ
      scrollStopTimer = setTimeout(() => {
        // スクロール停止 → 滞在判定タイマーを開始
        const start = Date.now();
        stayTimer = setTimeout(() => {
          // 10秒間移動がなかったので stayed=true で送信
          // 重複送信防止: 直近で送っていればスキップ
          if (Date.now() - lastSentStayedAt > STAY_DURATION) {
            sendScrollPosition(true);
            lastSentStayedAt = Date.now();
          }
        }, STAY_DURATION);
      }, SCROLL_STOP_DEBOUNCE);
    }, { passive: true });

    // 初回送信
    sendScrollPosition();

    // 定期チェックでスクロールが発生していれば送信する（stayed は上のロジックで送る）
    setInterval(() => {
      if (scrollDirty) {
        sendScrollPosition(false);
        scrollDirty = false;
      }
    }, SEND_INTERVAL);

    // -------------------------------
    // 人気位置にゴーストを移動
    // -------------------------------
    async function moveGhosts() {
      const oneMinuteAgo = new Date(Date.now() - 60*1000).toISOString();
      try {
        const res = await supabaseClient
          .from('ghost_positions')
          .select('session_id, page_url, scroll_top, scroll_left, viewport_height, viewport_width, stayed, created_at')
          .gte('created_at', oneMinuteAgo)
          .eq('page_url', currentPage);
        //  .neq('session_id', sessionId);

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
            .select('session_id, page_url, scroll_top, scroll_left, viewport_height, viewport_width, stayed, created_at')
            .gte('created_at', oneMinuteAgo)
            .eq('page_url', currentPage)
            .neq('session_id', sessionId)
            .order('created_at', { ascending: false })
            .limit(MAX_GHOSTS);
          data = q.data || data.slice(0, MAX_GHOSTS);
        } catch (e) {
          // サーバー側でのソート/制限が使えない場合はクライアント側でトリム
          data = data.slice(-MAX_GHOSTS);
        }

        // セッションごとに最新の "滞在（stayed）" レコードを選ぶ。
        // フォールバック: stayed カラムが無い場合は created_at が現在から >=STAY_DURATION のものを滞在とみなす。
        const now = Date.now();
        const sessions = new Map();
        data.forEach(r => {
          const sid = r.session_id || '__unknown__';
          if (!sessions.has(sid)) sessions.set(sid, []);
          sessions.get(sid).push(r);
        });

        const rowsToShow = [];
        sessions.forEach((rows) => {
          // created_at 降順にソートして最新順にする
          rows.sort((a, b) => new Date(b.created_at) - new Date(a.created_at));

          // まず stayed === true の最新を探す
          let picked = rows.find(r => r.stayed === true);
          if (!picked) {
            // stayed が無いか false の場合、created_at が STAY_DURATION 以上前の最新レコードを探す
            picked = rows.find(r => (now - new Date(r.created_at).getTime()) >= STAY_DURATION);
          }
          if (picked) rowsToShow.push(picked);
        });

        // 最新のものを優先して上限まで使う
        rowsToShow.sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
        const show = rowsToShow.slice(0, MAX_GHOSTS);

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

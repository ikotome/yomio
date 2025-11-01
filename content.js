// -------------------------------
// キャラクター差し替え用
// -------------------------------
const GHOST_IMAGE = chrome.runtime.getURL("assets/ghost.svg");

// -------------------------------
// ゴースト要素作成
// -------------------------------
const GHOST_COUNT = 5; // 表示するゴーストの数
const ghosts = [];

for (let i = 0; i < GHOST_COUNT; i++) {
  const g = document.createElement("img");
  g.src = GHOST_IMAGE;
  g.classList.add("ghost");
  g.style.position = "fixed";
  g.style.width = "60px";
  g.style.height = "60px";
  g.style.pointerEvents = "none";
  g.style.transition = "top 1.5s ease-in-out, left 1.5s ease-in-out";
  document.body.appendChild(g);
  ghosts.push(g);
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

    // -------------------------------
    // 自分のスクロール位置を送信
    // -------------------------------
    function sendScrollPosition() {
      const data = {
        session_id: sessionId,
        scroll_top: window.scrollY,
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
          .select('scroll_top, viewport_height, viewport_width, created_at')
          .gte('created_at', oneMinuteAgo);

        const data = res.data || [];
        if (!data.length) return;

        // 各レコードのビューポート中心（ドキュメント座標）を算出して平均を取る
        // 利用可能なフィールド: scroll_top, viewport_height, viewport_width
        const avgCenterY = data.reduce((acc, row) => {
          const scrollTop = Number(row.scroll_top || 0);
          const vh = Number(row.viewport_height) || window.innerHeight;
          return acc + (scrollTop + vh / 2);
        }, 0) / data.length;

        // 横はスクロール X を送っていないため、各ビューポートの中心の平均を使う (fallback)
        const avgCenterX = data.reduce((acc, row) => {
          const vw = Number(row.viewport_width) || window.innerWidth;
          return acc + (vw / 2);
        }, 0) / data.length;

        const currentScrollY = window.scrollY;
        const currentScrollX = window.scrollX;
        const GHOST_W = 60;
        const GHOST_H = 60;

        ghosts.forEach((ghost) => {
          // 少しランダムに振る
          const jitterY = (Math.random() * 60 - 30);
          const jitterX = (Math.random() * 120 - 60);

          // ドキュメント中心座標 -> 現在のビューポート座標に変換
          let top = avgCenterY - currentScrollY - GHOST_H / 2 + jitterY;
          let left = avgCenterX - currentScrollX - GHOST_W / 2 + jitterX;

          // ビューポート内に収める
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
  });

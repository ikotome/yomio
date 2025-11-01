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
      const { data } = await supabaseClient
        .from('ghost_positions')
        .select('scroll_top, viewport_height, viewport_width')
        .gte('created_at', oneMinuteAgo);

      if (data && data.length) {
        // 縦横ともに人気位置平均
        const avgTop = data.reduce((acc,row)=>acc+row.scroll_top,0)/data.length;
        const avgLeft = data.reduce((acc,row)=>acc+row.viewport_width/2,0)/data.length;

        // 複数ゴーストに少しずつランダム振り分け
        ghosts.forEach((ghost, idx) => {
          const top = avgTop + (Math.random()*60 - 30);
          const left = avgLeft + (Math.random()*120 - 60);
          ghost.style.top = `${top}px`;
          ghost.style.left = `${left}px`;
        });
      }
    }

    setInterval(moveGhosts, 2000);
    window.addEventListener("scroll", moveGhosts);
    window.addEventListener("resize", moveGhosts);
  });

// -------------------------------
// ゴーストキャラクター設定
// -------------------------------
const GHOST_IMAGE = chrome.runtime.getURL("assets/ghost.svg");

const ghost = document.createElement("img");
ghost.src = GHOST_IMAGE;
ghost.id = "ghost";
ghost.style.position = "fixed";
ghost.style.width = "60px";
ghost.style.height = "60px";
ghost.style.pointerEvents = "none";
ghost.style.transition = "top 1.5s ease-in-out, left 1.5s ease-in-out";
document.body.appendChild(ghost);

// -------------------------------
// セッションID生成
// -------------------------------
const sessionId = localStorage.getItem('ghost_session') || crypto.randomUUID();
localStorage.setItem('ghost_session', sessionId);

// -------------------------------
// config.json読み込み
// -------------------------------
fetch(chrome.runtime.getURL('config.json'))
  .then(res => res.json())
  .then(config => {
    // UMD版(@supabase/supabase-js@2)を読み込んでいる想定
    const { createClient } = window.supabase || {};
    if (!createClient) {
      console.error('[yomio] Supabase UMD が読み込まれていません。libs/supabase.min.js を正しいUMD版に差し替えてください。');
      return;
    }
    const supabaseClient = createClient(
      config.SUPABASE_URL,
      config.SUPABASE_ANON_KEY
    );

    // -------------------------------
    // ユーザーデータ送信
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
    // 人気エリアにゴースト移動（縦横とも集計）
    // -------------------------------
    async function moveGhostToPopularArea() {
      const { data } = await supabaseClient
        .from('ghost_positions')
        .select('scroll_top, viewport_height, viewport_width')
        .gte('created_at', new Date(Date.now() - 60*1000).toISOString());

      if (data && data.length) {
        const topBins = {};
        const leftBins = {};

        data.forEach(row => {
          const topBin = Math.floor(row.scroll_top / 10) * 10;
          const leftBin = Math.floor(row.viewport_width / 10) * 10;
          topBins[topBin] = (topBins[topBin] || 0) + 1;
          leftBins[leftBin] = (leftBins[leftBin] || 0) + 1;
        });

        const maxTopBin = Object.keys(topBins).reduce((a, b) => topBins[a] > topBins[b] ? a : b);
        const maxLeftBin = Object.keys(leftBins).reduce((a, b) => leftBins[a] > leftBins[b] ? a : b);

        ghost.style.top = `${parseInt(maxTopBin) + Math.random() * 30}px`;
        ghost.style.left = `${parseInt(maxLeftBin) + Math.random() * 30}px`;
      }
    }

    setInterval(moveGhostToPopularArea, 2000);
    window.addEventListener("scroll", moveGhostToPopularArea);
    window.addEventListener("resize", moveGhostToPopularArea);
});

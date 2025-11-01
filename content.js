// -------------------------------
// 画像パス（ここを変えるだけでキャラ差し替え可能）
// -------------------------------
const GHOST_IMAGE = chrome.runtime.getURL("assets/ghost.svg");

// -------------------------------
// ゴースト作成
// -------------------------------
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
// Supabase 初期化
// -------------------------------
import { createClient } from 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js/+esm';

const SUPABASE_URL = 'https://xxxx.supabase.co';      // あなたの Supabase URL
const SUPABASE_ANON_KEY = 'YOUR_ANON_KEY';           // あなたの anon key
const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

// -------------------------------
// セッションID
// -------------------------------
const sessionId = localStorage.getItem('ghost_session') || crypto.randomUUID();
localStorage.setItem('ghost_session', sessionId);

// -------------------------------
// ユーザーのスクロール位置を送信
// -------------------------------
function sendScrollPosition() {
  const data = {
    session_id: sessionId,
    scroll_top: window.scrollY,
    viewport_height: window.innerHeight,
    viewport_width: window.innerWidth
  };

  supabase.from('ghost_positions').insert([data])
    .then(res => {
      if (res.error) console.error('Supabase insert error:', res.error);
    });
}

setInterval(sendScrollPosition, 5000);

// -------------------------------
// 人気エリアにゴーストを移動（縦方向のみ）
// -------------------------------
async function moveGhostToPopularArea() {
  const { data, error } = await supabase
    .from('ghost_positions')
    .select('scroll_top, viewport_height, viewport_width')
    .gte('created_at', new Date(Date.now() - 60*1000).toISOString());

  if (data && data.length) {
    // 縦方向平均を計算
    const sumTop = data.reduce((acc, row) => acc + row.scroll_top, 0);
    const avgTop = sumTop / data.length;

    ghost.style.top = `${avgTop + Math.random() * 30}px`; // 少しランダム
  }
}

setInterval(moveGhostToPopularArea, 2000);

// -------------------------------
// ページリサイズやスクロールでも更新
// -------------------------------
window.addEventListener("scroll", moveGhostToPopularArea);
window.addEventListener("resize", moveGhostToPopularArea);

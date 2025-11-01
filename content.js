// ゴースト生成
const ghost = document.createElement("div");
ghost.id = "ghost";
document.body.appendChild(ghost);

// 縦位置ごとの滞在時間
const viewScore = {};
function getBlock() {
  return Math.floor(window.scrollY / 100);
}

setInterval(() => {
  const b = getBlock();
  viewScore[b] = (viewScore[b] || 0) + 1;
}, 1000);

// ゴースト移動
function moveGhost() {
  let max = 0;
  let best = 0;
  for (const b in viewScore) {
    if (viewScore[b] > max) {
      max = viewScore[b];
      best = b;
    }
  }

  const targetY = best * 100 + 50;
  ghost.style.top = `calc(${targetY}px - ${window.scrollY}px)`;
}

setInterval(moveGhost, 2000);

// SVG ゴースト生成
const ghost = document.createElement("div");
ghost.id = "ghost";
ghost.innerHTML = `
<svg viewBox="0 0 100 100" width="100" height="100">
  <!-- 体 -->
  <path d="M50 10
           C75 10, 90 35, 90 60
           C90 85, 75 95, 50 95
           C25 95, 10 85, 10 60
           C10 35, 25 10, 50 10Z"
        fill="white" stroke="#eaeaea" stroke-width="2" />
  <!-- 目 -->
  <circle cx="40" cy="45" r="6" fill="#222" />
  <circle cx="60" cy="45" r="6" fill="#222" />
  <!-- 口（ゆるい） -->
  <path d="M38 63 Q50 72 62 63" stroke="#222" stroke-width="3" fill="none" stroke-linecap="round"/>
</svg>
`;

document.body.appendChild(ghost);

// ゆっくり動く（ランダムに上下へ）
function moveGhost() {
  const scrollY = window.scrollY;
  const viewportHeight = window.innerHeight;
  const offset = Math.random() * viewportHeight * 0.6;
  const targetY = scrollY + offset;
  ghost.style.top = `${targetY}px`;
}

setInterval(moveGhost, 2600);

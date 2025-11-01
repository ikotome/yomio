const ghost = document.createElement("img");
ghost.id = "ghost";
ghost.src = chrome.runtime.getURL("ghost.svg"); // ← ここがポイント
document.body.appendChild(ghost);

// ゆっくり動く
function moveGhost() {
  const scrollY = window.scrollY;
  const viewportHeight = window.innerHeight;
  const offset = Math.random() * viewportHeight * 0.6;
  ghost.style.top = `${scrollY + offset}px`;
}

setInterval(moveGhost, 2600);

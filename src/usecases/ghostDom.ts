const GHOST_IMAGE = chrome.runtime.getURL('assets/ghost.svg');
export const GHOST_W = 60;
export const GHOST_H = 60;
export const MAX_GHOSTS = 30;

export const ghosts: HTMLImageElement[] = [];

// ふわふわ用の keyframes を一度だけ注入
function ensureStyleInjected() {
  const id = 'yomio-ghost-style';
  if (document.getElementById(id)) return;
  const style = document.createElement('style');
  style.id = id;
  style.textContent = `
@keyframes yomio-float {
  0% { transform: translateY(0px) rotate(0deg); }
  50% { transform: translateY(-6px) rotate(1deg); }
  100% { transform: translateY(0px) rotate(0deg); }
}`;
  document.head.appendChild(style);
}

function createGhostElement() {
  ensureStyleInjected();
  const g = document.createElement('img');
  g.src = GHOST_IMAGE;
  g.classList.add('ghost');
  Object.assign(g.style, {
    position: 'fixed',
    width: `${GHOST_W}px`,
    height: `${GHOST_H}px`,
    pointerEvents: 'none',
    zIndex: '9999',
  // 初期は非表示 → 初回配置でフェードイン
  opacity: '0',
  visibility: 'hidden',
    display: 'block',
    left: '0px',
    top: '0px',
  // 位置はJSで補間するため top/left のトランジションは不要。opacity のみ。
  transition: 'opacity .35s ease',
  // CSS側で微小な揺れを付与
  animationName: 'yomio-float',
  animationIterationCount: 'infinite',
  animationTimingFunction: 'ease-in-out',
  // duration と delay を後でランダム設定
  willChange: 'transform, top, left, opacity'
  } as Partial<CSSStyleDeclaration>);
  // ランダムなゆらぎ速度/位相
  const dur = (2.4 + Math.random() * 1.2).toFixed(2);
  const delay = (-Math.random() * 2).toFixed(2);
  g.style.animationDuration = `${dur}s`;
  g.style.animationDelay = `${delay}s`;
  document.body.appendChild(g);
  return g;
}

export function ensureGhostCount(n: number) {
  const target = Math.max(0, Math.min(n, MAX_GHOSTS));
  while (ghosts.length < target) ghosts.push(createGhostElement());
  while (ghosts.length > target) {
    const g = ghosts.pop();
    if (g && g.parentNode) g.parentNode.removeChild(g);
  }
}

export function cleanupGhosts() {
  while (ghosts.length) {
    const g = ghosts.pop();
    if (g && g.parentNode) g.parentNode.removeChild(g);
  }
}

const GHOST_IMAGE = chrome.runtime.getURL('assets/ghost.svg');
export const GHOST_W = 60;
export const GHOST_H = 60;
export const MAX_GHOSTS = 30;

export const ghosts: HTMLImageElement[] = [];

function createGhostElement() {
  const g = document.createElement('img');
  g.src = GHOST_IMAGE;
  g.classList.add('ghost');
  Object.assign(g.style, {
    position: 'fixed',
    width: `${GHOST_W}px`,
    height: `${GHOST_H}px`,
    pointerEvents: 'none',
    zIndex: '9999',
    opacity: '1',
    display: 'block',
    left: '0px',
    top: '0px',
    transition: 'top 1.5s ease-in-out, left 1.5s ease-in-out'
  } as Partial<CSSStyleDeclaration>);
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

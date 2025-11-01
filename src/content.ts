import { initGhostSync } from './usecases/ghostSync';

let stop: null | (() => void) = null;

function forceClearGhosts() {
	// ベルト＆サスペンダー: 万一の二重起動でも確実に消す
	document.querySelectorAll('img.ghost').forEach((el) => {
		el.parentElement?.removeChild(el);
	});
}

async function applyToggle() {
	try {
		const { ghost_enabled = true } = await chrome.storage.local.get('ghost_enabled');
		if (ghost_enabled) {
			if (!stop) stop = await initGhostSync();
		} else {
			if (stop) { stop(); stop = null; }
			// 念のため即時消去
			forceClearGhosts();
		}
	} catch (e) {
		console.error('applyToggle error', e);
	}
}

applyToggle();

chrome.storage.onChanged.addListener((changes, area) => {
	if (area === 'local' && changes.ghost_enabled) {
		applyToggle();
	}
});

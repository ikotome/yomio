import { initGhostSync } from './usecases/ghostSync';

let stop: null | (() => void) = null;

async function applyToggle() {
	try {
		const { ghost_enabled = true } = await chrome.storage.local.get('ghost_enabled');
		if (ghost_enabled) {
			if (!stop) stop = await initGhostSync();
		} else {
			if (stop) { stop(); stop = null; }
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

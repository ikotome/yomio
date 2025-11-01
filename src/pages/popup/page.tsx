import { useEffect, useState } from 'react'
import './popup.css'

export default function Popup() {
    const [enabled, setEnabled] = useState(true)

    useEffect(() => {
        chrome.storage.local.get({ ghost_enabled: true }).then(v => {
            setEnabled(Boolean(v.ghost_enabled))
        })
    }, [])

    async function onToggle(e: React.ChangeEvent<HTMLInputElement>) {
        const v = e.currentTarget.checked
        setEnabled(v)
        await chrome.storage.local.set({ ghost_enabled: v })
    }

        const statusClass = enabled ? 'status on' : 'status off'
        const statusText = enabled ? 'ON' : 'OFF'

        return (
            <div className="popup-root">
                <div className="card">
                    <div className="header">
                        <img className="logo" src={chrome.runtime.getURL('assets/ghost.svg')} alt="" />
                        <div className="title-wrap">
                            <h1>Yomio</h1>
                            <span className={statusClass}>{statusText}</span>
                        </div>
                    </div>
                    <p className="caption">ページの人気領域をゴーストの位置で可視化します。</p>

                    <label className="switch-row">
                        <input type="checkbox" checked={enabled} onChange={onToggle} />
                        <span className="switch"><span className="thumb" /></span>
                        <span className="switch-label">ゴーストを表示する</span>
                    </label>

                    <div className="hint">トグルですぐに有効/無効を切り替えられます</div>
                </div>
            </div>
        )
}
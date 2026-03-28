// ============================================================
//  FurFriend Finder — Shared JavaScript Utilities
// ============================================================

/**
 * Show a toast notification.
 * Requires a <div id="toast" class="toast"></div> in the DOM.
 */
function showToast(message, type = 'success', duration = 3000) {
    const toast = document.getElementById('toast');
    if (!toast) return;
    toast.textContent = message;
    toast.className = `toast ${type} show`;
    clearTimeout(toast._hideTimer);
    toast._hideTimer = setTimeout(() => {
        toast.classList.remove('show');
    }, duration);
}

/**
 * Read ?message= and ?error= from the current URL, display the appropriate
 * toast, then clean the query string from history so it doesn't show on refresh.
 *
 * @param {Record<string,string>} [messageMap] - Optional key→display-text map for ?message= values.
 */
const DEFAULT_MESSAGE_MAP = {
    'signup-success': '註冊成功！歡迎您的加入。',
    'login-success':  '登入成功！',
    'logout-success': '您已成功登出。',
    'signup-failed':  '註冊失敗，請檢查您輸入的資料。',
    'login-failed':   '登入失敗，請確認您的信箱與密碼。',
    'report-success': '協尋案件提交成功！',
    'settings-saved': '設定已儲存。',
};

function handleUrlMessages(messageMap) {
    const map = messageMap || DEFAULT_MESSAGE_MAP;
    const urlParams = new URLSearchParams(window.location.search);
    const message = urlParams.get('message');
    const error   = urlParams.get('error');

    if (message) {
        const text = map[message] || decodeURIComponent(message);
        const type = message.endsWith('-failed') ? 'error' : 'success';
        showToast(text, type);
        window.history.replaceState({}, document.title, window.location.pathname);
    }
    if (error) {
        showToast(decodeURIComponent(error), 'error');
        window.history.replaceState({}, document.title, window.location.pathname);
    }
}

/**
 * Map sex code to human-readable label.
 * @param {string} s - 'M', 'F', or other
 */
function sexLabel(s) {
    return s === 'M' ? '公' : s === 'F' ? '母' : s || '—';
}

// ============================================================
//  Lightbox
// ============================================================

/**
 * Open a lightbox showing an animal's photo and, optionally, shelter details.
 * Fetches /api/animals/:id if animalId is provided.
 *
 * @param {{ picture?: string, variety?: string, kind?: string, sex?: string,
 *           colour?: string, found_place?: string }} animal - base animal data
 * @param {string|null} [animalId] - optional id to fetch shelter contact info
 */
function openLightbox(animal, animalId) {
    // Remove any existing overlay
    const existing = document.getElementById('ff-lightbox');
    if (existing) existing.remove();

    const overlay = document.createElement('div');
    overlay.id = 'ff-lightbox';
    overlay.className = 'lightbox-overlay';

    const imgSrc = animal.picture || 'https://placehold.co/600x300/f4efe8/a77b5a?text=%F0%9F%90%BE';

    overlay.innerHTML = `
        <div class="lightbox-box">
            <img class="lightbox-img" src="${imgSrc}" alt="${animal.variety || '動物'}">
            <button class="lightbox-close" aria-label="關閉">✕</button>
            <div class="lightbox-body">
                <h3>${animal.variety || '未知品種'}</h3>
                <p><strong>物種:</strong> ${animal.kind || '—'}</p>
                <p><strong>性別:</strong> ${sexLabel(animal.sex)}</p>
                <p><strong>毛色:</strong> ${animal.colour || '—'}</p>
                ${animal.found_place ? `<p><strong>發現地點:</strong> ${animal.found_place}</p>` : ''}
                <div class="lightbox-shelter-info" id="lb-shelter">
                    <p style="color:#aaa;font-style:italic">載入收容所資訊...</p>
                </div>
            </div>
        </div>`;

    document.body.appendChild(overlay);
    // Trigger animation
    requestAnimationFrame(() => overlay.classList.add('open'));

    // Close on background click or button
    overlay.addEventListener('click', (e) => {
        if (e.target === overlay || e.target.classList.contains('lightbox-close')) {
            overlay.classList.remove('open');
            setTimeout(() => overlay.remove(), 260);
        }
    });

    // Fetch shelter details
    if (animalId) {
        fetch(`/api/animals/${animalId}`)
            .then(r => r.ok ? r.json() : Promise.reject())
            .then(({ extras }) => {
                const a = extras.animal;
                const shelter = document.getElementById('lb-shelter');
                if (!shelter) return;
                if (a && a.shelter_name) {
                    shelter.innerHTML = `
                        <h4>📍 收容所資訊</h4>
                        <p><strong>名稱:</strong> ${a.shelter_name}</p>
                        ${a.shelter_address ? `<p><strong>地址:</strong> ${a.shelter_address}</p>` : ''}
                        ${a.shelter_tel    ? `<p><strong>電話:</strong> <a href="tel:${a.shelter_tel}">${a.shelter_tel}</a></p>` : ''}`;
                } else {
                    shelter.innerHTML = '<p style="color:#aaa">無收容所資訊</p>';
                }
            })
            .catch(() => {
                const shelter = document.getElementById('lb-shelter');
                if (shelter) shelter.innerHTML = '<p style="color:#aaa">無法載入收容所資訊</p>';
            });
    } else {
        const shelter = document.getElementById('lb-shelter');
        if (shelter) shelter.remove();
    }
}

// Auto-run on DOMContentLoaded for pages that include this script.
// Pages can override by calling handleUrlMessages(customMap) themselves.
document.addEventListener('DOMContentLoaded', () => {
    handleUrlMessages();
});

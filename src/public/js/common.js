// ============================================================
//  FurFriend Finder — Shared JavaScript Utilities
// ============================================================

/**
 * Show a toast notification.
 * Requires a <div id="toast" class="toast"></div> in the DOM.
 */
function escapeHtml(str) {
    if (str == null) return '';
    return String(str)
        .replace(/&/g, '&amp;').replace(/</g, '&lt;')
        .replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}

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
window.APP_MESSAGE_KEYS = Object.freeze({
    SIGNUP_SUCCESS: 'signup-success',
    LOGIN_SUCCESS: 'login-success',
    LOGOUT_SUCCESS: 'logout-success',
    SIGNUP_FAILED: 'signup-failed',
    LOGIN_FAILED: 'login-failed',
    VERIFICATION_EMAIL_SENT: 'verification-email-sent',
    EMAIL_NOT_VERIFIED: 'email-not-verified',
    EMAIL_VERIFIED: 'email-verified',
    RESET_PASSWORD_SENT: 'reset-password-sent',
    RESET_PASSWORD_FAILED: 'reset-password-failed',
    RESET_PASSWORD_SUCCESS: 'reset-password-success',
    REPORT_SUCCESS: 'report-success',
    REPORT_FAILED: 'report-failed',
    SETTINGS_SAVED: 'settings-saved',
});

const DEFAULT_MESSAGE_MAP = {
    [window.APP_MESSAGE_KEYS.SIGNUP_SUCCESS]: '註冊成功！歡迎您的加入。',
    [window.APP_MESSAGE_KEYS.LOGIN_SUCCESS]:  '登入成功！',
    [window.APP_MESSAGE_KEYS.LOGOUT_SUCCESS]: '您已成功登出。',
    [window.APP_MESSAGE_KEYS.SIGNUP_FAILED]:  '註冊失敗，請檢查您輸入的資料。',
    [window.APP_MESSAGE_KEYS.LOGIN_FAILED]:   '登入失敗，請確認您的信箱與密碼。',
    [window.APP_MESSAGE_KEYS.VERIFICATION_EMAIL_SENT]: '驗證信已寄出，請先完成信箱驗證。',
    [window.APP_MESSAGE_KEYS.EMAIL_NOT_VERIFIED]: '請先完成信箱驗證；如果密碼正確，我們已重新寄送驗證信。',
    [window.APP_MESSAGE_KEYS.EMAIL_VERIFIED]: '信箱驗證完成，請登入。',
    [window.APP_MESSAGE_KEYS.RESET_PASSWORD_SENT]: '如果此 Email 已註冊，請查看信箱中的重設連結。',
    [window.APP_MESSAGE_KEYS.RESET_PASSWORD_FAILED]: '密碼重設信寄送失敗，請稍後再試。',
    [window.APP_MESSAGE_KEYS.RESET_PASSWORD_SUCCESS]: '密碼已更新，請使用新密碼登入。',
    [window.APP_MESSAGE_KEYS.REPORT_SUCCESS]: '協尋案件提交成功！',
    [window.APP_MESSAGE_KEYS.REPORT_FAILED]:  '協尋案件提交失敗，請稍後再試。',
    [window.APP_MESSAGE_KEYS.SETTINGS_SAVED]: '設定已儲存。',
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
function setButtonLoading(btn, loadingText) {
    btn.disabled = true;
    btn._originalText = btn._originalText || btn.textContent;
    btn.innerHTML = `<span class="spinner"></span>${escapeHtml(loadingText)}`;
}

function resetButton(btn, text) {
    btn.disabled = false;
    btn.textContent = text || btn._originalText || '';
}

function sexLabel(s) {
    return s === 'M' ? '公' : s === 'F' ? '母' : s || '—';
}

function getAnimalImage(animal, width = 560, height = 420) {
    if (animal && animal.picture) return animal.picture;
    return `https://placehold.co/${width}x${height}/f7f7f5/6a6a6a?text=No+photo`;
}

function animalAltText(animal) {
    if (!animal) return '動物照片';
    const parts = [
        animal.kind,
        animal.variety,
        sexLabel(animal.sex),
        animal.colour,
    ].filter(Boolean);
    return `${parts.join('，') || '動物'}的照片`;
}

// ============================================================
//  Lightbox
// ============================================================

/**
 * Open a lightbox showing an animal's photo and shelter details.
 *
 * @param {{ picture?, variety?, kind?, sex?, colour?, found_place?,
 *           shelter_name?, shelter_address?, shelter_tel?,
 *           name?, address?, tel? }} animal - animal data (shelter fields optional)
 * @param {string|null} [animalId] - if provided AND no shelter_name in animal,
 *   fetches /api/animals/:id for shelter details
 */
function openLightbox(animal, animalId) {
    // Remove any existing overlay
    const existing = document.getElementById('ff-lightbox');
    if (existing) existing.remove();

    const overlay = document.createElement('div');
    overlay.id = 'ff-lightbox';
    overlay.className = 'lightbox-overlay';
    overlay.setAttribute('role', 'dialog');
    overlay.setAttribute('aria-modal', 'true');
    overlay.setAttribute('aria-label', animal.variety || '動物詳情');

    const previousFocus = document.activeElement;

    const imgSrc = getAnimalImage(animal, 720, 420);

    overlay.innerHTML = `
        <div class="lightbox-box">
            <img class="lightbox-img" src="${escapeHtml(imgSrc)}" alt="${animalAltText(animal)}">
            <button class="lightbox-close" aria-label="關閉">✕</button>
            <div class="lightbox-body">
                <h3>${escapeHtml(animal.variety || '未知品種')}</h3>
                <p><strong>物種:</strong> ${escapeHtml(animal.kind || '—')}</p>
                <p><strong>性別:</strong> ${sexLabel(animal.sex)}</p>
                <p><strong>毛色:</strong> ${escapeHtml(animal.colour || '—')}</p>
                ${animal.found_place ? `<p><strong>發現地點:</strong> ${escapeHtml(animal.found_place)}</p>` : ''}
                <div class="lightbox-shelter-info" id="lb-shelter">
                    <p class="text-muted-italic">載入收容所資訊...</p>
                </div>
            </div>
        </div>`;

    document.body.appendChild(overlay);
    requestAnimationFrame(() => {
        overlay.classList.add('open');
        const closeBtn = overlay.querySelector('.lightbox-close');
        if (closeBtn) closeBtn.focus();
    });

    function closeLightbox() {
        overlay.classList.remove('open');
        document.removeEventListener('keydown', handleKey);
        setTimeout(() => {
            overlay.remove();
            if (previousFocus) previousFocus.focus();
        }, 260);
    }

    // Close on background click or close button
    overlay.addEventListener('click', (e) => {
        if (e.target === overlay || e.target.classList.contains('lightbox-close')) {
            closeLightbox();
        }
    });

    // Close on Escape key (WCAG 2.1 accessibility requirement)
    function handleKey(e) {
        if (e.key === 'Escape') closeLightbox();
    }
    document.addEventListener('keydown', handleKey);

    // Shelter info: use embedded data if available, else fetch by id
    const shelterEl = document.getElementById('lb-shelter');
    // Support both aliased (shelter_name) and raw JOIN (name) field names
    const embeddedName    = animal.shelter_name || animal.name;
    const embeddedAddress = animal.shelter_address || animal.address;
    const embeddedTel     = animal.shelter_tel || animal.tel;

    function renderShelter(name, address, tel) {
        if (!shelterEl) return;
        if (name) {
            shelterEl.innerHTML = `
                <h4>收容所資訊</h4>
                <p><strong>名稱</strong> ${escapeHtml(name)}</p>
                ${address ? `<p><strong>地址</strong> ${escapeHtml(address)}</p>` : ''}
                ${tel     ? `<p><strong>電話</strong> <a href="tel:${escapeHtml(tel)}">${escapeHtml(tel)}</a></p>` : ''}`;
        } else {
            shelterEl.innerHTML = '<p class="text-muted">無收容所資訊</p>';
        }
    }

    if (embeddedName) {
        // Shelter info already present in the animal object — render immediately
        renderShelter(embeddedName, embeddedAddress, embeddedTel);
    } else if (animalId) {
        // Fetch from API only when we don't already have the data
        fetch(`/api/animals/${animalId}`)
            .then(r => r.ok ? r.json() : Promise.reject())
            .then(({ extras }) => {
                const a = extras.animal || {};
                renderShelter(a.shelter_name, a.shelter_address, a.shelter_tel);
            })
            .catch(() => {
                if (shelterEl) shelterEl.innerHTML = '<p class="text-muted">無法載入收容所資訊</p>';
            });
    } else {
        if (shelterEl) shelterEl.remove();
    }
}

// Auto-run on DOMContentLoaded for pages that include this script.
// Pages can override by calling handleUrlMessages(customMap) themselves.
document.addEventListener('DOMContentLoaded', () => {
    handleUrlMessages();
});

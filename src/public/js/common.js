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

// Auto-run on DOMContentLoaded for pages that include this script.
// Pages can override by calling handleUrlMessages(customMap) themselves.
document.addEventListener('DOMContentLoaded', () => {
    handleUrlMessages();
});

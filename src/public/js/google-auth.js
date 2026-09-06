(() => {
  const button = document.querySelector('.google-sign-in');
  if (!button) return;
  button.addEventListener('click', async () => {
    button.disabled = true;
    const requestedReturnTo = button.dataset.returnTo || '/profile';
    const allowedReturnTo = new Set(['/','/profile','/report-lost','/quick-use']);
    const returnTo = allowedReturnTo.has(requestedReturnTo) ? requestedReturnTo : '/profile';
    try {
      const response = await fetch('/api/auth/sign-in/social', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'same-origin',
        body: JSON.stringify({
          provider: 'google',
          callbackURL: returnTo,
          newUserCallbackURL: returnTo,
          errorCallbackURL: '/login?message=login-failed',
        }),
      });
      if (!response.ok) throw new Error('Google sign-in request failed');
      if (response.redirected) {
        window.location.assign(response.url);
        return;
      }
      const result = await response.json();
      if (typeof result?.url !== 'string' || !result.url.startsWith('https://accounts.google.com/')) {
        throw new Error('Invalid OAuth redirect URL');
      }
      window.location.assign(result.url);
    } catch {
      button.disabled = false;
      window.location.assign('/login?message=login-failed');
    }
  });
})();

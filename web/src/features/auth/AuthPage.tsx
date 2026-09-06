import { useState, type FormEvent } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { ApiError, post } from '../../api/client';
import { useResource } from '../../hooks/useResource';
import { useSession } from './SessionProvider';

const copy = {
    login: [
        '登入 FurFriend Finder',
        '登入後可以建立協尋案件、管理通知設定，並保留後續配對通知。',
        '登入',
    ],
    register: [
        '註冊新帳號',
        '建立帳號後，可以登記協尋案件並接收後續配對通知。',
        '建立帳號',
    ],
    forgot: ['忘記密碼', '我們會寄送重設連結到你的信箱。', '寄送重設連結'],
    reset: ['設定新密碼', '請使用至少 8 個字元的新密碼。', '更新密碼'],
} as const;
type Mode = keyof typeof copy;

export function AuthPage({ mode }: { mode: Mode }) {
    const [params] = useSearchParams();
    const navigate = useNavigate();
    const session = useSession();
    const config = useResource<{ googleOAuthEnabled: boolean }>(
        '/api/v1/config',
    );
    const [busy, setBusy] = useState(false);
    const [error, setError] = useState('');
    const [message, setMessage] = useState('');
    const [title, description, submitText] = copy[mode];
    const requestedPath = params.get('returnTo') ?? '/profile';
    const returnTo = /^\/(profile|report-lost|quick-use|reports\/\d+)$/.test(
        requestedPath,
    )
        ? requestedPath
        : '/profile';
    const callbackURL = `${window.location.origin}/login?verified=1`;

    async function submit(event: FormEvent<HTMLFormElement>) {
        event.preventDefault();
        const values = Object.fromEntries(new FormData(event.currentTarget));
        setBusy(true);
        setError('');
        setMessage('');
        try {
            if (mode === 'login') {
                await post('/api/auth/sign-in/email', {
                    ...values,
                    callbackURL,
                });
                session.refresh();
                navigate(returnTo, { replace: true });
            } else if (mode === 'register') {
                await post('/api/auth/sign-up/email', {
                    ...values,
                    callbackURL,
                });
                setMessage('驗證信已寄出，請先完成信箱驗證，再回來登入。');
            } else if (mode === 'forgot') {
                await post('/api/auth/request-password-reset', {
                    ...values,
                    redirectTo: `${window.location.origin}/reset-password`,
                });
                setMessage('若此信箱已註冊，你將收到密碼重設信。');
            } else {
                await post('/api/auth/reset-password', {
                    token: params.get('token'),
                    newPassword: values.password,
                });
                setMessage('密碼已更新，請使用新密碼登入。');
            }
        } catch (err) {
            const failure = err as ApiError;
            setError(
                failure.code === 'EMAIL_NOT_VERIFIED'
                    ? '請先到信箱完成驗證；若登入資料正確，系統會重新寄送驗證信。'
                    : failure.message,
            );
        } finally {
            setBusy(false);
        }
    }

    async function google() {
        setBusy(true);
        setError('');
        try {
            const result = await post<{ url: string }>(
                '/api/auth/sign-in/social',
                {
                    provider: 'google',
                    callbackURL: `${window.location.origin}${returnTo}`,
                },
            );
            window.location.assign(result.url);
        } catch (err) {
            setError((err as Error).message);
            setBusy(false);
        }
    }

    return (
        <section className="auth-card auth-panel">
            <p className="auth-brand">FurFriend Finder</p>
            <p className="eyebrow">
                {mode === 'register' ? 'Create account' : 'Account'}
            </p>
            <h1>{title}</h1>
            <p className="auth-copy">{description}</p>
            {params.has('verified') && (
                <p className="notice" role="status">
                    信箱驗證完成，請登入。
                </p>
            )}
            {params.has('error') && (
                <p className="notice error" role="alert">
                    驗證連結無效或已過期，請重新申請。
                </p>
            )}
            {message && (
                <p className="notice" role="status">
                    {message}
                </p>
            )}
            {error && (
                <p className="notice error" role="alert">
                    {error}
                </p>
            )}
            <form onSubmit={submit}>
                {mode === 'register' && (
                    <label>
                        姓名
                        <input
                            name="name"
                            autoComplete="name"
                            required
                            maxLength={100}
                        />
                    </label>
                )}
                {mode !== 'reset' && (
                    <label>
                        Email
                        <input
                            name="email"
                            type="email"
                            autoComplete="email"
                            required
                        />
                    </label>
                )}
                {mode !== 'forgot' && (
                    <label>
                        {mode === 'reset' ? '新密碼' : '密碼'}
                        <input
                            name="password"
                            type="password"
                            minLength={8}
                            maxLength={128}
                            autoComplete={
                                mode === 'login'
                                    ? 'current-password'
                                    : 'new-password'
                            }
                            required
                        />
                    </label>
                )}
                <button
                    className="primary full"
                    disabled={
                        busy || (mode === 'reset' && !params.get('token'))
                    }
                >
                    {busy ? '處理中…' : submitText}
                </button>
            </form>
            {(mode === 'login' || mode === 'register') &&
                config.data?.googleOAuthEnabled && (
                    <>
                        <div className="oauth-divider">或</div>
                        <button
                            className="full"
                            disabled={busy}
                            onClick={google}
                        >
                            使用 Google 繼續
                        </button>
                    </>
                )}
            <nav className="auth-links" aria-label="帳號操作">
                {mode !== 'login' && (
                    <Link to="/login">已有帳號，前往登入</Link>
                )}
                {mode === 'login' && (
                    <>
                        <Link to="/register">建立新帳號</Link>
                        <Link to="/forgot-password">忘記密碼？</Link>
                    </>
                )}
                <Link to="/">返回首頁</Link>
            </nav>
        </section>
    );
}

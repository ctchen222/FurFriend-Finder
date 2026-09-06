import { useEffect, useRef, useState, type FormEvent } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import type { OrganizationWorkspace } from '../../../../src/contracts/organizations';
import { post } from '../../api/client';
import { useSession } from '../auth/SessionProvider';

export function CreateOrganizationPage() {
    const { user } = useSession();
    return <CreateForm key={user?.id} />;
}

function CreateForm() {
    const { user } = useSession();
    const navigate = useNavigate();
    const [busy, setBusy] = useState(false);
    const [dirty, setDirty] = useState(false);
    const [error, setError] = useState('');
    const attempt = useRef<{ payload: string; requestId: string } | null>(null);
    const active = useRef(true);
    useEffect(() => {
        active.current = true;
        return () => {
            active.current = false;
        };
    }, []);
    useEffect(() => {
        const warn = (event: BeforeUnloadEvent) => {
            if (dirty) {
                event.preventDefault();
                event.returnValue = '';
            }
        };
        window.addEventListener('beforeunload', warn);
        return () => window.removeEventListener('beforeunload', warn);
    }, [dirty]);
    async function submit(event: FormEvent<HTMLFormElement>) {
        event.preventDefault();
        if (busy) return;
        const fields = Object.fromEntries(new FormData(event.currentTarget));
        const payload = JSON.stringify(fields);
        if (attempt.current?.payload !== payload)
            attempt.current = { payload, requestId: crypto.randomUUID() };
        setBusy(true);
        setError('');
        try {
            const result = await post<{ organization: OrganizationWorkspace }>(
                '/api/v1/organizations',
                { ...fields, requestId: attempt.current.requestId },
            );
            if (active.current) {
                setDirty(false);
                navigate(`/orgs/${result.organization.id}`, { replace: true });
            }
        } catch (err) {
            if (active.current) setError((err as Error).message);
        } finally {
            if (active.current) setBusy(false);
        }
    }
    return (
        <>
            <header className="page-heading">
                <h1>建立中途之家</h1>
            </header>
            <section className="panel organization-form">
                {!user?.emailVerified && (
                    <p role="alert" className="notice">
                        請先完成信箱驗證，再建立中途之家。
                    </p>
                )}
                <form
                    onSubmit={submit}
                    onChange={() => setDirty(true)}
                    aria-label="建立中途之家"
                >
                    <fieldset disabled={busy || !user?.emailVerified}>
                        <label>
                            中途之家名稱
                            <input
                                name="name"
                                required
                                maxLength={100}
                                autoComplete="organization"
                            />
                        </label>
                        <label>
                            類型
                            <select name="type">
                                <option value="INDIVIDUAL">個人中途</option>
                                <option value="GROUP">救援團隊</option>
                            </select>
                        </label>
                        <label>
                            所在縣市
                            <input
                                name="city"
                                maxLength={30}
                                placeholder="例如：臺北市"
                            />
                        </label>
                        <label>
                            介紹
                            <textarea name="description" maxLength={3000} />
                        </label>
                        <label>
                            預計公開的聯絡方式
                            <input
                                name="publicContact"
                                maxLength={300}
                                aria-describedby="contact-help"
                            />
                        </label>
                        <p id="contact-help" className="muted">
                            可先留白。請只填願意公開的資訊，不需要提供住家地址。
                        </p>
                    </fieldset>
                    {error && (
                        <div role="alert" className="notice error">
                            <p>{error}</p>
                            <p>
                                若不確定是否成功，可先查看組織清單；保持相同內容重試不會重複建立。
                            </p>
                        </div>
                    )}
                    <div className="actions">
                        <button
                            className="primary"
                            disabled={busy || !user?.emailVerified}
                        >
                            {busy ? '建立中…' : '建立組織'}
                        </button>
                        <Link
                            to="/organizations"
                            onClick={(event) => {
                                if (
                                    dirty &&
                                    !window.confirm(
                                        '離開後未儲存的內容不會保留，確定離開？',
                                    )
                                )
                                    event.preventDefault();
                            }}
                        >
                            返回組織清單
                        </Link>
                    </div>
                </form>
            </section>
        </>
    );
}

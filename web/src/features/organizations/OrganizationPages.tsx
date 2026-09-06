import { Link, useParams, useSearchParams } from 'react-router-dom';
import { useEffect } from 'react';
import type {
    OrganizationPage,
    OrganizationWorkspace,
} from '../../../../src/contracts/organizations';
import { useResource } from '../../hooks/useResource';
import { Feedback } from '../../ui/Feedback';
import { useSession } from '../auth/SessionProvider';

const roles = { OWNER: '負責人', ADMIN: '管理員', EDITOR: '編輯者' };
const reviews = {
    PENDING: '待審核',
    APPROVED: '已核准',
    REJECTED: '需修正後重送',
};
const operations = { ACTIVE: '運作中', SUSPENDED: '已停權', CLOSED: '已關閉' };

export function OrganizationsPage() {
    const { user } = useSession();
    const [params] = useSearchParams();
    return (
        <OrganizationList key={`${user?.id}:${params.get('cursor') ?? ''}`} />
    );
}

function OrganizationList() {
    const [params, setParams] = useSearchParams();
    const cursor = params.get('cursor');
    const query = new URLSearchParams({ pageSize: '20' });
    if (cursor) query.set('cursor', cursor);
    const result = useResource<OrganizationPage>(
        `/api/v1/organizations?${query}`,
    );
    return (
        <>
            <header className="page-heading">
                <p className="eyebrow">My organizations</p>
                <h1>我的中途之家</h1>
                <p>用同一個帳號管理個人協尋，以及你參與的中途之家。</p>
            </header>
            <div className="actions">
                <Link to="/profile">← 個人空間</Link>
                <Link className="button primary" to="/organizations/new">
                    建立中途之家
                </Link>
            </div>
            <Feedback
                loading={result.loading}
                error={result.error}
                retry={result.reload}
            />
            {result.data && (
                <>
                    {!result.data.organizations.length && (
                        <section className="empty">
                            <h2>尚未加入中途之家</h2>
                            <p>
                                個人中途或救援團隊都可以建立組織。建立後不會立即公開。
                            </p>
                        </section>
                    )}
                    <ul className="organization-list">
                        {result.data.organizations.map((org) => (
                            <li className="panel" key={org.id}>
                                <h2>
                                    <Link to={`/orgs/${org.id}`}>
                                        {org.name}
                                    </Link>
                                </h2>
                                <p>
                                    {org.city || '地區未提供'} ·{' '}
                                    {roles[org.role]}
                                </p>
                                <p className="muted">
                                    {reviews[org.reviewStatus]} ·{' '}
                                    {operations[org.operationalStatus]} ·{' '}
                                    {org.publishedAt ? '已公開' : '尚未公開'}
                                </p>
                            </li>
                        ))}
                    </ul>
                    <nav className="actions" aria-label="組織分頁">
                        {cursor && (
                            <button onClick={() => setParams({})}>
                                回第一頁
                            </button>
                        )}
                        {result.data.nextCursor && (
                            <button
                                onClick={() =>
                                    setParams({
                                        cursor: result.data!.nextCursor!,
                                    })
                                }
                            >
                                下一頁
                            </button>
                        )}
                    </nav>
                </>
            )}
        </>
    );
}

export function OrganizationWorkspacePage() {
    const { id = '' } = useParams();
    const { user } = useSession();
    // Remount when either identity changes: never render the preceding tenant's cached data.
    return <Workspace key={`${user?.id}:${id}`} id={id} />;
}

function Workspace({ id }: { id: string }) {
    const result = useResource<{ organization: OrganizationWorkspace }>(
        `/api/v1/organizations/${encodeURIComponent(id)}`,
    );
    useEffect(() => {
        window.addEventListener('focus', result.reload);
        return () => window.removeEventListener('focus', result.reload);
    }, [result.reload]);
    const org = result.data?.organization;
    return (
        <>
            <nav className="actions" aria-label="工作空間">
                <Link to="/profile">個人空間</Link>
                <Link to="/organizations">切換組織</Link>
                <button onClick={result.reload}>更新狀態</button>
            </nav>
            <Feedback
                loading={result.loading}
                error={result.error}
                retry={result.reload}
            />
            {org && !result.loading && !result.error && (
                <>
                    <header className="page-heading organization-heading">
                        <p className="eyebrow">組織工作空間</p>
                        <h1>{org.name}</h1>
                        <p>
                            你的角色：<span>{roles[org.role]}</span>
                        </p>
                    </header>
                    <section className="panel">
                        <h2>組織狀態</h2>
                        <dl className="organization-details">
                            <dt>審核</dt>
                            <dd>{reviews[org.reviewStatus]}</dd>
                            <dt>營運</dt>
                            <dd>{operations[org.operationalStatus]}</dd>
                            <dt>公開頁面</dt>
                            <dd>{org.publishedAt ? '已公開' : '尚未公開'}</dd>
                        </dl>
                        <p className="notice">
                            這是成員專用頁面。公開介紹與動物刊登會在審核、發布功能完成後開放。
                        </p>
                    </section>
                    <section className="panel">
                        <h2>介紹資料</h2>
                        <dl className="organization-details">
                            <dt>類型</dt>
                            <dd>
                                {org.type === 'INDIVIDUAL'
                                    ? '個人中途'
                                    : '救援團隊'}
                            </dd>
                            <dt>地區</dt>
                            <dd>{org.city || '未提供'}</dd>
                            <dt>介紹</dt>
                            <dd className="preserve-lines">
                                {org.description || '尚未填寫'}
                            </dd>
                            <dt>預計公開的聯絡方式</dt>
                            <dd>{org.publicContact || '尚未填寫'}</dd>
                        </dl>
                    </section>
                </>
            )}
        </>
    );
}

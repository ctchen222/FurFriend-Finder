import { Link, useParams, useSearchParams } from 'react-router-dom';
import { useEffect } from 'react';
import type {
    OrganizationPage,
    OrganizationWorkspace,
} from '../../../../src/contracts/organizations';
import { useResource } from '../../hooks/useResource';
import { Feedback } from '../../ui/Feedback';
import { OrganizationMembers } from './OrganizationMembers';
import { OrganizationProfileEditor } from './OrganizationProfileEditor';
import { useSession } from '../auth/SessionProvider';

const roles = { OWNER: '負責人', ADMIN: '管理員', EDITOR: '編輯者' };
const reviews = {
    PENDING: '待審核',
    APPROVED: '已核准',
    REJECTED: '需修正後重送',
};
const operations = { ACTIVE: '運作中', SUSPENDED: '已停權', CLOSED: '已關閉' };

function organizationStatus(org: OrganizationWorkspace) {
    if (org.operationalStatus !== 'ACTIVE')
        return operations[org.operationalStatus];
    if (org.reviewStatus !== 'APPROVED') return reviews[org.reviewStatus];
    return org.publishedAt ? '已公開' : '尚未公開';
}

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
                <h1>我的中途之家</h1>
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
                        </section>
                    )}
                    <ul className="organization-list public-organization-grid">
                        {result.data.organizations.map((org) => (
                            <li
                                className="panel organization-card"
                                key={org.id}
                            >
                                <Link
                                    className="organization-card-link"
                                    aria-label={org.name}
                                    to={`/orgs/${org.id}`}
                                >
                                    <p className="organization-card-meta">
                                        <span className="organization-type">
                                            {roles[org.role]}
                                        </span>
                                        {org.city && <span>{org.city}</span>}
                                    </p>
                                    <h2>{org.name}</h2>
                                    <p className="muted">
                                        {organizationStatus(org)}
                                    </p>
                                    <span className="organization-card-action">
                                        管理中途之家{' '}
                                        <span aria-hidden="true">→</span>
                                    </span>
                                </Link>
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
        `/api/v1/organizations/${encodeURIComponent(id)}/profile`,
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
            </nav>
            <Feedback
                loading={result.loading}
                error={result.error}
                retry={result.reload}
            />
            {org && !result.loading && !result.error && (
                <>
                    <header className="page-heading organization-heading">
                        <h1>{org.name}</h1>
                        <p>
                            <span>{roles[org.role]}</span> ·{' '}
                            <span>{organizationStatus(org)}</span>
                        </p>
                    </header>
                    <section className="panel section-heading">
                        <div>
                            <h2>動物管理</h2>
                            <p className="muted">
                                整理照片與介紹，讓等待家的毛孩被看見。
                            </p>
                        </div>
                        <Link
                            className="button primary"
                            to={`/orgs/${org.id}/animals`}
                        >
                            管理動物
                        </Link>
                    </section>
                    <OrganizationProfileEditor
                        key={org.version}
                        organization={org}
                        onChanged={(organization) =>
                            result.updateData(() => ({ organization }))
                        }
                    />
                    <OrganizationMembers organizationId={org.id} />
                </>
            )}
        </>
    );
}

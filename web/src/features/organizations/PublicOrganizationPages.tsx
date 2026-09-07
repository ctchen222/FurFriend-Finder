import { Link, useParams, useSearchParams } from 'react-router-dom';
import type {
    PublicOrganization,
    PublicOrganizationPage,
} from '../../../../src/contracts/organizations';
import { useResource } from '../../hooks/useResource';
import { Feedback } from '../../ui/Feedback';

const typeLabel = { INDIVIDUAL: '個人中途', GROUP: '救援團隊' };

export function PublicOrganizationsPage() {
    const [params, setParams] = useSearchParams();
    const query = new URLSearchParams({ pageSize: '20' });
    for (const key of ['q', 'city', 'type', 'cursor']) {
        const value = params.get(key);
        if (value) query.set(key, value);
    }
    const result = useResource<PublicOrganizationPage>(
        `/api/v1/public/organizations?${query}`,
    );
    return (
        <>
            <header className="page-heading">
                <h1>中途之家</h1>
                <p>認識已通過平台審核、並選擇公開資訊的中途夥伴。</p>
            </header>
            <form
                className="filter-bar foster-filter-bar"
                key={params.toString()}
                onSubmit={(event) => {
                    event.preventDefault();
                    const values = new FormData(event.currentTarget);
                    const next = new URLSearchParams();
                    for (const key of ['q', 'city', 'type']) {
                        const value = String(values.get(key) ?? '').trim();
                        if (value) next.set(key, value);
                    }
                    setParams(next);
                }}
            >
                <label>
                    名稱或介紹
                    <input
                        name="q"
                        maxLength={100}
                        defaultValue={params.get('q') ?? ''}
                        placeholder="例如：貓咪、奶貓"
                    />
                </label>
                <label>
                    縣市
                    <input
                        name="city"
                        maxLength={30}
                        defaultValue={params.get('city') ?? ''}
                        placeholder="例如：臺北市"
                    />
                </label>
                <label>
                    類型
                    <select name="type" defaultValue={params.get('type') ?? ''}>
                        <option value="">全部</option>
                        <option value="INDIVIDUAL">個人中途</option>
                        <option value="GROUP">救援團隊</option>
                    </select>
                </label>
                <div className="filter-actions">
                    <button className="primary">搜尋</button>
                    <button type="button" onClick={() => setParams({})}>
                        清除
                    </button>
                </div>
            </form>
            <Feedback
                loading={result.loading}
                error={result.error}
                retry={result.reload}
            />
            {result.data && !result.data.organizations.length && (
                <section className="empty">
                    <h2>目前沒有符合條件的中途之家</h2>
                    <p>可以清除部分條件後再找找看。</p>
                </section>
            )}
            {result.data && (
                <>
                    <ul className="organization-list public-organization-grid">
                        {result.data.organizations.map((organization) => (
                            <PublicOrganizationCard
                                key={organization.id}
                                organization={organization}
                            />
                        ))}
                    </ul>
                    <nav className="actions" aria-label="中途之家分頁">
                        {params.has('cursor') && (
                            <button
                                onClick={() => {
                                    const next = new URLSearchParams(params);
                                    next.delete('cursor');
                                    setParams(next);
                                }}
                            >
                                回第一頁
                            </button>
                        )}
                        {result.data.nextCursor && (
                            <button
                                className="primary"
                                onClick={() => {
                                    const next = new URLSearchParams(params);
                                    next.set(
                                        'cursor',
                                        result.data!.nextCursor!,
                                    );
                                    setParams(next);
                                }}
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

function PublicOrganizationCard({
    organization,
}: {
    organization: PublicOrganization;
}) {
    return (
        <li className="panel">
            <p className="muted">
                {typeLabel[organization.type]}
                {organization.city ? ` · ${organization.city}` : ''}
            </p>
            <h2>
                <Link to={`/foster-organizations/${organization.id}`}>
                    {organization.name}
                </Link>
            </h2>
            <p className="organization-summary">
                {organization.description || '這個中途之家尚未填寫介紹。'}
            </p>
        </li>
    );
}

export function PublicOrganizationDetailPage() {
    const { id = '' } = useParams();
    const result = useResource<{ organization: PublicOrganization }>(
        `/api/v1/public/organizations/${encodeURIComponent(id)}`,
    );
    const organization = result.data?.organization;
    return (
        <>
            <nav className="actions">
                <Link to="/foster-organizations">← 所有中途之家</Link>
            </nav>
            <Feedback
                loading={result.loading}
                error={result.error}
                retry={result.reload}
            />
            {organization && (
                <article>
                    <header className="page-heading">
                        <p>
                            {typeLabel[organization.type]}
                            {organization.city ? ` · ${organization.city}` : ''}
                        </p>
                        <h1>{organization.name}</h1>
                    </header>
                    <section className="panel public-organization-detail">
                        <h2>關於我們</h2>
                        <p className="preserve-lines">
                            {organization.description || '尚未提供介紹。'}
                        </p>
                        {organization.publicContact && (
                            <>
                                <h2>聯絡方式</h2>
                                <p className="preserve-lines">
                                    {organization.publicContact}
                                </p>
                            </>
                        )}
                    </section>
                </article>
            )}
        </>
    );
}

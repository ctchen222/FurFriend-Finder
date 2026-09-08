import { useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import type {
    ReviewerOrganization,
    ReviewerOrganizationPage,
} from '../../../../src/contracts/organizations';
import { post } from '../../api/client';
import { useResource } from '../../hooks/useResource';
import { Feedback } from '../../ui/Feedback';
import { useSession } from '../auth/SessionProvider';
import { NoticeDeliveryStatus } from './NoticeDeliveryStatus';

const views = {
    PENDING: '待審核',
    APPROVED: '已核准',
    REJECTED: '已退回',
    SUSPENDED: '已停權',
} as const;

export function ReviewerOrganizationsPage() {
    const { user } = useSession();
    const [params, setParams] = useSearchParams();
    const view = (params.get('view') ?? 'PENDING') as keyof typeof views;
    const safeView = view in views ? view : 'PENDING';
    const result = useResource<ReviewerOrganizationPage>(
        `/api/v1/reviewer/organizations?view=${safeView}&pageSize=20`,
    );
    if (!user?.isOrganizationReviewer) {
        return (
            <section className="empty organization-action-page">
                <h1>無法開啟審核工作台</h1>
                <p>你的帳號沒有平台審核權限。</p>
            </section>
        );
    }
    return (
        <>
            <header className="page-heading">
                <h1>中途之家審核</h1>
                <p>審核權限獨立於組織角色，也不能處理自己參與的組織。</p>
            </header>
            <NoticeDeliveryStatus key={user.id} />
            <nav className="review-tabs" aria-label="審核狀態">
                {Object.entries(views).map(([value, label]) => (
                    <button
                        key={value}
                        aria-current={safeView === value ? 'page' : undefined}
                        onClick={() => setParams({ view: value })}
                    >
                        {label}
                    </button>
                ))}
            </nav>
            <Feedback
                loading={result.loading}
                error={result.error}
                retry={result.reload}
            />
            {result.data && !result.data.organizations.length && (
                <section className="empty">
                    <h2>這裡目前沒有項目</h2>
                </section>
            )}
            {result.data?.organizations.map((organization) => (
                <ReviewCard
                    key={`${organization.id}:${organization.version}`}
                    organization={organization}
                    view={safeView}
                    reload={result.reload}
                />
            ))}
        </>
    );
}

function ReviewCard({
    organization,
    view,
    reload,
}: {
    organization: ReviewerOrganization;
    view: keyof typeof views;
    reload: () => void;
}) {
    const [reason, setReason] = useState('');
    const [busy, setBusy] = useState(false);
    const [error, setError] = useState('');
    async function act(path: string, body: object) {
        setBusy(true);
        setError('');
        try {
            await post(path, {
                expectedVersion: organization.version,
                ...body,
            });
            reload();
        } catch (caught) {
            setError((caught as Error).message);
            setBusy(false);
        }
    }
    const base = `/api/v1/reviewer/organizations/${organization.id}`;
    return (
        <article className="panel reviewer-card">
            <div className="section-heading">
                <div>
                    <h2>{organization.name}</h2>
                    <p className="muted">
                        {organization.type === 'INDIVIDUAL'
                            ? '個人中途'
                            : '救援團隊'}
                        {organization.city ? ` · ${organization.city}` : ''}
                    </p>
                </div>
                <span>{views[view]}</span>
            </div>
            {organization.description && (
                <p className="preserve-lines">{organization.description}</p>
            )}
            {organization.publicContact && (
                <p>
                    <strong>公開聯絡：</strong>
                    {organization.publicContact}
                </p>
            )}
            {organization.reviewReason && (
                <p className="notice">
                    <strong>最近審核理由：</strong>
                    {organization.reviewReason}
                </p>
            )}
            <label>
                處理理由
                <textarea
                    maxLength={500}
                    value={reason}
                    onChange={(event) => setReason(event.target.value)}
                    placeholder={
                        view === 'PENDING'
                            ? '核准可留白；退回請具體說明'
                            : '停權或恢復皆需填寫理由'
                    }
                />
            </label>
            <div className="actions">
                {view === 'PENDING' && (
                    <>
                        <button
                            className="primary"
                            disabled={busy}
                            onClick={() =>
                                void act(`${base}/reviews`, {
                                    decision: 'APPROVED',
                                    reason,
                                })
                            }
                        >
                            核准
                        </button>
                        <button
                            disabled={busy || reason.trim().length < 5}
                            onClick={() =>
                                void act(`${base}/reviews`, {
                                    decision: 'REJECTED',
                                    reason,
                                })
                            }
                        >
                            退回修改
                        </button>
                    </>
                )}
                {view !== 'SUSPENDED' && (
                    <button
                        className="danger"
                        disabled={busy || reason.trim().length < 5}
                        onClick={() =>
                            void act(`${base}/suspensions`, { reason })
                        }
                    >
                        停權
                    </button>
                )}
                {view === 'SUSPENDED' && (
                    <button
                        className="primary"
                        disabled={busy || reason.trim().length < 5}
                        onClick={() =>
                            void act(`${base}/reactivations`, { reason })
                        }
                    >
                        恢復運作
                    </button>
                )}
            </div>
            {error && (
                <p className="notice error" role="alert">
                    {error}
                </p>
            )}
        </article>
    );
}

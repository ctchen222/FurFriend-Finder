import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import {
    notificationLabels,
    type OrganizationNotificationPage,
} from '../../../../src/contracts/organizationNotifications';
import { useResource } from '../../hooks/useResource';
import { post } from '../../api/client';
import { Feedback } from '../../ui/Feedback';

export function OrganizationNotifications() {
    const [cursor, setCursor] = useState('');
    const result = useResource<OrganizationNotificationPage>(
        `/api/v1/me/organization-notifications?pageSize=10${cursor ? `&cursor=${cursor}` : ''}`,
    );
    const [busy, setBusy] = useState<string | null>(null);
    const [error, setError] = useState('');
    useEffect(() => {
        window.addEventListener('focus', result.reload);
        return () => window.removeEventListener('focus', result.reload);
    }, [result.reload]);
    async function markRead(id: string) {
        setBusy(id);
        setError('');
        try {
            await post(`/api/v1/me/organization-notifications/${id}/read`, {});
            result.reload();
        } catch (err) {
            setError((err as Error).message);
        } finally {
            setBusy(null);
        }
    }
    return (
        <section
            className="card"
            aria-labelledby="organization-notifications-heading"
        >
            <div className="section-heading">
                <h2 id="organization-notifications-heading">
                    中途之家通知
                    {result.data && result.data.unreadCount > 0
                        ? ` · ${result.data.unreadCount} 則未讀`
                        : ''}
                </h2>
                <button
                    type="button"
                    onClick={result.reload}
                    disabled={result.loading}
                >
                    重新整理
                </button>
            </div>
            <Feedback
                loading={result.loading}
                error={result.error}
                retry={result.reload}
            />
            {error && <p role="alert">{error}</p>}
            {result.data && !result.loading && !result.error && (
                <>
                    {!result.data.notifications.length && (
                        <p className="muted">
                            目前沒有通知。新的審核結果會出現在這裡。
                        </p>
                    )}
                    <ul className="organization-notification-list">
                        {result.data.notifications.map((notice) => (
                            <li
                                key={notice.id}
                                className={`organization-notification ${notice.readAt ? '' : 'is-unread'}`}
                            >
                                <div className="notification-meta">
                                    {!notice.readAt && (
                                        <span className="badge">未讀</span>
                                    )}
                                    <time dateTime={notice.createdAt}>
                                        {new Date(
                                            notice.createdAt,
                                        ).toLocaleString('zh-TW')}
                                    </time>
                                </div>
                                <h3>
                                    {notice.organizationName} ·{' '}
                                    {notificationLabels[notice.kind].title}
                                </h3>
                                {notice.reason && (
                                    <p className="preserve-lines">
                                        {notice.reason}
                                    </p>
                                )}
                                <p>
                                    {notificationLabels[notice.kind].nextStep}
                                </p>
                                <div className="actions">
                                    <Link
                                        className="button"
                                        to={`/orgs/${notice.organizationId}`}
                                    >
                                        查看組織最新狀態
                                    </Link>
                                    {!notice.readAt && (
                                        <button
                                            disabled={busy !== null}
                                            onClick={() =>
                                                void markRead(notice.id)
                                            }
                                        >
                                            {busy === notice.id
                                                ? '儲存中…'
                                                : '標為已讀'}
                                        </button>
                                    )}
                                </div>
                            </li>
                        ))}
                    </ul>
                    <nav className="actions" aria-label="通知分頁">
                        {cursor && (
                            <button onClick={() => setCursor('')}>
                                最新通知
                            </button>
                        )}
                        {result.data.nextCursor && (
                            <button
                                onClick={() =>
                                    setCursor(result.data!.nextCursor!)
                                }
                            >
                                較早通知
                            </button>
                        )}
                    </nav>
                </>
            )}
        </section>
    );
}

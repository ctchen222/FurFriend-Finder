import { useState } from 'react';
import type { NoticeDeliveryHealth } from '../../../../src/contracts/organizationNotifications';
import { notificationLabels } from '../../../../src/contracts/organizationNotifications';
import { useResource } from '../../hooks/useResource';
import { post } from '../../api/client';
import { Feedback } from '../../ui/Feedback';

const failureLabels: Record<string, string> = {
    auth: '郵件服務認證失敗',
    network: '無法連線郵件服務',
    timeout: '郵件服務逾時',
    smtp_rejected: '郵件服務拒收',
    unknown: '寄送失敗',
};
export function NoticeDeliveryStatus() {
    const [open, setOpen] = useState(false);
    const [cursor, setCursor] = useState('');
    const result = useResource<NoticeDeliveryHealth>(
        `/api/v1/reviewer/notice-deliveries${cursor ? `?cursor=${cursor}` : ''}`,
        30_000,
    );
    const [busy, setBusy] = useState<string | null>(null);
    const [error, setError] = useState('');
    const [message, setMessage] = useState('');
    async function retry(id: string) {
        if (
            !window.confirm(
                '將重新排入寄送。若上次郵件已被接受但未能記錄，可能收到重複信件。確定重送？',
            )
        )
            return;
        setBusy(id);
        setError('');
        setMessage('');
        try {
            await post(`/api/v1/reviewer/notice-deliveries/${id}/retries`, {});
            setMessage('已重新排入寄送，尚不代表郵件已送達。');
            result.reload();
        } catch (err) {
            setError((err as Error).message);
        } finally {
            setBusy(null);
        }
    }
    const needsAttention =
        result.error ||
        (result.data &&
            (!result.data.workerHealthy ||
                result.data.failed > 0 ||
                result.data.oldestOverdueSeconds > 300));
    return (
        <details
            className="panel delivery-status"
            onToggle={(event) => setOpen(event.currentTarget.open)}
        >
            <summary>
                <span>通知寄送狀態</span>
                {needsAttention && (
                    <span className="badge" role="status">
                        需要處理
                    </span>
                )}
            </summary>
            {open && (
                <>
                    <Feedback
                        loading={result.loading}
                        error={result.error}
                        retry={result.reload}
                    />
                    {error && <p role="alert">{error}</p>}
                    {message && <p role="status">{message}</p>}
                    {result.data && !result.error && (
                        <>
                            {!result.data.workerHealthy && (
                                <p role="alert">
                                    背景寄信服務尚未啟動或已中斷，請檢查
                                    worker。站內通知不受影響。
                                </p>
                            )}
                            {result.data.oldestOverdueSeconds > 300 && (
                                <p role="alert">
                                    有通知已超過 5 分鐘未處理，請檢查寄送服務。
                                </p>
                            )}
                            <p>
                                {result.data.workerHealthy
                                    ? '背景寄信服務運作中'
                                    : '需要檢查寄信服務'}{' '}
                                · 等待處理 {result.data.pending} 筆 · 寄送失敗{' '}
                                {result.data.failed} 筆
                            </p>
                            <p className="muted">
                                這裡顯示審核通知的寄送狀態，不代表收件匣投遞或已讀。已無權限的收件人不能重送。
                            </p>
                            <ul className="organization-notification-list">
                                {result.data.failures.map((item) => (
                                    <li
                                        key={item.id}
                                        className="organization-notification"
                                    >
                                        <h3>
                                            {item.organizationName} ·{' '}
                                            {
                                                notificationLabels[item.kind]
                                                    .title
                                            }
                                        </h3>
                                        <p>
                                            {failureLabels[item.errorCode] ??
                                                '寄送失敗'}{' '}
                                            · 已嘗試 {item.attempts} 次
                                        </p>
                                        <button
                                            disabled={busy !== null}
                                            onClick={() => void retry(item.id)}
                                        >
                                            {busy === item.id
                                                ? '處理中…'
                                                : '重新寄送'}
                                        </button>
                                    </li>
                                ))}
                            </ul>
                            <nav className="actions" aria-label="寄送失敗分頁">
                                {cursor && (
                                    <button onClick={() => setCursor('')}>
                                        回第一頁
                                    </button>
                                )}
                                {result.data.nextCursor && (
                                    <button
                                        onClick={() =>
                                            setCursor(result.data!.nextCursor!)
                                        }
                                    >
                                        下一頁
                                    </button>
                                )}
                                <button
                                    onClick={result.reload}
                                    disabled={result.loading}
                                >
                                    重新整理寄送狀態
                                </button>
                            </nav>
                        </>
                    )}
                </>
            )}
        </details>
    );
}

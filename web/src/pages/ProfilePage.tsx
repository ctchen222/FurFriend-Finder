import { useState } from 'react';
import { Link } from 'react-router-dom';
import type { LostReport } from '../../../src/contracts/web';
import { useResource } from '../hooks/useResource';
import { useSession } from '../features/auth/SessionProvider';
import { reportStatusLabel } from '../features/reports/reportApi';
import { patch } from '../api/client';
import { Feedback } from '../ui/Feedback';

export function ProfilePage() {
    const { user, updateMailPreference } = useSession();
    const result = useResource<{ reports: LostReport[] }>('/api/v1/reports');
    const [saving, setSaving] = useState(false);
    const [message, setMessage] = useState('');
    const [error, setError] = useState('');
    const [enabled, setEnabled] = useState(
        user?.isLostAnimalMailEnabled ?? false,
    );
    async function toggle(nextEnabled: boolean) {
        const previous = enabled;
        setEnabled(nextEnabled);
        setSaving(true);
        setMessage('');
        setError('');
        try {
            const saved = await patch<{ enabled: boolean }>(
                '/api/v1/me/settings',
                { enabled: nextEnabled },
            );
            setEnabled(saved.enabled);
            updateMailPreference(saved.enabled);
            setMessage('通知設定已儲存');
        } catch (err) {
            setEnabled(previous);
            setError((err as Error).message);
        } finally {
            setSaving(false);
        }
    }
    return (
        <>
            <div className="page-hero page-hero--compact page-hero--left">
                <p className="eyebrow">Profile</p>
                <h1 className="page-title">個人資料</h1>
                <p className="page-subtitle">
                    管理通知偏好，查看已建立的協尋案件，必要時重新配對。
                </p>
            </div>
            <section className="profile-grid">
                <article className="card">
                    <h2>您的資訊</h2>
                    <div className="profile-info">
                        <p>
                            <strong>姓名</strong>
                            <span>{user?.name}</span>
                        </p>
                        <p>
                            <strong>Email</strong>
                            <span>{user?.email}</span>
                        </p>
                    </div>
                </article>
                <article className="card">
                    <h2>通知設定</h2>
                    <div className="setting-item">
                        <div>
                            <label htmlFor="mail-notification">
                                接收配對 Email 通知
                            </label>
                            <p className="setting-copy">
                                找到候選結果時通知你。重新配對也會遵守這項設定。
                            </p>
                        </div>
                        <label className="switch">
                            <input
                                id="mail-notification"
                                type="checkbox"
                                checked={enabled}
                                disabled={saving}
                                onChange={(event) =>
                                    void toggle(event.target.checked)
                                }
                            />
                            <span className="slider round" />
                        </label>
                    </div>
                    {message && <p role="status">{message}</p>}
                    {error && <p role="alert">{error}</p>}
                </article>
            </section>
            <section className="card">
                <div className="section-heading">
                    <div>
                        <p className="eyebrow">Lost reports</p>
                        <h2>我協尋的寵物</h2>
                    </div>
                    <Link
                        className="btn btn-secondary btn-sm"
                        to="/report-lost"
                    >
                        新增案件
                    </Link>
                </div>
                <Feedback
                    loading={result.loading}
                    error={result.error}
                    retry={result.reload}
                />
                {result.data &&
                    (result.data.reports.length ? (
                        <div className="table-scroll">
                            <table>
                                <thead>
                                    <tr>
                                        <th>寵物名字</th>
                                        <th>物種／品種</th>
                                        <th>性別／毛色</th>
                                        <th>走失時間</th>
                                        <th>走失地點</th>
                                        <th>狀態</th>
                                        <th>操作</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {result.data.reports.map((report) => (
                                        <tr key={report.id}>
                                            <td>
                                                {report.name || '未命名寵物'}
                                            </td>
                                            <td>
                                                {report.kind}／
                                                {report.variety || '未提供'}
                                            </td>
                                            <td>
                                                {report.sex === 'M'
                                                    ? '公'
                                                    : report.sex === 'F'
                                                      ? '母'
                                                      : '未提供'}
                                                ／{report.colour || '未提供'}
                                            </td>
                                            <td>
                                                {report.lost_time?.slice(
                                                    0,
                                                    10,
                                                ) || '未提供'}
                                            </td>
                                            <td>{report.lost_place}</td>
                                            <td>
                                                <span className="badge">
                                                    {reportStatusLabel(
                                                        report.status,
                                                    )}
                                                </span>
                                            </td>
                                            <td>
                                                <Link
                                                    className="btn btn-secondary btn-sm"
                                                    to={`/reports/${report.id}`}
                                                >
                                                    查看案件
                                                </Link>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    ) : (
                        <div className="empty">
                            <h3>還沒有協尋案件</h3>
                            <p>建立案件後，可以在這裡追蹤結果。</p>
                        </div>
                    ))}
            </section>
        </>
    );
}

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
  const [enabled, setEnabled] = useState(user?.isLostAnimalMailEnabled ?? false);
  async function toggle(nextEnabled: boolean) {
    const previous = enabled;
    setEnabled(nextEnabled);
    setSaving(true); setMessage(''); setError('');
    try {
      const saved = await patch<{ enabled: boolean }>('/api/v1/me/settings', { enabled: nextEnabled });
      setEnabled(saved.enabled);
      updateMailPreference(saved.enabled);
      setMessage('通知設定已儲存');
    }
    catch (err) { setEnabled(previous); setError((err as Error).message); } finally { setSaving(false); }
  }
  return <><div className="page-heading"><p className="eyebrow">我的協尋</p><h1>{user?.name}，一起等待好消息。</h1><p>{user?.email}</p></div>
    <section className="panel"><h2>通知設定</h2><label className="toggle"><input type="checkbox" checked={enabled} disabled={saving} onChange={event => void toggle(event.target.checked)} />接收配對 Email 通知</label><p className="muted">找到候選結果時通知你。重新配對也會遵守這項設定。</p>{message && <p role="status">{message}</p>}{error && <p role="alert">{error}</p>}</section>
    <section><div className="actions"><h2>協尋案件</h2><Link className="button primary" to="/report-lost">新增案件</Link></div>
      <Feedback loading={result.loading} error={result.error} retry={result.reload} />
      {result.data && (result.data.reports.length ? <ul className="report-list">{result.data.reports.map(report => <li key={report.id} className="report-item"><div><h3><Link to={`/reports/${report.id}`}>{report.name || '未命名寵物'}</Link></h3><p className="muted">{report.kind} · {report.lost_place}</p></div><span>{reportStatusLabel(report.status)}</span></li>)}</ul> : <div className="empty"><h3>還沒有協尋案件</h3><p>建立案件後，可以在這裡追蹤結果。</p></div>)}
    </section></>;
}

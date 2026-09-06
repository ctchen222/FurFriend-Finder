import { useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import type { ReportDetail, ReportInput } from '../../../src/contracts/web';
import { useResource } from '../hooks/useResource';
import { reportsApi, reportStatusLabel } from '../features/reports/reportApi';
import { emptyReport, ReportForm } from '../features/reports/ReportForm';
import { Feedback } from '../ui/Feedback';
import { PetGrid } from '../ui/PetCard';

const jobLabels: Record<string, string> = { PENDING: '等待配對', RUNNING: '正在比對', SUCCEEDED: '配對完成', FAILED: '配對失敗，請重試', CANCELLED: '配對已取消' };
const mailLabels: Record<string, string> = { PENDING: '通知等待寄送', RUNNING: '正在寄送通知', SENT: '郵件伺服器已接受通知', DISABLED: '通知已取消或關閉', FAILED: '通知寄送失敗' };

export function ReportDetailPage() {
  const { id } = useParams();
  const result = useResource<ReportDetail>(`/api/v1/reports/${id}`, 5000);
  const [editing, setEditing] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  if (!result.data) return <Feedback loading={result.loading} error={result.error} retry={result.reload} />;
  const { report, job, notification, match } = result.data;
  async function action(work: () => Promise<unknown>, text: string) {
    setBusy(true); setError(''); setMessage('');
    try { await work(); setMessage(text); result.reload(); } catch (err) { setError((err as Error).message); } finally { setBusy(false); }
  }
  const active = report.status === 'OPEN';
  const pending = job?.state === 'RUNNING' || job?.state === 'PENDING';
  const initial = Object.fromEntries(Object.keys(emptyReport).map(key => [key, report[key as keyof typeof report] ?? emptyReport[key as keyof ReportInput]])) as unknown as ReportInput;
  return <><div className="page-heading"><Link to="/profile">← 我的協尋</Link><h1>{report.name || '未命名寵物'}的協尋案件</h1><p>{reportStatusLabel(report.status)} · {report.kind} · {report.lost_place}</p></div>
    <Feedback error={result.error} retry={result.reload} />
    {error && <p role="alert" className="notice error">{error}</p>}{message && <p role="status" className="notice">{message}</p>}
    <section className="panel"><h2>配對與通知</h2><p role="status">{job ? jobLabels[job.state] || job.state : '尚未建立配對工作'}</p>
      {notification && <p>{mailLabels[notification.state] || notification.state}</p>}
      {!notification && job?.state === 'SUCCEEDED' && <p>本次沒有待送通知。</p>}
      <p className="muted">結果是可能線索，並不代表已確認為同一隻寵物。請聯絡收容單位核對。</p>
      {active && <div className="actions"><button disabled={busy || pending} onClick={() => void action(() => reportsApi.match(report.id), '已排入配對；如有結果，將依通知偏好寄信。')}>重新配對並依設定通知</button><button disabled={busy} onClick={() => setEditing(value => !value)}>{editing ? '取消編輯' : '編輯案件'}</button>
        <button disabled={busy} onClick={() => { if (window.confirm('確認已找回寵物？這會停止此案件的待處理配對與通知。')) void action(() => reportsApi.close(report.id, report.revision, 'REUNITED'), '已標記為找回'); }}>已找回</button>
        <button className="danger" disabled={busy} onClick={() => { if (window.confirm('確認結束此案件的協尋？')) void action(() => reportsApi.close(report.id, report.revision, 'CLOSED'), '案件已結束'); }}>結束協尋</button>
      </div>}
    </section>
    {editing && active && <section className="panel"><h2>編輯線索</h2><ReportForm initial={initial} onSubmit={async input => { await reportsApi.edit(report.id, report.revision, input); setEditing(false); result.reload(); }} submitLabel="儲存並重新配對" /></section>}
    {match && <section><h2>{pending ? '上次配對結果' : '可能的匹配'}</h2><PetGrid pets={match.candidates} /></section>}
  </>;
}

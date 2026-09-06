import { useState, type FormEvent } from 'react';
import type { ReportInput } from '../../../../src/contracts/web';

export const emptyReport: ReportInput = { name: '', kind: '狗', variety: '', sex: 'N', colour: '', lost_time: '', lost_place: '', outlook: '', feature: '' };

export function ReportForm({ initial = emptyReport, onSubmit, submitLabel = '儲存案件並執行配對', quick = false }: {
  initial?: ReportInput; onSubmit: (input: ReportInput) => Promise<void>; submitLabel?: string; quick?: boolean;
}) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); setBusy(true); setError('');
    const data = { ...emptyReport, ...Object.fromEntries(new FormData(event.currentTarget)) } as ReportInput;
    try { await onSubmit(data); } catch (err) { setError((err as Error).message); } finally { setBusy(false); }
  }
  return <form onSubmit={submit}>
    {error && <p className="notice error" role="alert">{error}</p>}
    <fieldset><legend>寵物特徵</legend><div className="form-grid">
      {!quick && <label>寵物名字<input name="name" defaultValue={initial.name} maxLength={100} /></label>}
      <label>物種<select name="kind" defaultValue={initial.kind} required><option>狗</option><option>貓</option><option>其他</option></select></label>
      <label>品種<input name="variety" defaultValue={initial.variety} placeholder="例如：米克斯" maxLength={100} /></label>
      <label>性別<select name="sex" defaultValue={initial.sex}><option value="N">不確定</option><option value="M">公</option><option value="F">母</option></select></label>
      <label>毛色<input name="colour" defaultValue={initial.colour} placeholder="例如：黑白、虎斑" maxLength={100} /></label>
      {!quick && <label>走失日期<input name="lost_time" type="date" defaultValue={initial.lost_time?.slice(0, 10)} /></label>}
    </div></fieldset>
    <fieldset><legend>走失線索</legend>
      <label>走失地點（必填）<input name="lost_place" defaultValue={initial.lost_place} placeholder="例如：臺北市信義區市府路 1 號" required maxLength={300} /></label>
      {!quick && <div className="form-grid"><label>外觀<textarea name="outlook" defaultValue={initial.outlook} maxLength={2000} /></label><label>特殊特徵<textarea name="feature" defaultValue={initial.feature} maxLength={2000} /></label></div>}
    </fieldset>
    <button className="primary" disabled={busy}>{busy ? '處理中…' : submitLabel}</button>
  </form>;
}

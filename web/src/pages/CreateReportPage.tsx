import { useNavigate } from 'react-router-dom';
import { ReportForm } from '../features/reports/ReportForm';
import { reportsApi } from '../features/reports/reportApi';
import { useSession } from '../features/auth/SessionProvider';

export function CreateReportPage() {
  const navigate = useNavigate();
  const { user } = useSession();
  return <><div className="page-heading"><p className="eyebrow">協尋登記</p><h1>留下牠的線索</h1><p>配對通知將依你的偏好，寄到帳號信箱 {user?.email}。</p></div>
    <section className="panel"><ReportForm onSubmit={async input => { const { report } = await reportsApi.create(input); navigate(`/reports/${report.id}`); }} /></section>
  </>;
}

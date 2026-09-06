import { useNavigate } from 'react-router-dom';
import { ReportForm } from '../features/reports/ReportForm';
import { reportsApi } from '../features/reports/reportApi';
import { useSession } from '../features/auth/SessionProvider';

export function CreateReportPage() {
    const navigate = useNavigate();
    const { user } = useSession();
    return (
        <>
            <div className="page-hero page-hero--compact">
                <p className="eyebrow">Lost pet report</p>
                <h1 className="page-title">協尋寵物資料登記</h1>
                <p className="page-subtitle">
                    建立案件後，系統會保存走失資訊並執行配對。配對通知將依你的偏好，寄到帳號信箱{' '}
                    {user?.email}。
                </p>
            </div>
            <section className="form-shell form-shell--single">
                <div className="form-card form-card--wide">
                    <ReportForm
                        onSubmit={async (input) => {
                            const { report } = await reportsApi.create(input);
                            navigate(`/reports/${report.id}`);
                        }}
                    />
                </div>
            </section>
        </>
    );
}

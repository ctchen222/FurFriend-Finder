import { useState } from 'react';
import { Link } from 'react-router-dom';
import type { PetCardData } from '../../../src/contracts/web';
import { ReportForm } from '../features/reports/ReportForm';
import { post } from '../api/client';
import { PetGrid } from '../ui/PetCard';

export function QuickMatchPage() {
    const [pets, setPets] = useState<PetCardData[] | null>(null);
    return (
        <>
            <div className="page-hero page-hero--compact">
                <p className="eyebrow">Quick match</p>
                <h1 className="page-title">快速比對走失毛孩</h1>
                <p className="page-subtitle">
                    不用登入。先輸入關鍵特徵與走失地點，查看公開收容資料中最接近的候選。
                </p>
            </div>
            <section className="form-shell">
                <aside className="guidance-panel">
                    <p className="eyebrow">What happens next</p>
                    <h2>系統會回傳候選，不會建立案件或寄信。</h2>
                    <p>
                        如果結果有參考價值，可以再建立協尋案件，保留後續通知與個人頁追蹤。
                    </p>
                    <Link className="text-link" to="/report-lost">
                        需要持續追蹤？前往協尋登記
                    </Link>
                </aside>
                <div className="form-card">
                    <ReportForm
                        quick
                        submitLabel="尋找可能的匹配"
                        onSubmit={async (input) => {
                            setPets(null);
                            const result = await post<{
                                extras: { top10Matches: PetCardData[] };
                            }>('/api/lost-animals/quick-match', input);
                            setPets(result.extras.top10Matches);
                        }}
                    />
                </div>
            </section>
            {pets && (
                <section aria-live="polite">
                    <h2>比對結果</h2>
                    <p className="muted">
                        請向收容單位核對身分；此查詢不會寄信。
                    </p>
                    <PetGrid pets={pets} />
                </section>
            )}
        </>
    );
}

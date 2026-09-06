import { useState } from 'react';
import { Link } from 'react-router-dom';
import type { PetCardData } from '../../../src/contracts/web';
import { ReportForm } from '../features/reports/ReportForm';
import { post } from '../api/client';
import { PetGrid } from '../ui/PetCard';

export function QuickMatchPage() {
  const [pets, setPets] = useState<PetCardData[] | null>(null);
  return <><div className="page-heading"><p className="eyebrow">快速比對</p><h1>從記得的特徵開始</h1><p>不需登入即可查詢。若要保存案件並接收通知，請<Link to="/report-lost">登記協尋</Link>。</p></div>
    <section className="panel"><ReportForm quick submitLabel="尋找可能的匹配" onSubmit={async input => {
      setPets(null);
      const result = await post<{ extras: { top10Matches: PetCardData[] } }>('/api/lost-animals/quick-match', input);
      setPets(result.extras.top10Matches);
    }} /></section>
    {pets && <section aria-live="polite"><h2>比對結果</h2><p className="muted">請向收容單位核對身分；此查詢不會寄信。</p><PetGrid pets={pets} /></section>}
  </>;
}

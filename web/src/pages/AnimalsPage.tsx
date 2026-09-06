import { Link, useParams, useSearchParams } from 'react-router-dom';
import type { PetCardData } from '../../../src/contracts/web';
import { useResource } from '../hooks/useResource';
import { Feedback } from '../ui/Feedback';
import { PetGrid, PetPhoto } from '../ui/PetCard';

export function AnimalsPage() {
  const [params, setParams] = useSearchParams();
  const cursor = params.get('cursor');
  const city = params.get('city') ?? '';
  const kind = params.get('kind') ?? '';
  const sex = params.get('sex') ?? '';
  const query = new URLSearchParams({ pageSize: '12' });
  for (const key of ['city', 'kind', 'sex', 'cursor']) {
    const value = params.get(key);
    if (value) query.set(key, value);
  }
  const path = `/api/animals?${query}`;
  const result = useResource<{ extras: { animals: PetCardData[]; cursors?: { nextCursor?: string } } }>(path);
  return <><div className="page-heading"><p className="eyebrow">收容資訊</p><h1>留意熟悉的身影</h1><p>資料來自公開收容資訊，實際狀態請向收容單位確認。</p></div>
    <form className="panel" key={`${city}:${kind}:${sex}`} onSubmit={event => {
      event.preventDefault();
      const data = new FormData(event.currentTarget);
      const next = new URLSearchParams();
      for (const key of ['city', 'kind', 'sex']) {
        const value = String(data.get(key) ?? '').trim();
        if (value) next.set(key, value);
      }
      setParams(next);
    }}>
      <div className="form-grid">
        <label>縣市／地址<input name="city" defaultValue={city} placeholder="例如：臺北市" maxLength={100} /></label>
        <label>物種<select name="kind" defaultValue={kind}><option value="">全部物種</option><option>狗</option><option>貓</option><option>其他</option></select></label>
        <label>性別<select name="sex" defaultValue={sex}><option value="">全部性別</option><option value="M">公</option><option value="F">母</option><option value="N">未提供</option></select></label>
      </div>
      <button>查詢</button>
      {(city || kind || sex || cursor) && <Link to="/shelter-animals">清除條件，回到第一頁</Link>}
    </form>
    <Feedback loading={result.loading} error={result.error} retry={result.reload} />
    {result.data && <><PetGrid pets={result.data.extras.animals} /><nav className="actions" aria-label="分頁">
      {cursor && <button onClick={() => { const next = new URLSearchParams(params); next.delete('cursor'); setParams(next); }}>回第一頁</button>}
      {result.data.extras.cursors?.nextCursor && <button onClick={() => { const next = new URLSearchParams(params); next.set('cursor', result.data!.extras.cursors!.nextCursor!); setParams(next); }}>下一頁</button>}
    </nav></>}
  </>;
}
export function AnimalDetailPage() {
  const { id } = useParams();
  const result = useResource<{ extras: { animal: PetCardData } }>(`/api/animals/${id}`);
  if (!result.data) return <Feedback loading={result.loading} error={result.error} retry={result.reload} />;
  const pet = result.data.extras.animal;
  return <><div className="page-heading"><Link to="/shelter-animals">← 收容動物</Link><h1>{pet.variety || pet.kind || '動物'} · {pet.sub_id || `#${pet.id}`}</h1></div>
    <section className="detail-grid"><div className="pet-card"><PetPhoto pet={pet} /></div><div><h2>辨識資訊</h2><dl><dt>物種／毛色</dt><dd>{pet.kind}／{pet.colour || '未提供'}</dd><dt>性別</dt><dd>{pet.sex === 'M' ? '公' : pet.sex === 'F' ? '母' : '未提供'}</dd><dt>發現地點</dt><dd>{pet.found_place || '未提供'}</dd><dt>收容單位</dt><dd>{pet.shelter_name || '未提供'}</dd><dt>地址</dt><dd>{pet.shelter_address || '未提供'}</dd><dt>聯絡電話</dt><dd>{pet.shelter_tel || '未提供'}</dd></dl><p>{pet.remark}</p><p className="notice">前往之前，請先電話確認動物身分與最新狀態。</p></div></section>
  </>;
}

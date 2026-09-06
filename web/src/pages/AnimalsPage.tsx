import { Link, useParams, useSearchParams } from 'react-router-dom';
import type { PetCardData } from '../../../src/contracts/web';
import { useResource } from '../hooks/useResource';
import { Feedback } from '../ui/Feedback';
import { PetGrid, PetPhoto } from '../ui/PetCard';

export function AnimalsPage() {
  const [params, setParams] = useSearchParams();
  const cursor = params.get('cursor');
  const city = params.get('city') ?? '';
  const path = city ? `/api/animals/city/${encodeURIComponent(city)}` : `/api/animals?pageSize=12${cursor ? `&cursor=${encodeURIComponent(cursor)}` : ''}`;
  const result = useResource<{ extras: { animals: PetCardData[]; cursors?: { nextCursor?: string } } }>(path);
  return <><div className="page-heading"><p className="eyebrow">收容資訊</p><h1>留意熟悉的身影</h1><p>資料來自公開收容資訊，實際狀態請向收容單位確認。</p></div>
    <form className="panel" onSubmit={event => { event.preventDefault(); const city = String(new FormData(event.currentTarget).get('city') ?? '').trim(); setParams(city ? { city } : {}); }}><label>縣市／地址<input name="city" defaultValue={city} placeholder="例如：臺北市" /></label><button>查詢</button>{(city || cursor) && <Link to="/shelter-animals">清除條件，回到第一頁</Link>}</form>
    <Feedback loading={result.loading} error={result.error} retry={result.reload} />
    {result.data && <><PetGrid pets={result.data.extras.animals} /><nav className="actions" aria-label="分頁">{cursor && <Link to="/shelter-animals">回第一頁</Link>}{result.data.extras.cursors?.nextCursor && <button onClick={() => setParams({ cursor: result.data!.extras.cursors!.nextCursor! })}>下一頁</button>}</nav></>}
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

import { useState } from 'react';
import { Link } from 'react-router-dom';
import type { PetCardData } from '../../../src/contracts/web';

export function PetPhoto({ pet }: { pet: PetCardData }) {
  const [failed, setFailed] = useState(false);
  const url = pet.picture && /^https?:\/\//i.test(pet.picture) ? pet.picture : null;
  return url && !failed ? <img src={url} alt={`${pet.colour ?? ''}${pet.kind ?? '動物'}，${pet.variety ?? '品種未提供'}`} loading="lazy" onError={() => setFailed(true)} /> : <div className="photo-placeholder" role="img" aria-label="暫無動物照片">暫無照片</div>;
}
export function PetCard({ pet }: { pet: PetCardData }) {
  return <article className="pet-card"><PetPhoto pet={pet} /><div className="pet-card-content">
    <div className="tags"><span className="tag">{pet.kind || '物種未提供'}</span><span className="tag">{pet.sex === 'M' ? '公' : pet.sex === 'F' ? '母' : '性別未提供'}</span></div>
    <h3><Link to={`/shelter-animals/${pet.id}`}>{pet.variety || pet.kind || '收容動物'} · {pet.sub_id || `#${pet.id}`}</Link></h3>
    <p>{pet.colour || '毛色未提供'}</p><p className="muted">{pet.shelter_name || '收容單位待確認'}</p>
    {pet.distance !== undefined && <p className="muted">{Number.isFinite(pet.distance) && pet.distance !== null ? `距收容所 ${pet.distance.toFixed(1)} 公里` : '距離資訊不足'}</p>}
    {pet.reasons?.length ? <ul className="muted">{pet.reasons.map(reason => <li key={reason}>{reason}</li>)}</ul> : null}
  </div></article>;
}
export function PetGrid({ pets }: { pets: PetCardData[] }) {
  return pets.length ? <div className="pet-grid">{pets.map(pet => <PetCard key={pet.id} pet={pet} />)}</div> : <div className="empty"><h2>目前沒有符合的動物</h2><p>可以調整條件，或稍後再查看新的收容資訊。</p></div>;
}

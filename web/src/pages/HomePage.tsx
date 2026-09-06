import { Link } from 'react-router-dom';
import type { PetCardData } from '../../../src/contracts/web';
import { useResource } from '../hooks/useResource';
import { Feedback } from '../ui/Feedback';
import { PetPhoto } from '../ui/PetCard';

function FeaturedAnimal() {
    const result = useResource<{ extras: { animal: PetCardData | null } }>(
        '/api/animals/random',
    );
    const pet = result.data?.extras.animal;
    return (
        <div className="featured-card">
            <Feedback
                loading={result.loading}
                error={result.error}
                retry={result.reload}
            />
            {pet ? (
                <>
                    <PetPhoto pet={pet} className="featured-img" />
                    <div className="featured-body">
                        <p className="eyebrow">Featured animal</p>
                        <h3>{pet.variety || pet.kind || '未知品種'}</h3>
                        <dl className="metadata-list">
                            <div>
                                <dt>物種</dt>
                                <dd>{pet.kind || '未提供'}</dd>
                            </div>
                            <div>
                                <dt>性別</dt>
                                <dd>
                                    {pet.sex === 'M'
                                        ? '公'
                                        : pet.sex === 'F'
                                          ? '母'
                                          : '未提供'}
                                </dd>
                            </div>
                            <div>
                                <dt>毛色</dt>
                                <dd>{pet.colour || '未提供'}</dd>
                            </div>
                        </dl>
                        {pet.shelter_name && (
                            <span className="badge">{pet.shelter_name}</span>
                        )}
                        <Link
                            className="text-link"
                            to={`/shelter-animals/${pet.id}`}
                        >
                            查看動物詳情
                        </Link>
                    </div>
                </>
            ) : (
                result.data && (
                    <p className="featured-loading">目前沒有可顯示的動物。</p>
                )
            )}
        </div>
    );
}

export function HomePage() {
    return (
        <>
            <section className="home-hero">
                <div className="hero-copy">
                    <p className="eyebrow">Taiwan shelter-data matching</p>
                    <h1 className="hero-title">
                        Find lost pets across Taiwan shelter records.
                    </h1>
                    <p className="hero-subtitle">
                        輸入走失地點與外觀特徵，FurFriend Finder
                        會比對全台公開收容資料，讓你更快找到可能的線索。
                    </p>
                </div>
                <div className="hero-action-panel" aria-label="主要操作">
                    <Link
                        to="/quick-use"
                        className="action-card action-card--primary"
                    >
                        <span className="action-kicker">No login required</span>
                        <strong>快速比對</strong>
                        <span>
                            不用登入，先查詢可能候選；不建立案件、不寄信。
                        </span>
                    </Link>
                    <Link to="/report-lost" className="action-card">
                        <span className="action-kicker">Ongoing follow-up</span>
                        <strong>協尋登記</strong>
                        <span>登入後保存案件，追蹤匹配與 Email 通知。</span>
                    </Link>
                    <Link to="/shelter-animals" className="action-card">
                        <span className="action-kicker">Browse records</span>
                        <strong>瀏覽收容動物</strong>
                        <span>以縣市、物種、性別篩選公開資料。</span>
                    </Link>
                </div>
                <div className="trust-row" aria-label="平台重點">
                    <span>公立收容所公開資料</span>
                    <span>可解釋的候選排序</span>
                    <span>Email 配對通知</span>
                </div>
            </section>
            <section className="content-band">
                <div className="section-heading">
                    <p className="eyebrow">Daily record</p>
                    <h2>今日推薦動物</h2>
                    <Link to="/shelter-animals">查看全部</Link>
                </div>
                <FeaturedAnimal />
            </section>
            <section className="workflow-section">
                <div className="section-heading section-heading--center">
                    <p className="eyebrow">How matching works</p>
                    <h2>從焦慮到下一步，只保留必要流程</h2>
                </div>
                <div className="steps-grid">
                    <article className="step-card">
                        <span className="step-num">1</span>
                        <h3>描述特徵</h3>
                        <p>
                            輸入物種、毛色、品種與走失地點。資訊越準確，候選排序越有參考價值。
                        </p>
                    </article>
                    <article className="step-card">
                        <span className="step-num">2</span>
                        <h3>比對收容資料</h3>
                        <p>
                            系統比對公開收容資料，依可用的特徵與位置資訊排序。
                        </p>
                    </article>
                    <article className="step-card">
                        <span className="step-num">3</span>
                        <h3>採取行動</h3>
                        <p>
                            查看候選照片與收容所資訊，或建立協尋案件保留後續通知。
                        </p>
                    </article>
                </div>
            </section>
            <section className="bottom-cta">
                <p className="eyebrow">Start from the fastest path</p>
                <h2>先比對，再決定是否建立協尋案件。</h2>
                <div className="cta-container">
                    <Link className="btn btn-primary btn-pill" to="/quick-use">
                        開始快速比對
                    </Link>
                    <Link
                        className="btn btn-secondary btn-pill"
                        to="/report-lost"
                    >
                        登記協尋案件
                    </Link>
                </div>
            </section>
        </>
    );
}

import { Link, useParams, useSearchParams } from 'react-router-dom';
import type {
    AnimalListing,
    AnimalListingPage,
} from '../../../../src/contracts/organizationAnimals';
import { listingLabels } from '../../../../src/contracts/organizationAnimals';
import type { OrganizationWorkspace } from '../../../../src/contracts/organizations';
import { useResource } from '../../hooks/useResource';
import { Feedback } from '../../ui/Feedback';
import { useSession } from '../auth/SessionProvider';
import { AnimalEditor } from './AnimalEditor';
import { animalPhotoUrl, AnimalPresentation } from './AnimalPresentation';

export function OrganizationAnimalsPage() {
    const { orgId = '' } = useParams();
    const { user } = useSession();
    return <AnimalWorkspace key={`${user?.id}:${orgId}`} orgId={orgId} />;
}
function AnimalWorkspace({ orgId }: { orgId: string }) {
    const org = useResource<{ organization: OrganizationWorkspace }>(
        `/api/v1/organizations/${orgId}/profile`,
    );
    const { user } = useSession();
    return (
        <>
            <nav className="actions">
                <Link to={`/orgs/${orgId}`}>← 中途之家管理</Link>
                <Link to="/organizations">切換組織</Link>
            </nav>
            <Feedback
                loading={org.loading}
                error={org.error}
                retry={org.reload}
            />
            {org.data && !org.error && (
                <>
                    <header className="page-heading">
                        <h1>動物管理</h1>
                        <p>{org.data.organization.name}</p>
                    </header>
                    <div className="actions">
                        <p className="muted">
                            照顧中的每一隻，都值得被好好認識。
                        </p>
                        {org.data.organization.operationalStatus === 'ACTIVE' &&
                            user?.emailVerified && (
                                <Link
                                    className="button primary"
                                    to={`/orgs/${orgId}/animals/new`}
                                >
                                    新增動物
                                </Link>
                            )}
                    </div>
                    <AnimalList orgId={orgId} />
                </>
            )}
        </>
    );
}

export function AnimalList({
    orgId,
    isPublic = false,
}: {
    orgId: string;
    isPublic?: boolean;
}) {
    const [params, setParams] = useSearchParams();
    const cursor = params.get('animalCursor');
    return (
        <AnimalListResults
            key={`${orgId}:${isPublic}:${cursor}`}
            orgId={orgId}
            isPublic={isPublic}
            cursor={cursor}
            setCursor={(value) => {
                const next = new URLSearchParams(params);
                if (value) next.set('animalCursor', value);
                else next.delete('animalCursor');
                setParams(next);
            }}
        />
    );
}
function AnimalListResults({
    orgId,
    isPublic,
    cursor,
    setCursor,
}: {
    orgId: string;
    isPublic: boolean;
    cursor: string | null;
    setCursor: (cursor: string | null) => void;
}) {
    const query = new URLSearchParams();
    if (cursor) query.set('cursor', cursor);
    const result = useResource<AnimalListingPage>(
        `/api/v1/${isPublic ? 'public/' : ''}organizations/${orgId}/animals?${query}`,
    );
    return (
        <>
            <Feedback
                loading={result.loading}
                error={result.error}
                retry={result.reload}
            />
            {result.data && !result.error && (
                <>
                    {!result.data.animals.length && (
                        <div className="empty">
                            <h2>
                                {isPublic
                                    ? '目前沒有公開的動物'
                                    : '尚未建立動物資料'}
                            </h2>
                            <p>
                                {isPublic
                                    ? '可以先了解中途之家，稍後再來看看。'
                                    : '從「新增動物」開始，先存草稿也沒關係。'}
                            </p>
                        </div>
                    )}
                    <ul className="listing-card-grid">
                        {result.data.animals.map((animal) => (
                            <li className="panel listing-card" key={animal.id}>
                                <Link
                                    to={
                                        isPublic
                                            ? `/foster-organizations/${orgId}/animals/${animal.id}`
                                            : `/orgs/${orgId}/animals/${animal.id}`
                                    }
                                >
                                    {animal.photoIds[0] ? (
                                        <img
                                            src={animalPhotoUrl(
                                                animal,
                                                animal.photoIds[0],
                                                isPublic,
                                            )}
                                            alt={`${animal.name}的照片`}
                                            loading="lazy"
                                        />
                                    ) : (
                                        <div className="listing-placeholder">
                                            尚未上傳照片
                                        </div>
                                    )}
                                    <div className="listing-card-content">
                                        <h2>{animal.name}</h2>
                                        <p className="muted">
                                            {[
                                                listingLabels.species[
                                                    animal.species
                                                ],
                                                animal.city,
                                            ]
                                                .filter(Boolean)
                                                .join(' · ')}
                                        </p>
                                        <p>
                                            {!isPublic && !animal.publishedAt
                                                ? '草稿 · '
                                                : ''}
                                            {
                                                listingLabels.adoptionStatus[
                                                    animal.adoptionStatus
                                                ]
                                            }
                                            {!isPublic && animal.publishedAt
                                                ? ' · 已公開'
                                                : ''}
                                        </p>
                                    </div>
                                </Link>
                            </li>
                        ))}
                    </ul>
                    <nav className="actions" aria-label="動物分頁">
                        {cursor && (
                            <button onClick={() => setCursor(null)}>
                                回第一頁
                            </button>
                        )}
                        {result.data.nextCursor && (
                            <button
                                onClick={() =>
                                    setCursor(result.data!.nextCursor)
                                }
                            >
                                下一頁
                            </button>
                        )}
                    </nav>
                </>
            )}
        </>
    );
}

export function OrganizationAnimalEditorPage() {
    const { orgId = '', animalId } = useParams();
    const { user } = useSession();
    return (
        <EditorLoader
            key={`${user?.id}:${orgId}:${animalId ?? 'new'}`}
            orgId={orgId}
            animalId={animalId}
            verified={Boolean(user?.emailVerified)}
        />
    );
}
function EditorLoader({
    orgId,
    animalId,
    verified,
}: {
    orgId: string;
    animalId?: string;
    verified: boolean;
}) {
    const org = useResource<{ organization: OrganizationWorkspace }>(
        `/api/v1/organizations/${orgId}/profile`,
    );
    return (
        <>
            <Feedback
                loading={org.loading}
                error={org.error}
                retry={org.reload}
            />
            {org.data &&
                !org.error &&
                (animalId ? (
                    <ExistingEditor
                        org={org.data.organization}
                        animalId={animalId}
                        verified={verified}
                    />
                ) : (
                    <AnimalEditor
                        org={org.data.organization}
                        initial={null}
                        verified={verified}
                        reload={org.reload}
                    />
                ))}
        </>
    );
}
function ExistingEditor({
    org,
    animalId,
    verified,
}: {
    org: OrganizationWorkspace;
    animalId: string;
    verified: boolean;
}) {
    const result = useResource<{ animal: AnimalListing }>(
        `/api/v1/organizations/${org.id}/animals/${animalId}`,
    );
    return (
        <>
            <Feedback
                loading={result.loading}
                error={result.error}
                retry={result.reload}
            />
            {result.error && (
                <Link to={`/orgs/${org.id}/animals`}>返回動物管理</Link>
            )}
            {result.data && !result.loading && !result.error && (
                <AnimalEditor
                    org={org}
                    initial={result.data.animal}
                    verified={verified}
                    reload={result.reload}
                />
            )}
        </>
    );
}

export function PublicOrganizationAnimalPage() {
    const { orgId = '', animalId = '' } = useParams();
    return (
        <PublicAnimal
            key={`${orgId}:${animalId}`}
            orgId={orgId}
            animalId={animalId}
        />
    );
}
function PublicAnimal({
    orgId,
    animalId,
}: {
    orgId: string;
    animalId: string;
}) {
    const result = useResource<{ animal: AnimalListing }>(
        `/api/v1/public/organizations/${orgId}/animals/${animalId}`,
    );
    return (
        <>
            <nav className="actions">
                <Link to={`/foster-organizations/${orgId}`}>
                    ← 認識這個中途之家
                </Link>
            </nav>
            <Feedback
                loading={result.loading}
                error={result.error}
                retry={result.reload}
            />
            {result.data && !result.error && (
                <>
                    <header className="page-heading">
                        <p className="muted">中途之家刊登</p>
                        <h1>認識{result.data.animal.name}</h1>
                    </header>
                    <section className="panel">
                        <AnimalPresentation
                            animal={result.data.animal}
                            isPublic
                        />
                    </section>
                    <p className="notice">
                        {result.data.animal.adoptionStatus === 'ADOPTED'
                            ? '牠已找到新家，謝謝你的關心。'
                            : '想多了解牠？請透過中途之家公開的聯絡方式洽詢。'}
                    </p>
                    <Link
                        className="button primary"
                        to={`/foster-organizations/${orgId}`}
                    >
                        查看中途之家與聯絡方式
                    </Link>
                </>
            )}
        </>
    );
}

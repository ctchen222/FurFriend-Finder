import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import type {
    AnimalListing,
    AnimalListingFields,
} from '../../../../src/contracts/organizationAnimals';
import type { OrganizationWorkspace } from '../../../../src/contracts/organizations';
import { patch, post, request, ApiError } from '../../api/client';
import { AnimalFields } from './AnimalFields';
import { AnimalPhotos } from './AnimalPhotos';
import { AnimalPublication } from './AnimalPublication';
import { useUnsavedListing } from './useUnsavedListing';

const fieldsOf = (a: AnimalListingFields): AnimalListingFields => ({
    name: a.name,
    species: a.species,
    sex: a.sex,
    ageGroup: a.ageGroup,
    size: a.size,
    city: a.city,
    description: a.description,
    adoptionRequirements: a.adoptionRequirements,
    adoptionStatus: a.adoptionStatus,
});

export function AnimalEditor({
    org,
    initial,
    verified,
    reload,
}: {
    org: OrganizationWorkspace;
    initial: AnimalListing | null;
    verified: boolean;
    reload: () => void;
}) {
    const navigate = useNavigate();
    const [animal, setAnimal] = useState(initial);
    const [fields, setFields] = useState<AnimalListingFields>(
        initial
            ? fieldsOf(initial)
            : {
                  name: '',
                  species: 'CAT',
                  sex: 'UNKNOWN',
                  ageGroup: 'UNKNOWN',
                  size: 'UNKNOWN',
                  city: org.city,
                  description: '',
                  adoptionRequirements: '',
                  adoptionStatus: 'AVAILABLE',
              },
    );
    const [baseline, setBaseline] = useState(JSON.stringify(fields));
    const dirty = JSON.stringify(fields) !== baseline;
    const allowLeave = useUnsavedListing(dirty);
    const [requestId, setRequestId] = useState(() => crypto.randomUUID());
    const [busy, setBusy] = useState('');
    const [photoBusy, setPhotoBusy] = useState(false);
    const saving = Boolean(busy) || photoBusy;
    const [error, setError] = useState('');
    const [conflict, setConflict] = useState(false);
    const [message, setMessage] = useState('');
    const canWrite = org.operationalStatus === 'ACTIVE' && verified;
    const editable = canWrite && !animal?.publishedAt;
    const canPublish = ['OWNER', 'ADMIN'].includes(org.role) && canWrite;
    const base = `/api/v1/organizations/${org.id}/animals`;
    function saved(next: AnimalListing) {
        setAnimal(next);
        setFields(fieldsOf(next));
        setBaseline(JSON.stringify(fieldsOf(next)));
        allowLeave();
    }
    async function act(
        key: string,
        action: () => Promise<{ animal: AnimalListing }>,
        success: string,
    ) {
        if (saving) return;
        setBusy(key);
        setError('');
        setConflict(false);
        setMessage('');
        try {
            const next = (await action()).animal;
            saved(next);
            setMessage(success);
            if (!animal)
                navigate(`/orgs/${org.id}/animals/${next.id}`, {
                    replace: true,
                });
        } catch (failure) {
            setError((failure as Error).message);
            if (
                failure instanceof ApiError &&
                failure.code === 'ANIMAL_VERSION_CONFLICT'
            )
                setConflict(true);
            if (
                failure instanceof ApiError &&
                failure.code === 'REQUEST_REUSED'
            )
                setRequestId(crypto.randomUUID());
        } finally {
            setBusy('');
        }
    }
    return (
        <>
            <nav className="actions">
                <Link to={`/orgs/${org.id}/animals`}>← 動物管理</Link>
                <span className="muted">{org.name}</span>
            </nav>
            <header className="page-heading">
                <h1>{animal ? `編輯${animal.name}` : '新增動物'}</h1>
                <p>{animal?.publishedAt ? '已公開' : '草稿，僅組織成員可見'}</p>
            </header>
            {!canWrite && (
                <p className="notice">
                    {!verified
                        ? '請先驗證信箱，才能編輯動物。'
                        : '此中途之家目前停止變更，資料仍可查看。'}
                </p>
            )}
            {animal?.publishedAt && (
                <p className="notice">
                    編輯前請先下架，完成修改後再公開。
                    {!canPublish && '請聯絡負責人或管理員協助。'}
                </p>
            )}
            {error && (
                <div className="notice error" role="alert">
                    {error}
                    {conflict && (
                        <button
                            onClick={() => {
                                if (
                                    window.confirm(
                                        '重新載入會捨棄本次未儲存的內容，確定繼續？',
                                    )
                                ) {
                                    allowLeave();
                                    reload();
                                }
                            }}
                        >
                            重新載入
                        </button>
                    )}
                </div>
            )}
            {message && (
                <p className="notice" role="status">
                    {message}
                </p>
            )}
            <div className="listing-editor-layout">
                <div>
                    <form
                        className="panel"
                        onSubmit={(event) => {
                            event.preventDefault();
                            void act(
                                'save',
                                () =>
                                    animal
                                        ? patch(`${base}/${animal.id}`, {
                                              ...fields,
                                              expectedVersion: animal.version,
                                          })
                                        : post(base, { ...fields, requestId }),
                                '草稿已儲存。',
                            );
                        }}
                    >
                        <AnimalFields
                            fields={fields}
                            onChange={setFields}
                            disabled={!editable || saving}
                        />
                        {editable && (
                            <div className="listing-save actions">
                                <button
                                    className="primary"
                                    disabled={
                                        saving || (Boolean(animal) && !dirty)
                                    }
                                >
                                    {busy === 'save' ? '儲存中…' : '儲存草稿'}
                                </button>
                                <span className="muted" role="status">
                                    {dirty
                                        ? '有尚未儲存的變更'
                                        : animal
                                          ? '內容已儲存'
                                          : '先儲存草稿，即可上傳照片'}
                                </span>
                            </div>
                        )}
                    </form>
                    {animal ? (
                        <>
                            {dirty && (
                                <p className="muted">
                                    請先儲存文字變更，再管理照片。
                                </p>
                            )}
                            <AnimalPhotos
                                animal={animal}
                                disabled={!editable || dirty || Boolean(busy)}
                                onChange={saved}
                                onBusyChange={setPhotoBusy}
                            />
                        </>
                    ) : (
                        <section className="panel">
                            <h2>照片</h2>
                            <p className="muted">
                                先填寫名字並儲存草稿，就能上傳照片。
                            </p>
                        </section>
                    )}
                </div>
                <AnimalPublication
                    org={org}
                    animal={animal}
                    fields={fields}
                    canWrite={canWrite}
                    dirty={dirty}
                    saving={saving}
                    onPublication={(publish) => {
                        if (!animal) return;
                        void act(
                            'publication',
                            () =>
                                request(`${base}/${animal.id}/publication`, {
                                    method: publish ? 'POST' : 'DELETE',
                                    body: JSON.stringify({
                                        expectedVersion: animal.version,
                                    }),
                                }),
                            publish
                                ? '已公開，大家可以看見牠了。'
                                : '已下架，可以編輯草稿。',
                        );
                    }}
                />
            </div>
        </>
    );
}

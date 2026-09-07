import { useState, type FormEvent } from 'react';
import type { OrganizationWorkspace } from '../../../../src/contracts/organizations';
import { patch, post, request } from '../../api/client';

export function OrganizationProfileEditor({
    organization,
    onChanged,
}: {
    organization: OrganizationWorkspace;
    onChanged: (organization: OrganizationWorkspace) => void;
}) {
    const [editing, setEditing] = useState(false);
    const [busy, setBusy] = useState(false);
    const [error, setError] = useState('');
    const canManage =
        organization.operationalStatus === 'ACTIVE' &&
        ['OWNER', 'ADMIN'].includes(organization.role);

    async function mutate(
        action: () => Promise<{ organization: OrganizationWorkspace }>,
    ) {
        if (busy) return;
        setBusy(true);
        setError('');
        try {
            onChanged((await action()).organization);
            setEditing(false);
        } catch (caught) {
            setError((caught as Error).message);
        } finally {
            setBusy(false);
        }
    }

    function save(event: FormEvent<HTMLFormElement>) {
        event.preventDefault();
        const values = Object.fromEntries(new FormData(event.currentTarget));
        void mutate(() =>
            patch(`/api/v1/organizations/${organization.id}/profile`, {
                ...values,
                expectedVersion: organization.version,
            }),
        );
    }

    const canPublish =
        canManage &&
        organization.reviewStatus === 'APPROVED' &&
        !organization.publishedAt;
    return (
        <section className="panel">
            <div className="section-heading">
                <h2>公開介紹</h2>
                {canManage && !editing && (
                    <button onClick={() => setEditing(true)}>編輯資料</button>
                )}
            </div>
            {organization.reviewStatus === 'REJECTED' && (
                <div className="notice" role="status">
                    <strong>資料需要修正</strong>
                    {organization.reviewReason && (
                        <p>{organization.reviewReason}</p>
                    )}
                    {canManage && <p>儲存修改後會自動重新送審。</p>}
                </div>
            )}
            {organization.operationalStatus === 'SUSPENDED' && (
                <p className="notice error" role="alert">
                    此組織已停權，目前只能查看資料，無法編輯或公開。
                </p>
            )}
            {editing ? (
                <form onSubmit={save}>
                    <fieldset disabled={busy}>
                        <label>
                            中途之家名稱
                            <input
                                name="name"
                                required
                                maxLength={100}
                                defaultValue={organization.name}
                            />
                        </label>
                        <label>
                            類型
                            <select
                                name="type"
                                defaultValue={organization.type}
                            >
                                <option value="INDIVIDUAL">個人中途</option>
                                <option value="GROUP">救援團隊</option>
                            </select>
                        </label>
                        <label>
                            所在縣市
                            <input
                                name="city"
                                maxLength={30}
                                defaultValue={organization.city}
                            />
                        </label>
                        <label>
                            介紹
                            <textarea
                                name="description"
                                maxLength={3000}
                                defaultValue={organization.description}
                            />
                        </label>
                        <label>
                            公開聯絡方式
                            <input
                                name="publicContact"
                                maxLength={300}
                                defaultValue={organization.publicContact}
                            />
                        </label>
                    </fieldset>
                    <p className="muted">
                        修改名稱或類型需重新審核；聯絡方式會顯示在公開頁面。
                    </p>
                    <div className="actions">
                        <button className="primary" disabled={busy}>
                            {busy ? '儲存中…' : '儲存'}
                        </button>
                        <button
                            type="button"
                            disabled={busy}
                            onClick={() => setEditing(false)}
                        >
                            取消
                        </button>
                    </div>
                </form>
            ) : (
                <dl className="organization-details">
                    <dt>類型</dt>
                    <dd>
                        {organization.type === 'INDIVIDUAL'
                            ? '個人中途'
                            : '救援團隊'}
                    </dd>
                    {organization.city && (
                        <>
                            <dt>地區</dt>
                            <dd>{organization.city}</dd>
                        </>
                    )}
                    {organization.description && (
                        <>
                            <dt>介紹</dt>
                            <dd className="preserve-lines">
                                {organization.description}
                            </dd>
                        </>
                    )}
                    {organization.publicContact && (
                        <>
                            <dt>聯絡方式</dt>
                            <dd>{organization.publicContact}</dd>
                        </>
                    )}
                </dl>
            )}
            {!editing && canManage && (
                <div className="actions">
                    {canPublish && (
                        <button
                            className="primary"
                            disabled={busy}
                            onClick={() =>
                                void mutate(() =>
                                    post(
                                        `/api/v1/organizations/${organization.id}/publications`,
                                        {
                                            expectedVersion:
                                                organization.version,
                                        },
                                    ),
                                )
                            }
                        >
                            公開中途之家
                        </button>
                    )}
                    {organization.publishedAt && (
                        <button
                            disabled={busy}
                            onClick={() =>
                                void mutate(() =>
                                    request(
                                        `/api/v1/organizations/${organization.id}/publications`,
                                        {
                                            method: 'DELETE',
                                            body: JSON.stringify({
                                                expectedVersion:
                                                    organization.version,
                                            }),
                                        },
                                    ),
                                )
                            }
                        >
                            取消公開
                        </button>
                    )}
                    {organization.reviewStatus === 'PENDING' && (
                        <p className="muted">
                            審核通過後，你可以自行選擇是否公開。
                        </p>
                    )}
                </div>
            )}
            {error && (
                <p className="notice error" role="alert">
                    {error}
                </p>
            )}
        </section>
    );
}

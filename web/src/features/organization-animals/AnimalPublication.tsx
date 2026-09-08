import { useRef } from 'react';
import { Link } from 'react-router-dom';
import type {
    AnimalListing,
    AnimalListingFields,
} from '../../../../src/contracts/organizationAnimals';
import type { OrganizationWorkspace } from '../../../../src/contracts/organizations';
import { AnimalPresentation } from './AnimalPresentation';

export function AnimalPublication({
    org,
    animal,
    fields,
    canWrite,
    dirty,
    saving,
    onPublication,
}: {
    org: OrganizationWorkspace;
    animal: AnimalListing | null;
    fields: AnimalListingFields;
    canWrite: boolean;
    dirty: boolean;
    saving: boolean;
    onPublication: (publish: boolean) => void;
}) {
    const preview = useRef<HTMLDialogElement>(null);
    const canPublish = ['OWNER', 'ADMIN'].includes(org.role) && canWrite;
    const missing = [
        !fields.name.trim() && '名字',
        !fields.city.trim() && '縣市',
        !fields.description.trim() && '介紹',
        !animal?.photoIds.length && '至少一張照片',
    ].filter(Boolean);
    return (
        <>
            <aside
                className="panel listing-publish"
                aria-labelledby="listing-publish-title"
            >
                <h2 id="listing-publish-title">預覽與公開</h2>
                <p>
                    {animal?.publishedAt
                        ? '大家可以在中途之家頁面找到牠。'
                        : '公開後，大家可以從中途之家頁面認識牠。'}
                </p>
                {!animal?.publishedAt && missing.length > 0 && (
                    <p className="muted">還需要：{missing.join('、')}。</p>
                )}
                {canPublish &&
                    (!org.publishedAt || org.reviewStatus !== 'APPROVED') && (
                        <p className="notice">中途之家需先通過審核並公開。</p>
                    )}
                {!canPublish && canWrite && (
                    <p className="muted">草稿完成後，請負責人或管理員公開。</p>
                )}
                <div className="listing-publish-actions">
                    <button
                        type="button"
                        disabled={!animal || dirty || saving}
                        onClick={() => preview.current?.showModal()}
                    >
                        預覽已儲存內容
                    </button>
                    {animal &&
                        canPublish &&
                        (animal.publishedAt ? (
                            <button
                                type="button"
                                disabled={saving}
                                onClick={() => {
                                    if (
                                        window.confirm(
                                            '下架後，一般使用者將無法查看這隻動物。確定下架？',
                                        )
                                    )
                                        onPublication(false);
                                }}
                            >
                                下架並編輯
                            </button>
                        ) : (
                            <button
                                type="button"
                                className="primary"
                                disabled={
                                    saving ||
                                    dirty ||
                                    missing.length > 0 ||
                                    !org.publishedAt ||
                                    org.reviewStatus !== 'APPROVED'
                                }
                                onClick={() => {
                                    if (
                                        window.confirm(
                                            '確定公開這隻動物？照片與介紹將對所有人顯示。',
                                        )
                                    )
                                        onPublication(true);
                                }}
                            >
                                公開動物
                            </button>
                        ))}
                    {animal?.publishedAt && (
                        <Link
                            to={`/foster-organizations/${org.id}/animals/${animal.id}`}
                        >
                            查看公開頁面
                        </Link>
                    )}
                </div>
            </aside>
            <dialog
                className="listing-preview panel"
                ref={preview}
                aria-labelledby="listing-preview-title"
            >
                <div className="section-heading">
                    <h2 id="listing-preview-title">刊登預覽</h2>
                    <button
                        type="button"
                        onClick={() => preview.current?.close()}
                    >
                        關閉預覽
                    </button>
                </div>
                {animal && <AnimalPresentation animal={animal} />}
            </dialog>
        </>
    );
}

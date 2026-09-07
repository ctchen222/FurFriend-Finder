import { useState } from 'react';
import type { AnimalListing } from '../../../../src/contracts/organizationAnimals';
import { post, request } from '../../api/client';
import { animalPhotoUrl } from './AnimalPresentation';

export function AnimalPhotos({
    animal,
    disabled,
    onChange,
    onBusyChange,
}: {
    animal: AnimalListing;
    disabled: boolean;
    onChange: (animal: AnimalListing) => void;
    onBusyChange: (busy: boolean) => void;
}) {
    const [busy, setBusy] = useState('');
    const [error, setError] = useState('');
    const [message, setMessage] = useState('');
    const base = `/api/v1/organizations/${animal.organizationId}/animals/${animal.id}/photos`;
    async function act(
        key: string,
        action: () => Promise<{ animal: AnimalListing }>,
        success: string,
    ) {
        if (busy || disabled) return;
        setBusy(key);
        onBusyChange(true);
        setError('');
        setMessage('');
        try {
            onChange((await action()).animal);
            setMessage(success);
        } catch (failure) {
            setError((failure as Error).message);
        } finally {
            setBusy('');
            onBusyChange(false);
        }
    }
    return (
        <section
            className="panel"
            aria-labelledby="animal-photos-title"
            aria-busy={Boolean(busy)}
        >
            <div className="section-heading">
                <h2 id="animal-photos-title">照片</h2>
                <span className="muted">{animal.photoIds.length} / 6</span>
            </div>
            <p className="muted">
                JPG、PNG 或 WebP，每張 5 MB 以下。第一張是封面。
            </p>
            {error && (
                <p className="notice error" role="alert">
                    {error}
                </p>
            )}
            {message && (
                <p role="status" className="notice">
                    {message}
                </p>
            )}
            <ul className="listing-photo-grid">
                {animal.photoIds.map((photo, index) => (
                    <li key={photo}>
                        <img
                            src={animalPhotoUrl(animal, photo)}
                            alt={`${animal.name}的第 ${index + 1} 張照片`}
                        />
                        <div className="member-actions">
                            {index === 0 ? (
                                <span className="listing-status">封面</span>
                            ) : (
                                <button
                                    type="button"
                                    disabled={disabled || Boolean(busy)}
                                    aria-label={`將第 ${index + 1} 張設為封面`}
                                    onClick={() =>
                                        void act(
                                            photo,
                                            () =>
                                                post(`${base}/${photo}/cover`, {
                                                    expectedVersion:
                                                        animal.version,
                                                }),
                                            '封面已更新。',
                                        )
                                    }
                                >
                                    設為封面
                                </button>
                            )}
                            <button
                                type="button"
                                className="danger"
                                disabled={disabled || Boolean(busy)}
                                aria-label={`移除第 ${index + 1} 張照片`}
                                onClick={() => {
                                    if (window.confirm('確定移除這張照片？'))
                                        void act(
                                            photo,
                                            () =>
                                                request(`${base}/${photo}`, {
                                                    method: 'DELETE',
                                                    body: JSON.stringify({
                                                        expectedVersion:
                                                            animal.version,
                                                    }),
                                                }),
                                            '照片已移除。',
                                        );
                                }}
                            >
                                移除
                            </button>
                        </div>
                    </li>
                ))}
            </ul>
            {!animal.photoIds.length && (
                <p className="listing-placeholder">
                    讓大家看見牠：先上傳一張清楚的照片。
                </p>
            )}
            <label className="listing-upload">
                {busy === 'upload' ? '照片處理中…' : '上傳照片'}
                <input
                    type="file"
                    accept="image/jpeg,image/png,image/webp"
                    disabled={
                        disabled || Boolean(busy) || animal.photoIds.length >= 6
                    }
                    onChange={(event) => {
                        const file = event.target.files?.[0];
                        event.target.value = '';
                        if (!file) return;
                        if (
                            file.size > 5 * 1024 * 1024 ||
                            !['image/jpeg', 'image/png', 'image/webp'].includes(
                                file.type,
                            )
                        ) {
                            setError(
                                '請選擇 5 MB 以下的 JPG、PNG 或 WebP 照片',
                            );
                            return;
                        }
                        void act(
                            'upload',
                            () =>
                                request(base, {
                                    method: 'POST',
                                    body: file,
                                    headers: {
                                        'Content-Type': file.type,
                                        'X-Animal-Version': String(
                                            animal.version,
                                        ),
                                    },
                                }),
                            '照片已上傳。',
                        );
                    }}
                />
            </label>
        </section>
    );
}

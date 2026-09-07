import type { AnimalListing } from '../../../../src/contracts/organizationAnimals';
import { listingLabels } from '../../../../src/contracts/organizationAnimals';

export function animalPhotoUrl(
    animal: AnimalListing,
    photoId: string,
    isPublic = false,
) {
    return `/api/v1/${isPublic ? 'public/' : ''}organizations/${animal.organizationId}/animals/${animal.id}/photos/${photoId}`;
}

/** Used by the editor preview and public detail so their content stays identical. */
export function AnimalPresentation({
    animal,
    isPublic = false,
}: {
    animal: AnimalListing;
    isPublic?: boolean;
}) {
    const traits = [
        listingLabels.species[animal.species],
        animal.city,
        animal.sex !== 'UNKNOWN' ? listingLabels.sex[animal.sex] : '',
        animal.ageGroup !== 'UNKNOWN'
            ? listingLabels.ageGroup[animal.ageGroup]
            : '',
        animal.size !== 'UNKNOWN' ? listingLabels.size[animal.size] : '',
    ].filter(Boolean);
    return (
        <article className="listing-presentation">
            <div className="listing-gallery">
                {animal.photoIds.length ? (
                    animal.photoIds.map((photo, index) => (
                        <img
                            key={photo}
                            src={animalPhotoUrl(animal, photo, isPublic)}
                            alt={`${animal.name}的${index === 0 ? '封面' : `第 ${index + 1} 張`}照片`}
                            loading={index ? 'lazy' : 'eager'}
                        />
                    ))
                ) : (
                    <div className="listing-placeholder">尚未上傳照片</div>
                )}
            </div>
            <div>
                <p className="listing-status">
                    {listingLabels.adoptionStatus[animal.adoptionStatus]}
                </p>
                <h2>{animal.name}</h2>
                <p className="muted">{traits.join(' · ')}</p>
                <p className="preserve-lines">
                    {animal.description || '尚未填寫介紹。'}
                </p>
                {animal.adoptionRequirements && (
                    <>
                        <h3>領養前請了解</h3>
                        <p className="preserve-lines">
                            {animal.adoptionRequirements}
                        </p>
                    </>
                )}
            </div>
        </article>
    );
}

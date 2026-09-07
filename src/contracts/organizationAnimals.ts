/** Public fields only. Internal audit and creator identity never enter this projection. */
export interface AnimalListingFields {
    name: string;
    species: 'CAT' | 'DOG' | 'OTHER';
    sex: 'MALE' | 'FEMALE' | 'UNKNOWN';
    ageGroup: 'BABY' | 'YOUNG' | 'ADULT' | 'SENIOR' | 'UNKNOWN';
    size: 'SMALL' | 'MEDIUM' | 'LARGE' | 'UNKNOWN';
    city: string;
    description: string;
    adoptionRequirements: string;
    adoptionStatus: 'AVAILABLE' | 'IN_DISCUSSION' | 'ADOPTED';
}
export interface AnimalListing extends AnimalListingFields {
    id: string;
    organizationId: string;
    publishedAt: string | null;
    version: number;
    photoIds: string[];
}
export interface AnimalListingPage {
    animals: AnimalListing[];
    nextCursor: string | null;
}
export const listingLabels = {
    species: { CAT: '貓', DOG: '狗', OTHER: '其他動物' },
    sex: { MALE: '公', FEMALE: '母', UNKNOWN: '尚不確定' },
    ageGroup: {
        BABY: '幼年',
        YOUNG: '青年',
        ADULT: '成年',
        SENIOR: '熟齡',
        UNKNOWN: '尚不確定',
    },
    size: { SMALL: '小型', MEDIUM: '中型', LARGE: '大型', UNKNOWN: '尚不確定' },
    adoptionStatus: {
        AVAILABLE: '可領養',
        IN_DISCUSSION: '洽談中',
        ADOPTED: '已送養',
    },
} as const;

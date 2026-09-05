import { COLOUR_ALIASES, KIND_ALIASES, SEX_ALIASES, VARIETY_ALIASES } from '../config/matchingAliases';

export interface NormalizedTraits {
    kind: 'dog' | 'cat' | 'other' | null;
    sex: 'male' | 'female' | null;
    variety: string | null;
    colours: string[];
}

function clean(value: string | null | undefined): string {
    return (value ?? '').trim().toLowerCase();
}

export function normalizeTraits(input: {
    kind?: string | null;
    sex?: string | null;
    variety?: string | null;
    colour?: string | null;
}): NormalizedTraits {
    const kindValue = clean(input.kind);
    const kind = KIND_ALIASES[kindValue] ?? null;
    const sex = SEX_ALIASES[clean(input.sex)] ?? null;
    const varietyValue = clean(input.variety);
    const variety = VARIETY_ALIASES[varietyValue] ?? (varietyValue || null);

    const colourParts = clean(input.colour)
        .replace(/[，、。；：,.!?/|+]/g, ' ')
        .replace(/色/g, '色 ')
        .split(/\s+/)
        .map((part) => part.trim())
        .filter(Boolean)
        .flatMap((part) => {
            if (part === '黑白' || part === '黑白色') return ['black', 'white'];
            return [COLOUR_ALIASES[part] ?? part];
        })
        .filter((part, index, values) => values.indexOf(part) === index);

    return { kind, sex, variety, colours: colourParts };
}

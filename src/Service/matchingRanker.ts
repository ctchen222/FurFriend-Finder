import { normalizeTraits, type NormalizedTraits } from './matchingTraits';

export interface RankSignals {
    variety: number | null;
    colour: number | null;
    sex: number | null;
    location: number | null;
}

export interface RankedCandidate {
    score: number | null;
    reasons: string[];
}

const WEIGHTS = { variety: 0.35, colour: 0.30, sex: 0.15, location: 0.20 } as const;

export function combineSignals(signals: RankSignals): number | null {
    const available = (Object.keys(WEIGHTS) as Array<keyof RankSignals>)
        .filter((key) => signals[key] !== null && Number.isFinite(signals[key]));
    if (available.length === 0) return null;
    const totalWeight = available.reduce((sum, key) => sum + WEIGHTS[key], 0);
    const weighted = available.reduce((sum, key) => sum + (signals[key] as number) * WEIGHTS[key], 0);
    return weighted / totalWeight;
}

function colourJaccard(left: string[], right: string[]): number | null {
    if (left.length === 0 || right.length === 0) return null;
    const a = new Set(left); const b = new Set(right);
    const intersection = [...a].filter((value) => b.has(value)).length;
    const union = new Set([...a, ...b]).size;
    return union === 0 ? null : intersection / union;
}

export function rankCandidate(input: {
    candidate: { kind?: string | null; variety?: string | null; sex?: string | null; colour?: string | null };
    query: NormalizedTraits;
    distanceKm?: number | null;
}): RankedCandidate {
    const candidate = normalizeTraits(input.candidate);
    const signals: RankSignals = {
        variety: input.query.variety && candidate.variety ? (input.query.variety === candidate.variety ? 1 : 0) : null,
        colour: colourJaccard(input.query.colours, candidate.colours),
        sex: input.query.sex && candidate.sex ? (input.query.sex === candidate.sex ? 1 : 0) : null,
        location: input.distanceKm !== null && input.distanceKm !== undefined && Number.isFinite(input.distanceKm)
            ? Math.exp(-input.distanceKm / 50) : null,
    };
    const reasons: string[] = [];
    if (signals.variety === 1) reasons.push('品種標示相同');
    if (signals.colour !== null && signals.colour > 0) reasons.push('毛色包含相同特徵');
    if (signals.sex === 1) reasons.push('性別相同');
    if (signals.location !== null) reasons.push('距離以收容所位置計算');
    return { score: combineSignals(signals), reasons };
}

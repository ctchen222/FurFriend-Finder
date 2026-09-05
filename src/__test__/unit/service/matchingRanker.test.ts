import { combineSignals, rankCandidate } from '../../../Service/matchingRanker';
import { normalizeTraits } from '../../../Service/matchingTraits';

describe('matchingRanker', () => {
    it('renormalizes weights when signals are missing', () => {
        expect(combineSignals({ variety: 1, colour: null, sex: null, location: null })).toBe(1);
        expect(combineSignals({ variety: null, colour: null, sex: null, location: null })).toBeNull();
    });

    it('returns explainable reasons and a soft location signal', () => {
        const result = rankCandidate({
            query: normalizeTraits({ kind: '狗', variety: '米克斯', colour: '黑白', sex: 'M' }),
            candidate: { kind: '犬', variety: '米克斯', colour: '黑色', sex: 'M' },
            distanceKm: 0,
        });
        expect(result.score).toBeGreaterThan(0.7);
        expect(result.reasons).toEqual(expect.arrayContaining(['品種標示相同', '性別相同']));
    });
});

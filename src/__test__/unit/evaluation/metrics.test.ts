import { hitAtK, recallAtK, reciprocalRankAtK } from '../../../evaluation/metrics';

describe('matching evaluation metrics', () => {
    it('calculates recall without double-counting duplicate retrieved IDs', () => {
        expect(recallAtK([8, 7, 7, 6], [7, 9], 10)).toBe(0.5);
        expect(reciprocalRankAtK([8, 7, 6], [7], 10)).toBe(0.5);
    });
    it('keeps empty relevant sets undefined', () => {
        expect(recallAtK([8], [], 10)).toBeNull();
        expect(reciprocalRankAtK([8], [], 10)).toBeNull();
        expect(hitAtK([8], [], 10)).toBeNull();
    });
});

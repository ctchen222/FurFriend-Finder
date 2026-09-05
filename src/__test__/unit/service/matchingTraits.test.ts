import { normalizeTraits } from '../../../Service/matchingTraits';

describe('normalizeTraits', () => {
    it('normalizes dog aliases and mixed colours consistently', () => {
        expect(normalizeTraits({ kind: '狗', sex: '公', colour: '黑色、白色' }))
            .toEqual(normalizeTraits({ kind: '犬', sex: 'M', colour: '黑白' }));
    });

    it('does not turn unknown species into a dog or cat', () => {
        expect(normalizeTraits({ kind: '狐狸' }).kind).toBeNull();
    });

    it('keeps tabby distinct from black', () => {
        expect(normalizeTraits({ colour: '虎斑' }).colours).toEqual(['tabby']);
        expect(normalizeTraits({ colour: '黑色' }).colours).toEqual(['black']);
    });
});

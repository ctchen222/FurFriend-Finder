function unique(values: number[]): number[] { return [...new Set(values)]; }

export function recallAtK(retrieved: number[], relevant: number[], k: number): number | null {
    const expected = unique(relevant);
    if (expected.length === 0) return null;
    const actual = new Set(unique(retrieved).slice(0, k));
    return expected.filter((id) => actual.has(id)).length / expected.length;
}

export function reciprocalRankAtK(retrieved: number[], relevant: number[], k: number): number | null {
    if (relevant.length === 0) return null;
    const expected = new Set(relevant);
    const index = unique(retrieved).slice(0, k).findIndex((id) => expected.has(id));
    return index < 0 ? 0 : 1 / (index + 1);
}

export function hitAtK(retrieved: number[], relevant: number[], k: number): number | null {
    if (relevant.length === 0) return null;
    return unique(retrieved).slice(0, k).some((id) => relevant.includes(id)) ? 1 : 0;
}

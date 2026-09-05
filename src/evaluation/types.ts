export type EvaluationLabel = 'known-positive' | 'confirmed-no-match' | 'unjudged';

export interface MatchEvaluationCase {
    id: string;
    split: 'development' | 'holdout';
    provenance: 'synthetic' | 'human-reviewed';
    input: { kind: string; lost_place: string; sex?: string; variety?: string; colour?: string };
    relevantAnimalIds: number[];
    retrievedAnimalIds: number[];
    label: EvaluationLabel;
    tags: string[];
}

export interface EvaluationOutput {
    datasetVersion: string;
    engineVersion: string;
    positiveCases: number;
    hitAt10: number | null;
    recallAt10: number | null;
    mrrAt10: number | null;
    candidateRecall: number | null;
    knownFalsePositiveRate: number | null;
}

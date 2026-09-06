import fs from 'fs';
import crypto from 'crypto';
import path from 'path';
import { recallAtK, reciprocalRankAtK, hitAtK } from '../evaluation/metrics';
import type { MatchEvaluationCase, EvaluationOutput } from '../evaluation/types';

const fixturePath = path.join(__dirname, '..', '__test__', 'fixtures', 'matching', 'cases.json');
const cases = JSON.parse(fs.readFileSync(fixturePath, 'utf8')) as { datasetVersion: string; cases: MatchEvaluationCase[] };
const positives = cases.cases.filter((item) => item.label === 'known-positive');
const average = (values: Array<number | null>): number | null => {
    const present = values.filter((value): value is number => value !== null);
    return present.length === 0 ? null : present.reduce((sum, value) => sum + value, 0) / present.length;
};
const output: EvaluationOutput = {
    datasetVersion: cases.datasetVersion,
    engineVersion: process.argv.includes('--engine') ? process.argv[process.argv.indexOf('--engine') + 1] ?? 'rules-v2' : 'rules-v2',
    positiveCases: positives.length,
    hitAt10: average(positives.map((item) => hitAtK(item.retrievedAnimalIds, item.relevantAnimalIds, 10))),
    recallAt10: average(positives.map((item) => recallAtK(item.retrievedAnimalIds, item.relevantAnimalIds, 10))),
    mrrAt10: average(positives.map((item) => reciprocalRankAtK(item.retrievedAnimalIds, item.relevantAnimalIds, 10))),
    candidateRecall: average(positives.map((item) => recallAtK(item.retrievedAnimalIds, item.relevantAnimalIds, item.retrievedAnimalIds.length))),
    knownFalsePositiveRate: (() => {
        const negatives = cases.cases.filter((item) => item.label === 'confirmed-no-match');
        return negatives.length === 0 ? null : negatives.filter((item) => item.retrievedAnimalIds.length > 0).length / negatives.length;
    })(),
};
const outputIndex = process.argv.indexOf('--output');
if (outputIndex >= 0 && process.argv[outputIndex + 1]) {
    fs.writeFileSync(process.argv[outputIndex + 1], `${JSON.stringify({ ...output, datasetSha256: crypto.createHash('sha256').update(JSON.stringify(cases)).digest('hex') }, null, 2)}\n`);
}
console.log(JSON.stringify(output));

import { describe, it, expect } from 'vitest';
import {
    roundToHalfPoint,
    calculateSubjectData,
    calculateSubjectDataForSem,
    calculateRequiredGrade,
    checkVaudPromotion,
    getSubjectExamConfig,
    getYear2SubjectAverage,
    getStatusClass
} from '../src/logic/calculator.js';

// NOTE: the historical test_calculator.js suite tested calculator_logic.js,
// a Node-only file that had diverged from the math actually shipped in the
// browser (flat "deficit ≤ 3.0 for every year" rule, complementary-exam
// eligibility). Those rules do not exist in the runtime engine and are NOT
// tested here. This suite tests the real engine: per-year branching and the
// Year 3 double-compensation rule.

// --- helpers -----------------------------------------------------------

const ts = (value) => ({ value, type: 'TS' });
const ta = (value) => ({ value, type: 'TA' });

function subject({ id = 'sub_test', name = 'Test', role = 'general', target = 4.0, mode = 'dual', sem1 = [], sem2 = [], exams } = {}) {
    const s = { id, name, role, target, evaluationMode: mode, grades: { sem1, sem2 } };
    if (exams) s.exams = exams;
    return s;
}

function ctx(overrides = {}) {
    return {
        baseYear: 1,
        currentYear: 1,
        subjectsYear2: [],
        subjectsYear2Rep: [],
        repeatingYear2: false,
        ...overrides
    };
}

// --- roundToHalfPoint (ported from test_calculator.js) -----------------

describe('roundToHalfPoint', () => {
    it('rounds to the nearest half point, half up', () => {
        expect(roundToHalfPoint(4.25)).toBe(4.5);
        expect(roundToHalfPoint(4.24)).toBe(4.0);
        expect(roundToHalfPoint(4.75)).toBe(5.0);
        expect(roundToHalfPoint(4.74)).toBe(4.5);
        expect(roundToHalfPoint(4.0)).toBe(4.0);
        expect(roundToHalfPoint(3.25)).toBe(3.5);
        expect(roundToHalfPoint(3.24)).toBe(3.0);
    });

    it('returns 0 for null/undefined/NaN', () => {
        expect(roundToHalfPoint(null)).toBe(0);
        expect(roundToHalfPoint(undefined)).toBe(0);
        expect(roundToHalfPoint(NaN)).toBe(0);
    });
});

// --- semester averages: TA/TS weighting and rounding order -------------

describe('calculateSubjectDataForSem', () => {
    it('returns nulls for an empty semester', () => {
        const data = calculateSubjectDataForSem(subject(), 'sem1');
        expect(data.rawAverage).toBeNull();
        expect(data.roundedAverage).toBeNull();
    });

    it('standard mode is a plain mean', () => {
        const s = subject({ mode: 'standard', sem1: [ts(4.0), ts(5.0), ts(4.3)] });
        const data = calculateSubjectDataForSem(s, 'sem1');
        expect(data.rawAverage).toBeCloseTo(4.4333, 3);
        expect(data.roundedAverage).toBe(4.5);
        expect(data.taAverage).toBeNull();
    });

    it('dual mode: TA average is rounded FIRST, then counts as one virtual TS grade', () => {
        // TAs [4.1, 4.2] → mean 4.15 → rounded 4.0 (not 4.15!)
        // combined with TS 5.0 → (5.0 + 4.0) / 2 = 4.5
        const s = subject({ sem1: [ta(4.1), ta(4.2), ts(5.0)] });
        const data = calculateSubjectDataForSem(s, 'sem1');
        expect(data.taAverage).toBeCloseTo(4.15, 5);
        expect(data.rawAverage).toBeCloseTo(4.5, 5);
        expect(data.roundedAverage).toBe(4.5);
    });

    it('dual mode: TA-only semester uses the rounded TA average alone', () => {
        const s = subject({ sem1: [ta(5.0), ta(4.0)] });
        const data = calculateSubjectDataForSem(s, 'sem1');
        expect(data.rawAverage).toBe(4.5);
        expect(data.roundedAverage).toBe(4.5);
    });

    it('dual mode: TS-only semester is a plain mean of TS grades', () => {
        const s = subject({ sem1: [ts(4.0), ts(5.5)] });
        const data = calculateSubjectDataForSem(s, 'sem1');
        expect(data.rawAverage).toBeCloseTo(4.75, 5);
        expect(data.roundedAverage).toBe(5.0);
        expect(data.tsAverage).toBeCloseTo(4.75, 5);
    });
});

// --- annual combination -------------------------------------------------

describe('calculateSubjectData (annual)', () => {
    it('annual = mean of all pooled grades (TS grades + rounded TAs) across both semesters, re-rounded', () => {
        // sem1 [4.1, 4.2 TS] → raw 4.15 → rounded 4.0
        // sem2 [4.6 TS] → rounded 4.5
        // annual (pooled) = (4.1 + 4.2 + 4.6) / 3 = 4.3 → rounded 4.5
        const s = subject({ sem1: [ts(4.1), ts(4.2)], sem2: [ts(4.6)] });
        const data = calculateSubjectData(s, 'annual', ctx());
        expect(data.sem1Data.roundedAverage).toBe(4.0);
        expect(data.sem2Data.roundedAverage).toBe(4.5);
        expect(data.rawAverage).toBeCloseTo(4.3, 5);
        expect(data.roundedAverage).toBe(4.5);
    });

    it('annual in dual mode pools TS grades with virtual TA averages from both semesters', () => {
        // sem1 [5.5 TS, 6.0 TA] → TA rounded = 6.0; Sem 1 average = (5.5 + 6.0)/2 = 5.75 → rounded 6.0
        // sem2 [4.0 TS, 4.0 TS, 4.0 TS, 4.0 TA] → TA rounded = 4.0; Sem 2 average = (4+4+4+4)/4 = 4.0 → rounded 4.0
        // annual pooled = [5.5, 4.0, 4.0, 4.0 (TSs)] + [6.0 (TA1), 4.0 (TA2)]
        // sum = 27.5, count = 6 → raw = 27.5 / 6 = 4.5833... → rounded 4.5 (vs 5.0 with old (6.0+4.0)/2 formula)
        const s = subject({
            evaluationMode: 'dual',
            sem1: [ts(5.5), ta(6.0)],
            sem2: [ts(4.0), ts(4.0), ts(4.0), ta(4.0)]
        });
        const data = calculateSubjectData(s, 'annual', ctx());
        expect(data.sem1Data.roundedAverage).toBe(6.0);
        expect(data.sem2Data.roundedAverage).toBe(4.0);
        expect(data.rawAverage).toBeCloseTo(4.5833, 4);
        expect(data.roundedAverage).toBe(4.5);
    });

    it('falls back to the single graded semester', () => {
        const s = subject({ sem1: [ts(5.0)] });
        const data = calculateSubjectData(s, 'annual', ctx());
        expect(data.roundedAverage).toBe(5.0);
    });

    it('explicit semester routes to that semester only', () => {
        const s = subject({ sem1: [ts(5.0)], sem2: [ts(3.0)] });
        expect(calculateSubjectData(s, 'sem1', ctx()).roundedAverage).toBe(5.0);
        expect(calculateSubjectData(s, 'sem2', ctx()).roundedAverage).toBe(3.0);
    });
});

// --- maturity exams (Year 3) --------------------------------------------

describe('maturity exams', () => {
    const y3ctx = ctx({ baseYear: 3, currentYear: 3 });

    it('getSubjectExamConfig: written+oral for core roles, oral-only for OC, null otherwise', () => {
        expect(getSubjectExamConfig(subject({ id: 'y3_fr', role: 'french' }), y3ctx)).toEqual({ written: true, oral: true });
        expect(getSubjectExamConfig(subject({ id: 'y3_oc', role: 'oc' }), y3ctx)).toEqual({ written: false, oral: true });
        expect(getSubjectExamConfig(subject({ id: 'y3_hist', role: 'general' }), y3ctx)).toBeNull();
        // user-added subject counts as Y3 only when the current year is 3 / 3.5
        expect(getSubjectExamConfig(subject({ id: 'sub_123', role: 'french' }), y3ctx)).toEqual({ written: true, oral: true });
        expect(getSubjectExamConfig(subject({ id: 'sub_123', role: 'french' }), ctx({ currentYear: 2 }))).toBeNull();
    });

    it('final grade = mean(rounded annual, raw exam mean), re-rounded', () => {
        // annual: sem1 4.5, sem2 4.5 → 4.5 ; exams (5.0 + 4.5)/2 = 4.75
        // final = (4.5 + 4.75)/2 = 4.625 → rounded 4.5
        const s = subject({ id: 'y3_fr', role: 'french', sem1: [ts(4.5)], sem2: [ts(4.5)], exams: { written: 5.0, oral: 4.5 } });
        const data = calculateSubjectData(s, 'annual', y3ctx);
        expect(data.annualRoundedAverage).toBe(4.5);
        expect(data.examGrade).toBeCloseTo(4.75, 5);
        expect(data.rawAverage).toBeCloseTo(4.625, 5);
        expect(data.roundedAverage).toBe(4.5);
    });

    it('written-only and oral-only exams count alone', () => {
        const w = subject({ id: 'y3_ma', role: 'math', sem1: [ts(4.0)], exams: { written: 5.0, oral: null } });
        expect(calculateSubjectData(w, 'annual', y3ctx).examGrade).toBe(5.0);

        const o = subject({ id: 'y3_oc', role: 'oc', sem1: [ts(4.0)], exams: { written: 5.0, oral: 4.0 } });
        // OC ignores the written exam entirely
        expect(calculateSubjectData(o, 'annual', y3ctx).examGrade).toBe(4.0);
    });

    it('exam alone produces a grade when no semester grades exist', () => {
        const s = subject({ id: 'y3_fr', role: 'french', exams: { written: 5.0, oral: 4.0 } });
        const data = calculateSubjectData(s, 'annual', y3ctx);
        expect(data.rawAverage).toBeCloseTo(4.5, 5);
        expect(data.roundedAverage).toBe(4.5);
        expect(data.annualRoundedAverage).toBeNull();
    });

    it('ported scenario: exam combine matches the old suite expectations', () => {
        // Français: annual 4.5, exams (5.0+4.0)/2 = 4.5 → final 4.5
        const fr = subject({ id: 'y3_fr', role: 'french', sem1: [ts(4.5), ts(4.5)], sem2: [ts(4.5), ts(4.5)], exams: { written: 5.0, oral: 4.0 } });
        expect(calculateSubjectData(fr, 'annual', y3ctx).roundedAverage).toBe(4.5);
        // Maths: annual 4.0, exams 5.0 → final (4.0+5.0)/2 = 4.5
        const ma = subject({ id: 'y3_ma', role: 'math', sem1: [ts(4.0)], sem2: [ts(4.0)], exams: { written: 5.0, oral: 5.0 } });
        expect(calculateSubjectData(ma, 'annual', y3ctx).roundedAverage).toBe(4.5);
        // OC: annual 4.0, oral 5.0 → final 4.5
        const oc = subject({ id: 'y3_oc', role: 'oc', sem1: [ts(4.0)], sem2: [ts(4.0)], exams: { oral: 5.0 } });
        expect(calculateSubjectData(oc, 'annual', y3ctx).roundedAverage).toBe(4.5);
    });
});

// --- locked Year 2 carry-over subjects -----------------------------------

describe('locked Year 2 carry-overs', () => {
    const year2 = [
        subject({ id: 'y2_phys', name: 'Physique', role: 'general', sem1: [ts(5.0)], sem2: [ts(4.0)] }),
        subject({ id: 'y2_chim', name: 'Chimie', role: 'general', sem1: [ts(3.0)] }),
        subject({ id: 'y2_art', name: 'Arts Visuels', role: 'art', sem1: [ts(5.5)] })
    ];

    it('physique_y2 / chimie_y2 mirror the Year 2 annual averages', () => {
        const c = ctx({ baseYear: 3, currentYear: 3, subjectsYear2: year2 });
        const phys = calculateSubjectData(subject({ id: 'y3_phys', role: 'physique_y2' }), 'annual', c);
        expect(phys.roundedAverage).toBe(4.5); // (5.0 + 4.0)/2
        const chim = calculateSubjectData(subject({ id: 'y3_chim', role: 'chimie_y2' }), 'annual', c);
        expect(chim.roundedAverage).toBe(3.0);
    });

    it('phys_chimie_y2 combines both and art_y2 mirrors the art subject', () => {
        const c = ctx({ baseYear: 3, currentYear: 3, subjectsYear2: year2 });
        const combo = calculateSubjectData(subject({ id: 'y3_pc', role: 'phys_chimie_y2' }), 'annual', c);
        expect(combo.roundedAverage).toBe(4.0); // (4.5 + 3.0)/2 = 3.75 → 4.0
        const art = calculateSubjectData(subject({ id: 'y3_art', role: 'art_y2' }), 'annual', c);
        expect(art.roundedAverage).toBe(5.5);
    });

    it('repeat-aware lookup uses the repeat list when Year 2 is being repeated', () => {
        const rep = [subject({ id: 'y2r_phys', name: 'Physique', sem1: [ts(6.0)] })];
        const c = ctx({ subjectsYear2: year2, subjectsYear2Rep: rep, repeatingYear2: true });
        expect(getYear2SubjectAverage('physique', c)).toBe(6.0);
        const cFirst = ctx({ subjectsYear2: year2, subjectsYear2Rep: rep, repeatingYear2: false });
        expect(getYear2SubjectAverage('physique', cFirst)).toBe(4.5);
    });

    it('returns null when the carry-over source is missing', () => {
        const c = ctx({ subjectsYear2: [] });
        const data = calculateSubjectData(subject({ role: 'physique_y2' }), 'annual', c);
        expect(data.rawAverage).toBeNull();
    });
});

// --- promotion: Years 1 & 2 ----------------------------------------------

// A subject graded in sem1 with a single TS grade — its rounded average IS
// that grade, which keeps the promotion scenarios easy to read.
const graded = (role, value, name = role) => subject({ name, role, sem1: [ts(value)] });

describe('checkVaudPromotion — Years 1 & 2', () => {
    const y1 = ctx({ baseYear: 1 });

    it('promotes when core sum ≥ 16, total ≥ n×4 and ≤ 4 insufficiencies', () => {
        const subjects = [
            graded('french', 4.5), graded('math', 4.0), graded('os', 5.0),
            graded('l2', 4.5), graded('l3', 3.5), // l2/l3 avg = 4.0 → g1 = 17.5
            graded('general', 4.5, 'Histoire'), graded('general', 4.0, 'Géo')
        ];
        const res = checkVaudPromotion(subjects, 'sem1', y1);
        expect(res.g1Sum).toBeCloseTo(17.5, 5);
        expect(res.coreSumPassed).toBe(true);
        expect(res.insuffisances).toBe(1);
        expect(res.isPromoted).toBe(true);
    });

    it('core sum boundary: exactly 16.0 passes, 15.5 fails', () => {
        const base = [graded('french', 4.0), graded('math', 4.0), graded('os', 4.0)];
        const pass = checkVaudPromotion([...base, graded('l2', 4.0)], 'sem1', y1);
        expect(pass.g1Sum).toBe(16.0);
        expect(pass.isPromoted).toBe(true);

        const fail = checkVaudPromotion([...base, graded('l2', 3.5)], 'sem1', y1);
        expect(fail.g1Sum).toBe(15.5);
        expect(fail.coreSumPassed).toBe(false);
        expect(fail.isPromoted).toBe(false);
    });

    it('total-points boundary: sum ≥ n×4.0 exactly passes, below fails', () => {
        // 4 core at 4.5 (g1 18) + 2 generals at 3.0 → sum 24, n=6 → exactly 24
        const subjects = [
            graded('french', 4.5), graded('math', 4.5), graded('os', 4.5), graded('l2', 4.5),
            graded('general', 3.0, 'A'), graded('general', 3.0, 'B')
        ];
        const res = checkVaudPromotion(subjects, 'sem1', y1);
        expect(res.g2Sum).toBe(24.0);
        expect(res.isPromoted).toBe(true);

        const below = checkVaudPromotion([...subjects, graded('general', 3.5, 'C')], 'sem1', y1);
        expect(below.g2Sum).toBe(27.5); // n=7 → needs 28
        expect(below.isPromoted).toBe(false);
    });

    it('insufficiency boundary: 4 insufficient passes, 5 fails', () => {
        const core = [graded('french', 5.0), graded('math', 5.0), graded('os', 5.0), graded('l2', 5.0), graded('l3', 5.0)];
        const four = [...core, graded('general', 3.5, 'A'), graded('general', 3.5, 'B'), graded('general', 3.5, 'C'), graded('general', 3.5, 'D')];
        expect(checkVaudPromotion(four, 'sem1', y1).isPromoted).toBe(true);

        const five = [...four, graded('general', 3.5, 'E')];
        const res = checkVaudPromotion(five, 'sem1', y1);
        expect(res.insuffisances).toBe(5);
        expect(res.isPromoted).toBe(false);
    });

    it('Years 1/2 have NO deficit-points rule: 3.5 missing points still promotes', () => {
        // This is exactly where the old calculator_logic.js diverged.
        const subjects = [
            graded('french', 5.0), graded('math', 5.0), graded('os', 5.0), graded('l2', 5.0), graded('l3', 5.0),
            graded('general', 2.5, 'A'), graded('general', 2.0, 'B') // manquants 1.5 + 2.0 = 3.5
        ];
        const res = checkVaudPromotion(subjects, 'sem1', y1);
        expect(res.pointsManquants).toBeCloseTo(3.5, 5);
        expect(res.isPromoted).toBe(true);

        // The very same student in Year 3 fails (manquants > 3.0).
        const y3res = checkVaudPromotion(subjects, 'sem1', ctx({ baseYear: 3, currentYear: 3 }));
        expect(y3res.isPromoted).toBe(false);
    });

    it('no core subjects graded → core check passes vacuously', () => {
        const subjects = [graded('general', 5.0, 'A'), graded('general', 5.0, 'B')];
        const res = checkVaudPromotion(subjects, 'sem1', y1);
        expect(res.coreSumPassed).toBe(true);
        expect(res.g1Sum).toBe(0);
        expect(res.isPromoted).toBe(true);
    });

    it('L2-only or L3-only falls back to that grade for the language slot', () => {
        const l2only = checkVaudPromotion([graded('french', 4.0), graded('math', 4.0), graded('os', 4.0), graded('l2', 4.0)], 'sem1', y1);
        expect(l2only.g1Sum).toBe(16.0);
        const l3only = checkVaudPromotion([graded('french', 4.0), graded('math', 4.0), graded('os', 4.0), graded('l3', 4.0)], 'sem1', y1);
        expect(l3only.g1Sum).toBe(16.0);
    });

    it('no graded subjects → not promoted, null average', () => {
        const res = checkVaudPromotion([subject()], 'sem1', y1);
        expect(res.activeSubjectsCount).toBe(0);
        expect(res.overallAverage).toBeNull();
        expect(res.isPromoted).toBe(false);
    });
});

// --- promotion: Year 3 double compensation --------------------------------

describe('checkVaudPromotion — Year 3', () => {
    const y3 = ctx({ baseYear: 3, currentYear: 3 });

    it('double compensation boundary: surplus ≥ 2 × missing passes', () => {
        // core at 4.5 → surplus 0.5 × 5 = 2.5 ; one general at 3.0 → missing 1.0
        // required compensation = 2.0 ≤ 2.5 → promoted
        const subjects = [
            graded('french', 4.5), graded('math', 4.5), graded('os', 4.5), graded('l2', 4.5), graded('l3', 4.5),
            graded('general', 3.0, 'Histoire')
        ];
        const res = checkVaudPromotion(subjects, 'sem1', y3);
        expect(res.pointsEnPlus).toBeCloseTo(2.5, 5);
        expect(res.requiredCompensation).toBeCloseTo(2.0, 5);
        expect(res.isPromoted).toBe(true);
    });

    it('double compensation failure: surplus below 2 × missing', () => {
        // missing 1.5 → required 3.0, surplus only 2.5 → fails ONLY on compensation
        const subjects = [
            graded('french', 4.5), graded('math', 4.5), graded('os', 4.5), graded('l2', 4.5), graded('l3', 4.5),
            graded('general', 2.5, 'Histoire')
        ];
        const res = checkVaudPromotion(subjects, 'sem1', y3);
        expect(res.pointsManquants).toBeCloseTo(1.5, 5);
        expect(res.pointsEnPlus).toBeCloseTo(2.5, 5);
        expect(res.requiredCompensation).toBeCloseTo(3.0, 5);
        expect(res.g2Sum).toBeGreaterThanOrEqual(res.g2Min); // sum check passes
        expect(res.insuffisances).toBeLessThanOrEqual(4);
        expect(res.isPromoted).toBe(false);
    });

    it('missing-points boundary: exactly 3.0 passes, 3.5 fails even with huge surplus', () => {
        const core = [graded('french', 5.5), graded('math', 5.5), graded('os', 5.5), graded('l2', 5.5), graded('l3', 5.5)]; // surplus 7.5
        const exactly3 = [...core, graded('general', 2.5, 'A'), graded('general', 2.5, 'B')]; // missing 3.0
        const res3 = checkVaudPromotion(exactly3, 'sem1', y3);
        expect(res3.pointsManquants).toBeCloseTo(3.0, 5);
        expect(res3.isPromoted).toBe(true);

        const over3 = [...core, graded('general', 2.5, 'A'), graded('general', 2.0, 'B')]; // missing 3.5
        const resOver = checkVaudPromotion(over3, 'sem1', y3);
        expect(resOver.pointsManquants).toBeCloseTo(3.5, 5);
        expect(resOver.isPromoted).toBe(false);
    });

    it('Year 3 also requires overall average ≥ 4.0', () => {
        // avg exactly 4.0 passes (all at 4.0 → no surplus needed, no missing)
        const flat = [graded('french', 4.0), graded('math', 4.0), graded('os', 4.0), graded('l2', 4.0), graded('general', 4.0, 'A')];
        expect(checkVaudPromotion(flat, 'sem1', y3).isPromoted).toBe(true);
    });

    it('repeat year uses the base-year rules (3.5 → Year 3 rules)', () => {
        const subjects = [
            graded('french', 4.5), graded('math', 4.5), graded('os', 4.5), graded('l2', 4.5), graded('l3', 4.5),
            graded('general', 2.5, 'Histoire') // fails double compensation
        ];
        const res = checkVaudPromotion(subjects, 'sem1', ctx({ baseYear: 3, currentYear: 3.5 }));
        expect(res.isPromoted).toBe(false);
    });
});

// --- required-grade simulator ---------------------------------------------

describe('calculateRequiredGrade', () => {
    it('locked subjects return null', () => {
        expect(calculateRequiredGrade(subject({ mode: 'locked' }), 'sem1', 1, 'TS')).toBeNull();
    });

    it('standard mode solves for the remaining test', () => {
        // target 4.5 → reqRaw 4.25 ; grades [4.0, 4.0] → (4.25×3 − 8) / 1 = 4.75
        const s = subject({ mode: 'standard', target: 4.5, sem1: [ts(4.0), ts(4.0)] });
        expect(calculateRequiredGrade(s, 'sem1', 1, 'TS')).toBeCloseTo(4.75, 5);
    });

    it('dual mode, TS remaining: TA average folds in as one virtual grade', () => {
        // TAs [4.0] → rounded 4.0 ; TS [5.0] → combined [5.0, 4.0]
        // target 4.0 → reqRaw 3.75 → (3.75×3 − 9) / 1 = 2.25
        const s = subject({ target: 4.0, sem1: [ta(4.0), ts(5.0)] });
        expect(calculateRequiredGrade(s, 'sem1', 1, 'TS')).toBeCloseTo(2.25, 5);
    });

    it('dual mode, TA remaining: impossible targets return 999', () => {
        const s = subject({ target: 6.0, sem1: [ts(4.0)] });
        expect(calculateRequiredGrade(s, 'sem1', 1, 'TA')).toBe(999.0);
    });

    it('dual mode, TA remaining: required TA average is ceiled to the half point', () => {
        // target 4.5 → reqRaw 4.25 ; TS [4.5] → reqTaAvgRounded = 4.25×2 − 4.5 = 4.0
        // ceil → 4.0 ; ((4.0 − 0.25)×2 − 4.0) / 1 = 3.5
        const s = subject({ target: 4.5, sem1: [ts(4.5), ta(4.0)] });
        expect(calculateRequiredGrade(s, 'sem1', 1, 'TA')).toBeCloseTo(3.5, 5);
    });

    it('no grades at all: aim for the target minus rounding margin', () => {
        const s = subject({ target: 4.5 });
        expect(calculateRequiredGrade(s, 'sem1', 1, 'TA')).toBeCloseTo(4.25, 5);
    });
});

// --- status class -----------------------------------------------------------

describe('getStatusClass', () => {
    it('maps values to css classes with 4.0 as the warning line', () => {
        expect(getStatusClass(null)).toBe('empty');
        expect(getStatusClass(3.5)).toBe('failing');
        expect(getStatusClass(4.0)).toBe('warning');
        expect(getStatusClass(4.5)).toBe('passing');
    });
});

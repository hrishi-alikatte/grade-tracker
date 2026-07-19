// --- Swiss Vaud Gymnase Calculations (pure module) ---
// Single source of truth for all grade math. No DOM, no global state:
// everything the rules need is passed in explicitly, so the same code runs
// in the app and in the Vitest suite (tests/calculator.test.js).
//
// The `ctx` object carries the app-state the rules depend on:
//   {
//     baseYear:        1 | 2 | 3            (repeat years map to their base year)
//     currentYear:     1 | 1.5 | 2 | 2.5 | 3 | 3.5
//     subjectsYear2:    Subject[]           (first-attempt Year 2 list)
//     subjectsYear2Rep: Subject[] | undefined (repeat Year 2 list)
//     repeatingYear2:  boolean
//   }

export function roundToHalfPoint(value) {
    if (value === null || value === undefined || isNaN(value)) {
        return 0;
    }
    return Math.round(value * 2) / 2;
}

/**
 * Combined Physique+Chimie carry-over for Year 3 (locked subject).
 * Note: intentionally reads the first-attempt Year 2 list, matching the
 * historical behavior of the app.
 */
export function calculateLockedYear2PhysChem(ctx) {
    if (!ctx.subjectsYear2) return null;
    const phys = ctx.subjectsYear2.find(s => s.name.toLowerCase().includes('physique'));
    const chim = ctx.subjectsYear2.find(s => s.name.toLowerCase().includes('chimie'));

    const physData = phys ? calculateSubjectData(phys, 'annual', ctx) : null;
    const chimData = chim ? calculateSubjectData(chim, 'annual', ctx) : null;

    const avgPhys = physData && physData.rawAverage !== null ? physData.roundedAverage : null;
    const avgChim = chimData && chimData.rawAverage !== null ? chimData.roundedAverage : null;

    if (avgPhys !== null && avgChim !== null) {
        return roundToHalfPoint((avgPhys + avgChim) / 2);
    } else if (avgPhys !== null) {
        return avgPhys;
    } else if (avgChim !== null) {
        return avgChim;
    }
    return null;
}

/** Annual rounded average of a Year 2 subject found by name (repeat-aware). */
export function getYear2SubjectAverage(nameSub, ctx) {
    const list = ctx.repeatingYear2 ? ctx.subjectsYear2Rep : ctx.subjectsYear2;
    if (!list) return null;
    const sub = list.find(s => s.name.toLowerCase().includes(nameSub));
    if (!sub) return null;
    const data = calculateSubjectData(sub, 'annual', ctx);
    return data.rawAverage !== null ? data.roundedAverage : null;
}

/** Annual rounded average of the Year 2 art subject (repeat-aware). */
export function getYear2ArtAverage(ctx) {
    const list = ctx.repeatingYear2 ? ctx.subjectsYear2Rep : ctx.subjectsYear2;
    if (!list) return null;
    const sub = list.find(s => s.role === 'art');
    if (!sub) return null;
    const data = calculateSubjectData(sub, 'annual', ctx);
    return data.rawAverage !== null ? data.roundedAverage : null;
}

/**
 * Maturity exam configuration for a Year 3 subject.
 * french/math/os/l2/l3 have written + oral, oc has oral only,
 * every other subject has no maturity exam.
 */
export function getSubjectExamConfig(subject, ctx) {
    const isY3 = subject.id.startsWith('y3_') || (subject.id.startsWith('sub_') && (ctx.currentYear === 3 || ctx.currentYear === 3.5));
    if (!isY3) return null;

    const role = subject.role;
    if (['french', 'math', 'os', 'l2', 'l3'].includes(role)) {
        return { written: true, oral: true };
    } else if (role === 'oc') {
        return { written: false, oral: true };
    }
    return null;
}

/** Raw exam grade for a subject: mean of written+oral, or whichever exists. */
function getExamGradeRaw(subject, examConfig) {
    const exams = subject.exams || { written: null, oral: null };
    const wVal = exams.written !== null && exams.written !== undefined && !isNaN(exams.written) ? exams.written : null;
    const oVal = exams.oral !== null && exams.oral !== undefined && !isNaN(exams.oral) ? exams.oral : null;

    if (examConfig.written) {
        if (wVal !== null && oVal !== null) return (wVal + oVal) / 2;
        if (wVal !== null) return wVal;
        if (oVal !== null) return oVal;
    } else if (oVal !== null) {
        return oVal;
    }
    return null;
}

/**
 * Calculates subject averages supporting both semesters and annual combinations.
 * `semester` is 'sem1' | 'sem2' | 'annual' and must be passed explicitly.
 */
export function calculateSubjectData(subject, semester, ctx) {
    if (subject.role === 'physique_y2') {
        const val = getYear2SubjectAverage('physique', ctx);
        return { rawAverage: val, roundedAverage: val, taAverage: null, tsAverage: null };
    }
    if (subject.role === 'chimie_y2') {
        const val = getYear2SubjectAverage('chimie', ctx);
        return { rawAverage: val, roundedAverage: val, taAverage: null, tsAverage: null };
    }
    if (subject.role === 'art_y2') {
        const val = getYear2ArtAverage(ctx);
        return { rawAverage: val, roundedAverage: val, taAverage: null, tsAverage: null };
    }
    if (subject.role === 'phys_chimie_y2') {
        const val = calculateLockedYear2PhysChem(ctx);
        if (val === null) {
            return { rawAverage: null, roundedAverage: null, taAverage: null, tsAverage: null };
        }
        return { rawAverage: val, roundedAverage: val, taAverage: null, tsAverage: null };
    }

    if (semester === 'annual') {
        const data1 = calculateSubjectDataForSem(subject, 'sem1');
        const data2 = calculateSubjectDataForSem(subject, 'sem2');

        const grades1 = (subject.grades && subject.grades.sem1) ? subject.grades.sem1 : [];
        const grades2 = (subject.grades && subject.grades.sem2) ? subject.grades.sem2 : [];

        const mode = subject.evaluationMode || 'dual';
        let rawAverage = null;

        if (mode === 'standard') {
            const allGrades = [...grades1, ...grades2];
            if (allGrades.length > 0) {
                const sum = allGrades.reduce((s, g) => s + g.value, 0);
                rawAverage = sum / allGrades.length;
            }
        } else {
            // Dual mode: pool TS grades + rounded TA average for sem1 + rounded TA average for sem2
            const tas1 = grades1.filter(g => g.type === 'TA');
            const tss1 = grades1.filter(g => g.type === 'TS');
            const tas2 = grades2.filter(g => g.type === 'TA');
            const tss2 = grades2.filter(g => g.type === 'TS');

            let ta1AvgRounded = null;
            if (tas1.length > 0) {
                const ta1Sum = tas1.reduce((sum, g) => sum + g.value, 0);
                ta1AvgRounded = roundToHalfPoint(ta1Sum / tas1.length);
            }

            let ta2AvgRounded = null;
            if (tas2.length > 0) {
                const ta2Sum = tas2.reduce((sum, g) => sum + g.value, 0);
                ta2AvgRounded = roundToHalfPoint(ta2Sum / tas2.length);
            }

            const combinedTS = [
                ...tss1.map(g => g.value),
                ...tss2.map(g => g.value)
            ];
            if (ta1AvgRounded !== null) {
                combinedTS.push(ta1AvgRounded);
            }
            if (ta2AvgRounded !== null) {
                combinedTS.push(ta2AvgRounded);
            }

            if (combinedTS.length > 0) {
                rawAverage = combinedTS.reduce((sum, val) => sum + val, 0) / combinedTS.length;
            }
        }

        if (rawAverage === null) {
            // No semester grades: the maturity exam alone can still produce a grade.
            const examConfig = getSubjectExamConfig(subject, ctx);
            const examGradeRaw = examConfig ? getExamGradeRaw(subject, examConfig) : null;
            if (examGradeRaw !== null) {
                const roundedEx = roundToHalfPoint(examGradeRaw);
                return {
                    rawAverage: examGradeRaw,
                    roundedAverage: roundedEx,
                    annualRawAverage: null,
                    annualRoundedAverage: null,
                    examGrade: examGradeRaw,
                    taAverage: null,
                    tsAverage: null,
                    sem1Data: data1,
                    sem2Data: data2
                };
            }
            return { rawAverage: null, roundedAverage: null, taAverage: null, tsAverage: null };
        }

        const roundedAverage = roundToHalfPoint(rawAverage);

        // Factor in Maturity Exams: final = mean(rounded annual, raw exam), re-rounded
        let examGradeRaw = null;
        let finalGradeRounded = roundedAverage;
        let finalGradeRaw = rawAverage;
        const examConfig = getSubjectExamConfig(subject, ctx);
        if (examConfig) {
            examGradeRaw = getExamGradeRaw(subject, examConfig);
            if (examGradeRaw !== null) {
                finalGradeRaw = (roundedAverage + examGradeRaw) / 2;
                finalGradeRounded = roundToHalfPoint(finalGradeRaw);
            }
        }

        return {
            rawAverage: finalGradeRaw,
            roundedAverage: finalGradeRounded,
            annualRawAverage: rawAverage,
            annualRoundedAverage: roundedAverage,
            examGrade: examGradeRaw,
            taAverage: null,
            tsAverage: null,
            sem1Data: data1,
            sem2Data: data2
        };
    } else {
        return calculateSubjectDataForSem(subject, semester);
    }
}

/**
 * Single-semester average.
 * 'standard' mode: plain mean of all grades.
 * 'dual' mode (TA/TS): the TA grades are averaged, rounded to 0.5, and that
 * rounded value counts as one extra virtual TS grade in the final mean.
 */
export function calculateSubjectDataForSem(subject, sem) {
    const grades = (subject.grades && subject.grades[sem]) ? subject.grades[sem] : [];

    if (grades.length === 0) {
        return { rawAverage: null, roundedAverage: null, taAverage: null, tsAverage: null };
    }

    const mode = subject.evaluationMode || 'dual';

    if (mode === 'standard') {
        const sum = grades.reduce((s, g) => s + g.value, 0);
        const rawAverage = sum / grades.length;
        const roundedAverage = roundToHalfPoint(rawAverage);
        return { rawAverage, roundedAverage, taAverage: null, tsAverage: null };
    }

    const tas = grades.filter(g => g.type === 'TA');
    const tss = grades.filter(g => g.type === 'TS');

    let taAverage = null;
    let taAvgRounded = null;
    if (tas.length > 0) {
        const taSum = tas.reduce((sum, g) => sum + g.value, 0);
        taAverage = taSum / tas.length;
        taAvgRounded = roundToHalfPoint(taAverage);
    }

    let tsAverage = null;
    if (tss.length > 0) {
        const tsSum = tss.reduce((sum, g) => sum + g.value, 0);
        tsAverage = tsSum / tss.length;
    }

    // Combine TS grades with virtual TA average
    const combinedTS = tss.map(g => g.value);
    if (taAvgRounded !== null) {
        combinedTS.push(taAvgRounded);
    }

    if (combinedTS.length === 0) {
        return { rawAverage: null, roundedAverage: null, taAverage, tsAverage };
    }

    const rawAverage = combinedTS.reduce((sum, val) => sum + val, 0) / combinedTS.length;
    const roundedAverage = roundToHalfPoint(rawAverage);

    return { rawAverage, roundedAverage, taAverage, tsAverage };
}

/**
 * "What grade do I need?" simulator.
 * Returns the average grade required on the remaining evaluations to reach
 * the subject target, 999.0 when impossible, or null for locked subjects.
 */
export function calculateRequiredGrade(subject, sem, numTests, typeRemaining) {
    const grades = (subject.grades && subject.grades[sem]) ? subject.grades[sem] : [];
    const target = subject.target;
    const mode = subject.evaluationMode || 'dual';

    if (mode === 'locked') return null;

    const reqRaw = target - 0.25;

    if (mode === 'standard') {
        const S_curr = grades.reduce((s, g) => s + g.value, 0);
        const C_curr = grades.length;
        const reqGrade = (reqRaw * (C_curr + numTests) - S_curr) / numTests;
        return reqGrade;
    }

    // Dual mode
    const tas = grades.filter(g => g.type === 'TA');
    const tss = grades.filter(g => g.type === 'TS');

    if (typeRemaining === 'TS') {
        let taAvgRounded = null;
        if (tas.length > 0) {
            const taSum = tas.reduce((s, g) => s + g.value, 0);
            taAvgRounded = roundToHalfPoint(taSum / tas.length);
        }

        const combined = tss.map(g => g.value);
        if (taAvgRounded !== null) combined.push(taAvgRounded);

        const S_curr = combined.reduce((s, val) => s + val, 0);
        const C_curr = combined.length;

        const reqGrade = (reqRaw * (C_curr + numTests) - S_curr) / numTests;
        return reqGrade;
    } else {
        // Remaining is TA
        const N_ts = tss.length;
        const S_ts = tss.reduce((s, g) => s + g.value, 0);
        const K_ta = tas.length;
        const S_ta = tas.reduce((s, g) => s + g.value, 0);

        if (N_ts === 0 && K_ta === 0) {
            return target - 0.25;
        }

        const reqTaAvgRounded = reqRaw * (N_ts + 1) - S_ts;
        if (reqTaAvgRounded > 6.0) {
            return 999.0; // Impossible
        }

        const reqTaAvgMin = Math.ceil(reqTaAvgRounded * 2) / 2;
        const reqGrade = ((reqTaAvgMin - 0.25) * (K_ta + numTests) - S_ta) / numTests;
        return reqGrade;
    }
}

/**
 * Computes Vaud Swiss Gymnase promotion status based on rounded subject averages.
 *
 * Years 1 & 2: promoted when core-group sum ≥ 16, total ≥ n×4.0 and
 * at most 4 insufficient subjects.
 * Year 3 adds: overall average ≥ 4.0, missing points ≤ 3.0 and the double
 * compensation rule (surplus points ≥ 2 × missing points).
 */
export function checkVaudPromotion(subjects, semester, ctx) {
    const sem = semester;
    let activeSubjectsCount = 0;
    let roundedAveragesSum = 0;
    let insuffisances = 0;
    let pointsManquants = 0; // Deficits
    let pointsEnPlus = 0;    // Surplus

    subjects.forEach(s => {
        const data = calculateSubjectData(s, sem, ctx);
        if (data.rawAverage !== null) {
            activeSubjectsCount++;
            const avgRounded = data.roundedAverage;
            roundedAveragesSum += avgRounded;

            if (avgRounded < 4.0) {
                insuffisances++;
                pointsManquants += (4.0 - avgRounded);
            } else if (avgRounded > 4.0) {
                pointsEnPlus += (avgRounded - 4.0);
            }
        }
    });

    // Compute G1 (core group) points sum: French + Math + OS + mean(L2, L3)
    const french = subjects.find(s => s.role === 'french');
    const math = subjects.find(s => s.role === 'math');
    const os = subjects.find(s => s.role === 'os');
    const l2 = subjects.find(s => s.role === 'l2');
    const l3 = subjects.find(s => s.role === 'l3');

    const mathData = math ? calculateSubjectData(math, sem, ctx) : null;
    const mathRound = mathData && mathData.rawAverage !== null ? mathData.roundedAverage : null;

    const frData = french ? calculateSubjectData(french, sem, ctx) : null;
    const frRound = frData && frData.rawAverage !== null ? frData.roundedAverage : null;

    const osObj = os ? calculateSubjectData(os, sem, ctx) : null;
    const osRound = osObj && osObj.rawAverage !== null ? osObj.roundedAverage : null;

    const l2Data = l2 ? calculateSubjectData(l2, sem, ctx) : null;
    const l3Data = l3 ? calculateSubjectData(l3, sem, ctx) : null;
    let l2l3AvgRounded = null;
    if (l2Data && l2Data.rawAverage !== null && l3Data && l3Data.rawAverage !== null) {
        l2l3AvgRounded = roundToHalfPoint((l2Data.roundedAverage + l3Data.roundedAverage) / 2);
    } else if (l2Data && l2Data.rawAverage !== null) {
        l2l3AvgRounded = l2Data.roundedAverage;
    } else if (l3Data && l3Data.rawAverage !== null) {
        l2l3AvgRounded = l3Data.roundedAverage;
    }

    let g1Sum = 0;
    g1Sum += mathRound !== null ? mathRound : 0;
    g1Sum += frRound !== null ? frRound : 0;
    g1Sum += osRound !== null ? osRound : 0;
    g1Sum += l2l3AvgRounded !== null ? l2l3AvgRounded : 0;

    // Under 3M grading system, there is no group or anything, all subjects are in 1 single group.
    // Therefore, coreSumPassed is always true.
    const coreSumPassed = true;

    // Calculate average of all entered exam grades (written + oral)
    let examSum = 0;
    let examCount = 0;
    subjects.forEach(s => {
        const config = getSubjectExamConfig(s, ctx);
        if (config) {
            const exams = s.exams || { written: null, oral: null };
            if (config.written && exams.written !== null && exams.written !== undefined && !isNaN(exams.written)) {
                examSum += exams.written;
                examCount++;
            }
            if (config.oral && exams.oral !== null && exams.oral !== undefined && !isNaN(exams.oral)) {
                examSum += exams.oral;
                examCount++;
            }
        }
    });
    const examAverage = examCount > 0 ? examSum / examCount : null;
    const examAveragePassed = examAverage === null || examAverage >= 3.5;

    const overallAverage = activeSubjectsCount > 0 ? (roundedAveragesSum / activeSubjectsCount) : null;
    const requiredCompensation = (ctx.baseYear === 3) ? (2 * pointsManquants) : 0;
    
    // Points de bilan = total sum of rounded grades - sum of deficits
    const pointsBilan = roundedAveragesSum - pointsManquants;
    const pointsBilanMin = activeSubjectsCount * 4.0;

    let isPromoted = false;
    if (ctx.baseYear === 1 || ctx.baseYear === 2) {
        isPromoted = activeSubjectsCount > 0 &&
                     roundedAveragesSum >= activeSubjectsCount * 4.0 &&
                     insuffisances <= 4;
    } else {
        isPromoted = activeSubjectsCount > 0 &&
                     overallAverage >= 4.0 &&
                     roundedAveragesSum >= activeSubjectsCount * 4.0 &&
                     insuffisances <= 4 &&
                     pointsEnPlus >= requiredCompensation &&
                     pointsManquants <= 3.0 &&
                     examAveragePassed;
    }

    return {
        overallAverage: overallAverage !== null ? Math.round(overallAverage * 100) / 100 : null,
        activeSubjectsCount,
        insuffisances,
        pointsManquants: Math.round(pointsManquants * 100) / 100,
        pointsEnPlus: Math.round(pointsEnPlus * 100) / 100,
        requiredCompensation,
        isPromoted,
        g1Sum,
        coreSumPassed,
        g2Sum: roundedAveragesSum,
        g2Min: activeSubjectsCount * 4.0,
        examAverage: examAverage !== null ? Math.round(examAverage * 100) / 100 : null,
        examAveragePassed,
        pointsBilan: Math.round(pointsBilan * 100) / 100,
        pointsBilanMin
    };
}

/** Maps a grade/average to its status CSS class (yellow for exactly 4.0). */
export function getStatusClass(val) {
    if (val === null || val === undefined) return 'empty';
    if (val < 4.0) return 'failing';
    if (val === 4.0) return 'warning';
    return 'passing';
}

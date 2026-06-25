/**
 * Vaud Gymnase (Ecole de Maturité) Promotion Calculations
 *
 * This file contains logic and mathematical formulas for calculating grades,
 * averages, and promotion status according to the Vaudois gymnase regulations.
 *
 * Official Vaud Ecole de Maturité Rules summary:
 * 1. Grades are on a scale of 1 to 6 (6 is best, 4 is passing, under 4 is insufficient).
 * 2. Subject averages are rounded to the nearest 0.5 (half-point).
 * 3. A student is promoted if:
 *    a. Overall Average (Moyenne générale) >= 4.0.
 *    b. Core subjects sum >= 16.0 points.
 *       The core subjects group consists of: French, Mathematics, OS (Option Spécifique),
 *       and the average of L2 & L3 (Langue 2 & Langue 3) which is rounded to the nearest 0.5.
 *    c. Maximum of 4 insufficient grades (< 4.0) overall.
 *    d. Sum of deficit points (deviation from 4.0 for all grades < 4.0) <= 3.0 points.
 */

/**
 * Rounds a numeric grade to the nearest 0.5 (half-point) as per Vaud regulations.
 * Examples:
 * - 4.25 -> 4.5
 * - 4.24 -> 4.0
 * - 4.75 -> 5.0
 * - 4.74 -> 4.5
 *
 * @param {number} value The raw grade or average
 * @returns {number} The rounded grade (to nearest 0.5)
 */
function roundToHalfPoint(value) {
  if (value === null || value === undefined || isNaN(value)) {
    return 0;
  }
  return Math.round(value * 2) / 2;
}

/**
 * Calculates the average of a list of grades, optionally taking weights into account.
 *
 * @param {number[]} grades Array of numeric grades
 * @param {number[]|null} weights Array of numeric weights (same length as grades), or null for equal weights
 * @returns {number} The unrounded average (0 if no grades provided)
 */
function calculateSubjectAverage(grades, weights = null) {
  if (!Array.isArray(grades) || grades.length === 0) {
    return 0;
  }

  // Filter out invalid/empty grades
  const validGrades = [];
  const validWeights = [];

  for (let i = 0; i < grades.length; i++) {
    const grade = grades[i];
    if (grade !== null && grade !== undefined && !isNaN(grade)) {
      validGrades.push(grade);
      validWeights.push(weights && weights[i] !== undefined && weights[i] !== null ? weights[i] : 1);
    }
  }

  if (validGrades.length === 0) {
    return 0;
  }

  let weightedSum = 0;
  let totalWeight = 0;

  for (let i = 0; i < validGrades.length; i++) {
    weightedSum += validGrades[i] * validWeights[i];
    totalWeight += validWeights[i];
  }

  if (totalWeight === 0) {
    return 0;
  }

  return weightedSum / totalWeight;
}

/**
 * Calculates the core subjects sum for Vaud promotion.
 * Core subjects group = French + Mathematics + OS + roundedAverage(L2, L3).
 *
 * @param {Object} coreGrades Grades of the core subjects
 * @param {number} coreGrades.french French grade
 * @param {number} coreGrades.math Mathematics grade
 * @param {number} coreGrades.os OS (Option Spécifique) grade
 * @param {number} coreGrades.l2 L2 (Langue 2) grade
 * @param {number} coreGrades.l3 L3 (Langue 3) grade
 * @param {Object} [options] Configuration options
 * @param {boolean} [options.roundL2L3Average=true] Whether to round the L2/L3 average to the nearest 0.5 before summing
 * @returns {number} The core sum (French + Math + OS + L2/L3 avg)
 */
function calculateCoreSum(coreGrades, options = {}) {
  const { french = 0, math = 0, os = 0, l2 = 0, l3 = 0 } = coreGrades || {};
  const roundL2L3Average = options.roundL2L3Average !== false;

  const l2l3Avg = (l2 + l3) / 2;
  const l2l3Value = roundL2L3Average ? roundToHalfPoint(l2l3Avg) : l2l3Avg;

  return french + math + os + l2l3Value;
}

/**
 * Counts the number of insufficient grades (grades strictly below 4.0).
 *
 * @param {number[]} grades List of final subject grades (usually rounded)
 * @returns {number} Number of insufficient grades
 */
function countInsufficientGrades(grades) {
  if (!Array.isArray(grades)) return 0;
  return grades.filter(grade => grade !== null && grade !== undefined && grade < 4.0).length;
}

/**
 * Calculates the sum of deficits (sum of 4.0 - grade for all grades < 4.0).
 * This deviation represents how far the insufficient grades are from the passing mark.
 *
 * @param {number[]} grades List of final subject grades (usually rounded)
 * @returns {number} Total deficit points
 */
function calculateDeficitPoints(grades) {
  if (!Array.isArray(grades)) return 0;
  return grades
    .filter(grade => grade !== null && grade !== undefined && grade < 4.0)
    .reduce((sum, grade) => sum + (4.0 - grade), 0);
}

/**
 * Helper function to extract and evaluate final grades from subjects structure.
 *
 * @param {Object[]} subjects Array of subject objects
 * @returns {Object[]} Processed subjects with final grades
 */
function processSubjects(subjects, roundSubjectAverages = true) {
  return subjects.map(subject => {
    let finalGrade = 0;
    if (subject.grade !== undefined && subject.grade !== null) {
      finalGrade = subject.grade;
    } else if (Array.isArray(subject.grades)) {
      const avg = calculateSubjectAverage(subject.grades, subject.weights || null);
      finalGrade = roundSubjectAverages ? roundToHalfPoint(avg) : avg;
    }

    return {
      ...subject,
      finalGrade: finalGrade
    };
  });
}

/**
 * Checks the promotion status of a student based on all subject grades.
 *
 * @param {Object[]} subjects List of subject objects. Each subject should have:
 *   - name: {string}
 *   - role: {string} 'french' | 'math' | 'os' | 'l2' | 'l3' or undefined for general subjects
 *   - grade: {number} [optional] Pre-calculated final grade
 *   - grades: {number[]} [optional] Array of individual grades to calculate the final grade
 *   - weights: {number[]} [optional] Weights for grades
 *   - countsForPromotion: {boolean} [optional, default=true] Whether this subject counts for promotion
 *
 * @param {Object} [options] Custom threshold overrides
 * @param {number} [options.minOverallAverage=4.0] Required minimum overall average
 * @param {number} [options.minCoreSum=16.0] Required minimum sum for core subjects
 * @param {number} [options.maxInsufficientGrades=4] Maximum allowed insufficient grades (< 4.0)
 * @param {number} [options.maxDeficitPoints=3.0] Maximum allowed deficit points sum
 * @param {boolean} [options.roundL2L3Average=true] Whether to round L2/L3 average to nearest 0.5
 * @param {boolean} [options.roundSubjectAverages=true] Whether to round calculated averages of individual subjects
 *
 * @returns {Object} Diagnostic promotion status result
 */
function checkPromotionStatus(subjects, options = {}) {
  const config = {
    minOverallAverage: 4.0,
    minCoreSum: 16.0,
    maxInsufficientGrades: 4,
    maxDeficitPoints: 3.0,
    roundL2L3Average: true,
    roundSubjectAverages: true,
    ...options
  };

  if (!Array.isArray(subjects) || subjects.length === 0) {
    return {
      isPromoted: false,
      error: "No subjects provided"
    };
  }

  // 1. Process and compute final grades for all subjects
  const processed = processSubjects(subjects, config.roundSubjectAverages);

  // 2. Filter subjects that count for promotion
  const promotionSubjects = processed.filter(s => s.countsForPromotion !== false);

  if (promotionSubjects.length === 0) {
    return {
      isPromoted: false,
      error: "No subjects count for promotion"
    };
  }

  // 3. Extract core subjects
  const frenchObj = promotionSubjects.find(s => s.role === 'french' || s.id === 'french' || /français|francais/i.test(s.name));
  const mathObj = promotionSubjects.find(s => s.role === 'math' || s.id === 'math' || /math/i.test(s.name));
  const osObj = promotionSubjects.find(s => s.role === 'os' || s.id === 'os' || /option spécifique|opt\s+spé|os/i.test(s.name));
  const l2Obj = promotionSubjects.find(s => s.role === 'l2' || s.id === 'l2' || /allemand|l2/i.test(s.name));
  const l3Obj = promotionSubjects.find(s => s.role === 'l3' || s.id === 'l3' || /anglais|italien|l3/i.test(s.name));

  const frenchGrade = frenchObj ? frenchObj.finalGrade : 0;
  const mathGrade = mathObj ? mathObj.finalGrade : 0;
  const osGrade = osObj ? osObj.finalGrade : 0;
  const l2Grade = l2Obj ? l2Obj.finalGrade : 0;
  const l3Grade = l3Obj ? l3Obj.finalGrade : 0;

  // 4. Calculate Core Sum
  const coreSum = calculateCoreSum({
    french: frenchGrade,
    math: mathGrade,
    os: osGrade,
    l2: l2Grade,
    l3: l3Grade
  }, {
    roundL2L3Average: config.roundL2L3Average
  });

  // 5. Calculate Overall Average
  const allFinalGrades = promotionSubjects.map(s => s.finalGrade);
  const totalSum = allFinalGrades.reduce((sum, g) => sum + g, 0);
  const overallAverage = totalSum / promotionSubjects.length;

  // 6. Count Insufficient Grades
  const insufficientCount = countInsufficientGrades(allFinalGrades);

  // 7. Calculate Deficit Points
  const deficitPoints = calculateDeficitPoints(allFinalGrades);

  // 8. Check Conditions
  const overallAveragePassed = overallAverage >= config.minOverallAverage;
  const coreSumPassed = coreSum >= config.minCoreSum;
  const insufficientCountPassed = insufficientCount <= config.maxInsufficientGrades;
  const deficitPointsPassed = deficitPoints <= config.maxDeficitPoints;

  const failures = [];
  if (!overallAveragePassed) failures.push("OVERALL_AVERAGE_UNDER_4.0");
  if (!coreSumPassed) failures.push("CORE_SUM_UNDER_16.0");
  if (!insufficientCountPassed) failures.push("TOO_MANY_INSUFFICIENT_GRADES");
  if (!deficitPointsPassed) failures.push("DEFICIT_POINTS_EXCEEDED");

  const isPromoted = failures.length === 0;

  // 9. Check if eligible for complementary exam ("Épreuve Complémentaire")
  // In Vaud, a student with exactly 5 insufficient grades (1 too many) but who meets all other
  // conditions (e.g. coreSum >= 16, overall average >= 4.0, and deficit sum <= 3.0 or 4.0 depending on rules)
  // might be eligible for a complementary exam. Let's flag this clearly.
  let isEligibleForComplementaryExam = false;
  if (!isPromoted && failures.length === 1 && failures[0] === "TOO_MANY_INSUFFICIENT_GRADES" && insufficientCount === 5) {
    isEligibleForComplementaryExam = true;
  }

  return {
    isPromoted,
    isEligibleForComplementaryExam,
    overallAverage: Number(overallAverage.toFixed(3)),
    coreSum,
    insufficientCount,
    deficitPoints,
    failures,
    processedSubjects: processed,
    details: {
      overallAverage: {
        value: Number(overallAverage.toFixed(3)),
        passed: overallAveragePassed,
        threshold: config.minOverallAverage
      },
      coreSum: {
        value: coreSum,
        passed: coreSumPassed,
        threshold: config.minCoreSum
      },
      insufficientCount: {
        value: insufficientCount,
        passed: insufficientCountPassed,
        threshold: config.maxInsufficientGrades
      },
      deficitPoints: {
        value: deficitPoints,
        passed: deficitPointsPassed,
        threshold: config.maxDeficitPoints
      }
    }
  };
}

// Export for Node.js or browser use
if (typeof module !== 'undefined' && module.exports) {
  module.exports = {
    roundToHalfPoint,
    calculateSubjectAverage,
    calculateCoreSum,
    countInsufficientGrades,
    calculateDeficitPoints,
    processSubjects,
    checkPromotionStatus
  };
}

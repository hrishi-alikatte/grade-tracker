const {
  roundToHalfPoint,
  calculateSubjectAverage,
  calculateCoreSum,
  countInsufficientGrades,
  calculateDeficitPoints,
  checkPromotionStatus
} = require('./calculator_logic.js');

function assert(condition, message) {
  if (!condition) {
    throw new Error(`Assertion failed: ${message}`);
  }
}

function runTests() {
  console.log("=== Running Vaud Gymnase Calculator Logic Tests ===\n");

  // 1. Test roundToHalfPoint
  console.log("Testing roundToHalfPoint...");
  assert(roundToHalfPoint(4.25) === 4.5, "4.25 should round to 4.5");
  assert(roundToHalfPoint(4.24) === 4.0, "4.24 should round to 4.0");
  assert(roundToHalfPoint(4.75) === 5.0, "4.75 should round to 5.0");
  assert(roundToHalfPoint(4.74) === 4.5, "4.74 should round to 4.5");
  assert(roundToHalfPoint(4.0) === 4.0, "4.0 should round to 4.0");
  assert(roundToHalfPoint(3.25) === 3.5, "3.25 should round to 3.5");
  assert(roundToHalfPoint(3.24) === 3.0, "3.24 should round to 3.0");
  console.log("✓ roundToHalfPoint tests passed.");

  // 2. Test calculateSubjectAverage
  console.log("\nTesting calculateSubjectAverage...");
  const grades = [4.5, 5, 3.5, 4.25];
  const weights = [1, 2, 1, 1]; // sum = 5
  // Weighted sum = 4.5*1 + 5*2 + 3.5*1 + 4.25*1 = 4.5 + 10 + 3.5 + 4.25 = 22.25
  // Weighted average = 22.25 / 5 = 4.45
  const rawAvg = calculateSubjectAverage(grades, weights);
  assert(Math.abs(rawAvg - 4.45) < 0.001, `Expected 4.45, got ${rawAvg}`);
  assert(roundToHalfPoint(rawAvg) === 4.5, "4.45 rounded to half point should be 4.5");
  console.log("✓ calculateSubjectAverage tests passed.");

  // 3. Test calculateCoreSum
  console.log("\nTesting calculateCoreSum...");
  // french: 4.5, math: 4.0, os: 5.0, l2: 4.5, l3: 3.5 -> L2/L3 average = 4.0
  const coreGrades = { french: 4.5, math: 4.0, os: 5.0, l2: 4.5, l3: 3.5 };
  const sum1 = calculateCoreSum(coreGrades);
  assert(sum1 === 17.5, `Expected 17.5, got ${sum1}`);

  // Test L2/L3 average rounding: l2 = 4.0, l3 = 4.5 -> avg = 4.25 -> rounded = 4.5
  const coreGrades2 = { french: 4.0, math: 3.5, os: 4.0, l2: 4.0, l3: 4.5 };
  const sum2 = calculateCoreSum(coreGrades2);
  assert(sum2 === 16.0, `Expected 16.0, got ${sum2}`); // 4.0 + 3.5 + 4.0 + 4.5 = 16.0
  console.log("✓ calculateCoreSum tests passed.");

  // 4. Test countInsufficientGrades and calculateDeficitPoints
  console.log("\nTesting countInsufficientGrades and calculateDeficitPoints...");
  const studentGrades = [4.5, 3.5, 5.0, 3.0, 4.0, 2.5];
  // Insufficient: 3.5, 3.0, 2.5 (3 grades)
  // Deficits: (4 - 3.5) + (4 - 3.0) + (4 - 2.5) = 0.5 + 1.0 + 1.5 = 3.0
  assert(countInsufficientGrades(studentGrades) === 3, "Should count 3 insufficient grades");
  assert(calculateDeficitPoints(studentGrades) === 3.0, `Expected 3.0 deficit points, got ${calculateDeficitPoints(studentGrades)}`);
  console.log("✓ countInsufficientGrades and calculateDeficitPoints tests passed.");

  // 5. Test checkPromotionStatus (Full Student Scenarios)
  console.log("\nTesting checkPromotionStatus...");

  // Scenario A: Promoted Student
  const promotedStudent = [
    { name: "Français", role: "french", grade: 4.5 },
    { name: "Mathématiques", role: "math", grade: 4.0 },
    { name: "OS Physique", role: "os", grade: 5.0 },
    { name: "Allemand", role: "l2", grade: 4.5 },
    { name: "Anglais", role: "l3", grade: 3.5 }, // L2/L3 avg = 4.0 -> Core sum = 4.5 + 4.0 + 5.0 + 4.0 = 17.5 >= 16.0
    { name: "Histoire", grade: 4.5 },
    { name: "Géographie", grade: 4.0 },
    { name: "Physique", grade: 4.0 },
    { name: "Chimie", grade: 4.0 },
    { name: "Biologie", grade: 4.0 },
    { name: "Arts Visuels", grade: 5.0 },
    { name: "Sport", grade: 4.5, countsForPromotion: false } // doesn't count for promotion in this gym test config
  ];
  // 11 subjects count for promotion. Sum of grades = 4.5 + 4.0 + 5.0 + 4.5 + 3.5 + 4.5 + 4.0 + 4.0 + 4.0 + 4.0 + 5.0 = 47.0
  // Average = 47.0 / 11 = 4.27
  // Insufficient count = 1 (Anglais = 3.5)
  // Deficit points = 0.5
  const resA = checkPromotionStatus(promotedStudent);
  assert(resA.isPromoted === true, "Student should be promoted");
  assert(resA.overallAverage === 4.273, `Expected 4.273 avg, got ${resA.overallAverage}`);
  assert(resA.coreSum === 17.5, `Expected 17.5 core sum, got ${resA.coreSum}`);
  assert(resA.insufficientCount === 1, "Expected 1 insufficient grade");
  assert(resA.deficitPoints === 0.5, "Expected 0.5 deficit points");
  assert(resA.failures.length === 0, "Expected no failures list");

  // Scenario B: Fails due to Overall Average under 4.0
  const weakStudent = [
    { name: "Français", role: "french", grade: 4.0 },
    { name: "Mathématiques", role: "math", grade: 4.0 },
    { name: "OS Physique", role: "os", grade: 4.0 },
    { name: "Allemand", role: "l2", grade: 4.0 },
    { name: "Anglais", role: "l3", grade: 4.0 }, // Core sum = 16.0
    { name: "Histoire", grade: 3.5 },
    { name: "Géographie", grade: 3.5 },
    { name: "Physique", grade: 3.5 },
    { name: "Chimie", grade: 3.5 } // 4 insufficient grades, average is under 4.0
  ];
  const resB = checkPromotionStatus(weakStudent);
  assert(resB.isPromoted === false, "Student should NOT be promoted");
  assert(resB.failures.includes("OVERALL_AVERAGE_UNDER_4.0"), "Should fail overall average check");
  assert(resB.failures.length === 1, "Should only fail overall average check");

  // Scenario C: Fails due to Core Sum < 16.0
  const smartButSkewedStudent = [
    { name: "Français", role: "french", grade: 3.5 },
    { name: "Mathématiques", role: "math", grade: 3.0 },
    { name: "OS Physique", role: "os", grade: 4.5 },
    { name: "Allemand", role: "l2", grade: 4.0 },
    { name: "Anglais", role: "l3", grade: 3.5 }, // L2/L3 avg = 3.75 -> rounded = 4.0 -> Core sum = 3.5 + 3.0 + 4.5 + 4.0 = 15.0 < 16.0
    { name: "Histoire", grade: 5.5 },
    { name: "Géographie", grade: 6.0 },
    { name: "Arts", grade: 5.5 }
  ];
  const resC = checkPromotionStatus(smartButSkewedStudent);
  assert(resC.isPromoted === false, "Student should NOT be promoted");
  assert(resC.failures.includes("CORE_SUM_UNDER_16.0"), "Should fail core sum check");

  // Scenario D: Fails due to too many insufficient grades (> 4)
  const manyFailsStudent = [
    { name: "Français", role: "french", grade: 4.5 },
    { name: "Mathématiques", role: "math", grade: 4.5 },
    { name: "OS Physique", role: "os", grade: 4.5 },
    { name: "Allemand", role: "l2", grade: 4.5 },
    { name: "Anglais", role: "l3", grade: 4.5 },
    { name: "Histoire", grade: 3.5 },
    { name: "Géographie", grade: 3.5 },
    { name: "Physique", grade: 3.5 },
    { name: "Chimie", grade: 3.5 },
    { name: "Biologie", grade: 3.5 } // 5 insufficient grades
  ];
  const resD = checkPromotionStatus(manyFailsStudent);
  assert(resD.isPromoted === false, "Student should NOT be promoted");
  assert(resD.failures.includes("TOO_MANY_INSUFFICIENT_GRADES"), "Should fail due to number of insufficient grades");
  assert(resD.isEligibleForComplementaryExam === true, "Should be eligible for complementary exam with exactly 5 insufficient grades");

  // Scenario E: Fails due to deficit points exceeding 3.0
  const highDeficitStudent = [
    { name: "Français", role: "french", grade: 4.5 },
    { name: "Mathématiques", role: "math", grade: 4.5 },
    { name: "OS Physique", role: "os", grade: 4.5 },
    { name: "Allemand", role: "l2", grade: 4.5 },
    { name: "Anglais", role: "l3", grade: 4.5 },
    { name: "Histoire", grade: 2.0 }, // deficit = 2.0
    { name: "Géographie", grade: 2.5 } // deficit = 1.5. Total deficit = 3.5 > 3.0
  ];
  const resE = checkPromotionStatus(highDeficitStudent);
  assert(resE.isPromoted === false, "Student should NOT be promoted");
  assert(resE.failures.includes("DEFICIT_POINTS_EXCEEDED"), "Should fail due to deficit points sum");

  console.log("✓ checkPromotionStatus tests passed.");
  console.log("\nAll tests completed successfully!");
}

try {
  runTests();
} catch (e) {
  console.error("Test execution failed:", e.message);
  process.exit(1);
}

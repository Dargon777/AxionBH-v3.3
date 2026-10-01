const assert = require("node:assert/strict");
const A = require("../simulator-core.js");

function finiteOrInfinity(value) {
  return Number.isFinite(value) || value === Infinity;
}

{
  const p = A.normalizeParams({});
  assert.equal(p.massSolar, A.DEFAULTS.massSolar);
  assert.ok(p.spin > 0 && p.spin < 1);
}

{
  const g = A.kerrGeometry(A.DEFAULTS.massSolar * A.CONSTANTS.MSUN, 0.89);
  assert.ok(g.rPlus > g.rg);
  assert.ok(g.rErgEquator > g.rPlus);
  assert.ok(g.omegaH > 0);
}

{
  const low = A.cme({ ...A.DEFAULTS, spin: 0.2 });
  assert.equal(low.thresholdPassed, false);
  assert.equal(low.aBar, 0);
  assert.equal(low.kappa, 0);
  assert.equal(low.luminosity, 0);
}

{
  const baseline = A.cme(A.DEFAULTS);
  assert.equal(baseline.mode, "cme");
  assert.ok(Number.isFinite(baseline.aBar));
  assert.ok(Number.isFinite(baseline.kappa));
  assert.ok(Number.isFinite(baseline.luminosity));
  assert.ok(Number.isFinite(baseline.avgB));
  assert.ok(baseline.avgB > 0);
}

{
  const p = A.normalizeParams({ nProfile: 1 });
  const g = A.kerrGeometry(p.massSolar * A.CONSTANTS.MSUN, p.spin);
  const avg = A.averageMagneticField(p.B0, g, 1);
  assert.ok(Number.isFinite(avg));
  assert.ok(avg > 0);
}

{
  const p = {
    ...A.DEFAULTS,
    burstEnergy: 1e50,
    burstEfficiency: 1e-2,
    burstIntervalYears: 10,
    burstDuration: 100
  };
  const b = A.manualBosenova(p);
  const expectedEnergy = 1e48;
  const expectedAverage = expectedEnergy / (10 * A.CONSTANTS.YEAR);
  assert.ok(Math.abs(b.convertedEnergy / expectedEnergy - 1) < 1e-12);
  assert.ok(Math.abs(b.averageLuminosity / expectedAverage - 1) < 1e-12);
  assert.ok(Math.abs(b.burstLuminosity / 1e46 - 1) < 1e-12);
}

{
  const sr = A.superradiant(A.DEFAULTS);
  assert.equal(sr.mode, "superradiant");
  assert.ok(Number.isFinite(sr.alpha));
  assert.ok(Number.isFinite(sr.gamma));
  assert.ok(finiteOrInfinity(sr.saturationTime));
}

{
  const hybrid = A.hybrid(A.DEFAULTS);
  assert.equal(hybrid.mode, "hybrid");
  assert.ok(Number.isFinite(hybrid.alpha));
  assert.ok(Number.isFinite(hybrid.averageLuminosity));
}

{
  const sweep = A.spinSweep(A.DEFAULTS, 24);
  assert.equal(sweep.length, 25);
  assert.ok(sweep.every((point) =>
    Number.isFinite(point.spin) &&
    Number.isFinite(point.kappa) &&
    Number.isFinite(point.ratio511)
  ));
  assert.equal(sweep[0].kappa, 0);
}

{
  assert.throws(() => A.normalizeParams({ spin: 1.1 }), /spin/);
  assert.throws(() => A.normalizeParams({ temperature: -1 }), /temperature/);
}

console.log("AxionBH simulator-core tests passed");


{
  const grid = A.parameterMap(A.DEFAULTS, {
    mode: "cme",
    xValues: [0.2, 0.5, 0.9],
    yValues: [10, 1000],
    metric: "ratio511"
  });
  assert.equal(grid.xValues.length, 3);
  assert.equal(grid.yValues.length, 2);
  assert.equal(grid.z.length, 2);
  assert.equal(grid.z[0].length, 3);
  assert.equal(grid.z[0][0], 0);
  assert.ok(grid.z.flat().every((value) => value === null || Number.isFinite(value)));
}

{
  const sensitivity = A.sensitivityAnalysis("cme", A.DEFAULTS, {
    fraction: 0.1,
    keys: ["spin", "B0", "mdot"]
  });
  assert.equal(sensitivity.rows.length, 3);
  assert.ok(sensitivity.rows.every((row) => Number.isFinite(row.impact)));
  assert.ok(sensitivity.rows.every((row) => row.minusParam < row.plusParam));
}

{
  const comparison = A.comparePresets("cme");
  assert.deepEqual(
    comparison.map((item) => item.name),
    ["baseline", "breakthrough", "optimistic"]
  );
  assert.ok(comparison.every((item) => Number.isFinite(item.metric)));
}

{
  assert.deepEqual(
    A.linearSpace(0, 1, 3),
    [0, 0.5, 1]
  );
  const log = A.logSpace(1, 100, 3);
  assert.ok(Math.abs(log[0] - 1) < 1e-12);
  assert.ok(Math.abs(log[1] - 10) < 1e-10);
  assert.ok(Math.abs(log[2] - 100) < 1e-9);
}

{
  assert.throws(
    () => A.sensitivityAnalysis("cme", A.DEFAULTS, { fraction: 1 }),
    /fraction/
  );
  assert.throws(
    () => A.parameterMap(A.DEFAULTS, { xValues: [1], yValues: [1, 2] }),
    /xValues/
  );
}


{
  assert.equal(A.relativeDifferencePercent(120, 100), 20);
  assert.equal(A.relativeDifferencePercent(80, 100), -20);
  assert.equal(A.relativeDifferencePercent(1, 0), null);
}

{
  const comparison = A.compareParameterMaps(
    A.DEFAULTS,
    A.PRESETS.breakthrough,
    {
      xValues: [0.2, 0.6, 0.9],
      yValues: [10, 1000],
      metric: "ratio511"
    }
  );

  assert.equal(comparison.mapA.z.length, 2);
  assert.equal(comparison.mapB.z.length, 2);
  assert.equal(comparison.differencePercent.length, 2);
  assert.equal(comparison.differencePercent[0].length, 3);
  assert.ok(
    comparison.differencePercent.flat().every(
      (value) => value === null || Number.isFinite(value)
    )
  );
}

{
  const slices = A.parameterSlices(A.DEFAULTS, {
    sliceValues: [1e15, 1e16],
    xValues: [0.4, 0.8],
    yValues: [100, 1000]
  });

  assert.equal(slices.sliceKey, "faGev");
  assert.equal(slices.slices.length, 2);
  assert.equal(slices.slices[0].sliceValue, 1e15);
  assert.equal(slices.slices[1].map.z.length, 2);
  assert.equal(slices.slices[1].map.z[0].length, 2);
}


{
  const result = A.cme(A.DEFAULTS);
  const diagnostics = A.diagnoseRun("cme", A.DEFAULTS, result);
  assert.equal(diagnostics.mode, "cme");
  assert.ok(Array.isArray(diagnostics.checks));
  assert.ok(!diagnostics.checks.some((item) => item.level === "error"));
  assert.ok(diagnostics.checks.some((item) => item.code === "cloud_root"));
}

{
  const p = {
    ...A.DEFAULTS,
    spin: 0.9,
    B0: 10,
    mEff: 1,
    faGev: 1e16
  };
  const result = A.cme(p);
  assert.ok(result.aBar > 0);
  const diagnostics = A.diagnoseRun("cme", p, result);
  const residual = diagnostics.checks.find((item) => item.code === "root_residual");
  assert.ok(residual);
  assert.ok(Number.isFinite(residual.value));
  assert.ok(residual.value <= 1e-8);
}

{
  const p = { ...A.DEFAULTS, spin: 0.2 };
  const diagnostics = A.diagnoseRun("cme", p, A.cme(p));
  assert.ok(diagnostics.checks.some((item) => item.code === "spin_threshold"));
}

{
  const p = {
    ...A.DEFAULTS,
    burstDuration: 2 * A.CONSTANTS.YEAR,
    burstIntervalYears: 1
  };
  const diagnostics = A.diagnoseRun("bosenova", p, A.manualBosenova(p));
  assert.equal(diagnostics.status, "warning");
  assert.ok(diagnostics.checks.some((item) => item.code === "overlapping_bursts"));
}

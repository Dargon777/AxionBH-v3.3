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
  assert.equal(sr.level, "211");
  assert.equal(sr.superradiantCondition, false);
  assert.equal(sr.active, false);
  assert.equal(sr.gamma, 0);
  assert.ok(sr.criticalSpin > A.DEFAULTS.spin);
}

{
  const active = A.superradiant({
    ...A.DEFAULTS,
    axionMassEv: 8.5e-18,
    superradianceSeedOccupation: 1
  });
  assert.equal(active.superradiantCondition, true);
  assert.equal(active.active, true);
  assert.ok(active.gamma > 0);
  assert.ok(active.growthBracket > 0);
  assert.ok(active.criticalSpin < A.DEFAULTS.spin);
  assert.ok(active.saturationFraction > 0);
  assert.ok(active.saturationFraction < 0.1);
  assert.ok(active.saturationOccupation > 1e70);
  assert.ok(active.eFoldCount > 100);
  assert.ok(Number.isFinite(active.saturationTime));
  assert.ok(active.averageExtractionPower > 0);
  assert.equal(active.conversionStatus, "phenomenological-energy-proxy");
}

{
  const active = A.scalar211Superradiance({
    ...A.DEFAULTS,
    axionMassEv: 8.5e-18
  });
  assert.equal(active.level, "211");
  assert.ok(active.omegaRDimensionless < active.horizonOmegaDimensionless);
  assert.ok(active.growthApproximation.includes("Baryakhtar"));
}

{
  const diagnostics = A.diagnoseRun(
    "superradiant",
    A.DEFAULTS,
    A.superradiant(A.DEFAULTS)
  );
  const gate = diagnostics.checks.find(
    (item) => item.code === "superradiance_condition"
  );
  assert.ok(gate);
  assert.equal(gate.level, "warning");
}

{
  const p = A.normalizeParams({
    superradianceSeedOccupation: 10
  });
  assert.equal(p.superradianceSeedOccupation, 10);
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
  assert.ok(result.aBar > 0);
  assert.ok(result.mu5 > 0);
  assert.ok(result.eta5 > 0);
  assert.ok(result.closure.hasRealRoots);
  assert.ok(result.closure.discriminant >= 0);
  assert.ok(result.closure.stableSlope < 1);
  assert.ok(diagnostics.checks.some((item) => item.code === "root_residual"));
  assert.ok(diagnostics.checks.some((item) => item.code === "fixed_point_slope"));
  assert.ok(diagnostics.checks.some((item) => item.code === "unit_system"));
}

{
  const coefficients = A.selfConsistencyCoefficients(A.DEFAULTS);
  assert.ok(Number.isFinite(coefficients.c0) && coefficients.c0 > 0);
  assert.ok(Number.isFinite(coefficients.c2) && coefficients.c2 > 0);
  assert.ok(Number.isFinite(coefficients.discriminant));
  const branches = A.selfConsistencyBranches(A.DEFAULTS);
  assert.ok(branches.stableRoot > 0);
  assert.ok(branches.unstableRoot > branches.stableRoot);
  const residual = A.selfConsistencyResidual(branches.stableRoot, A.DEFAULTS);
  assert.ok(
    Math.abs(residual) / branches.stableRoot < 1e-10
  );
}

{
  const t = A.temperatureGeV(1e7);
  assert.ok(Math.abs(t / 8.617333262e-7 - 1) < 1e-12);
  const b = A.magneticFieldGeV2(1);
  assert.ok(Math.abs(b / 1.95e-20 - 1) < 1e-12);
  const sigma = A.chiralConductivity(0, 1e7);
  assert.ok(Math.abs(sigma / (t * t / 6) - 1) < 1e-12);
}

{
  const mu1 = A.mu5FromA(1e-20, 100, 1e7, 1e16, 1);
  const mu2 = A.mu5FromA(2e-20, 100, 1e7, 1e16, 1);
  assert.ok(mu1 > 0);
  assert.ok(Math.abs(mu2 / mu1 - 2) < 1e-12);
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


{
  const baseline = A.cme(A.DEFAULTS);
  const deficit = A.deficitOrders(baseline.ratio511, 1);
  assert.ok(Number.isFinite(deficit));
  assert.ok(deficit > 298 && deficit < 300);
}

{
  const map = A.parameterDeficitMap(A.DEFAULTS, {
    xValues: [0.2, 0.5, 0.9],
    yValues: [10, 1000],
    target: 1
  });
  assert.equal(map.z.length, 2);
  assert.equal(map.z[0].length, 3);
  assert.equal(map.z[0][0], null);
  assert.ok(Number.isFinite(map.z[0][1]));
}

{
  const mdot = A.inferParameterTarget(
    "cme",
    A.DEFAULTS,
    "mdot",
    { target: 1, steps: 220 }
  );
  assert.equal(mdot.status, "unreachable");
  assert.ok(mdot.bestMetric > A.cme(A.DEFAULTS).ratio511);
  assert.ok(mdot.remainingDeficitOrders > 0);
}

{
  const field = A.inferParameterTarget(
    "cme",
    A.DEFAULTS,
    "B0",
    { target: 1, steps: 220 }
  );
  assert.equal(field.status, "unreachable");
  assert.ok(field.bestMetric > A.cme(A.DEFAULTS).ratio511);
  assert.ok(field.remainingDeficitOrders > 0);
}

{
  const inference = A.parameterInference("cme", A.DEFAULTS, {
    keys: ["B0", "mdot"],
    steps: 180
  });
  assert.equal(inference.rows.length, 2);
  assert.ok(inference.deficitOrders > 298);
  assert.ok(inference.requiredGain > 1e298);
}


{
  const baseline = A.cme(A.DEFAULTS);
  const gained = A.cmeWithGains(A.DEFAULTS);
  assert.ok(Math.abs(gained.ratio511 / baseline.ratio511 - 1) < 1e-12);
  assert.ok(gained.closureValid);
}

{
  const ceiling = A.cmeClosureCeiling(A.DEFAULTS);
  const coefficients = A.selfConsistencyCoefficients(A.DEFAULTS);
  const expectedMu = Math.sqrt(
    2 * Math.PI * Math.PI *
    coefficients.cveBaseCoefficient
  );
  assert.ok(Math.abs(ceiling.mu5Max / expectedMu - 1) < 1e-12);
  assert.ok(ceiling.mu5Max < ceiling.masslessMu5Max);
  assert.ok(ceiling.ratioMax > A.cme(A.DEFAULTS).ratio511);
  assert.ok(ceiling.ratioMax > 0);
  assert.ok(ceiling.ratioMax < 1e-120);
  assert.ok(ceiling.ceilingDeficitOrders > 120);
  assert.ok(ceiling.requiredPostGainAtCeiling > 1e120);
}

{
  const ceiling = A.cmeClosureCeiling(A.DEFAULTS);
  const gain = ceiling.criticalUpstreamProduct * (1 - 1e-10);
  const source = A.missingPhysicsPoint(A.DEFAULTS, "source", gain);
  const chiral = A.missingPhysicsPoint(A.DEFAULTS, "chiral", gain);
  assert.ok(source.closureValid);
  assert.ok(chiral.closureValid);
  assert.ok(Math.abs(source.ratio511 / ceiling.ratioMax - 1) < 1e-4);
  assert.ok(Math.abs(chiral.ratio511 / ceiling.ratioMax - 1) < 1e-4);
  assert.ok(Math.abs(source.ratio511 / chiral.ratio511 - 1) < 1e-10);
}

{
  const ceiling = A.cmeClosureCeiling(A.DEFAULTS);
  const invalid = A.missingPhysicsPoint(
    A.DEFAULTS,
    "source",
    ceiling.criticalUpstreamProduct * 1.001
  );
  assert.equal(invalid.closureValid, false);
  assert.ok(invalid.closure.discriminant < 0);
}

{
  const analysis = A.missingPhysicsAnalysis(A.DEFAULTS, 1);
  const source = analysis.rows.find((row) => row.placement === "source");
  const chiral = analysis.rows.find((row) => row.placement === "chiral");
  const conversion = analysis.rows.find(
    (row) => row.placement === "conversion"
  );
  assert.equal(source.status, "ceiling-limited");
  assert.equal(chiral.status, "ceiling-limited");
  assert.equal(conversion.status, "solved");
  assert.ok(conversion.requiredGain > 1e298);
  assert.ok(Math.abs(Math.log10(conversion.achievedMetric)) < 1e-8);
}


{
  const mu5 = 1e-6;
  const sigma = A.chiralMagneticConductivity(mu5);
  const expected = 2 * A.CONSTANTS.ALPHA_FINE * mu5 / Math.PI;
  assert.ok(Math.abs(sigma / expected - 1) < 1e-12);
}

{
  const mu5 = 2e-7;
  const B = 100;
  const current = A.chiralMagneticCurrent(mu5, B);
  const expected =
    (2 * A.CONSTANTS.ALPHA_FINE * mu5 / Math.PI) *
    A.magneticFieldGeV2(B);
  assert.ok(Math.abs(current / expected - 1) < 1e-12);
}

{
  const result = A.cme(A.DEFAULTS);
  const transport = A.anomalousTransportDiagnostics(
    A.DEFAULTS,
    result
  );
  assert.equal(transport.closureName, "axial CVE closure");
  assert.equal(transport.cmeDirection, "parallel to B");
  assert.equal(transport.cveDirection, "parallel to omega");
  assert.equal(transport.luminosityMappingDefined, false);
  assert.ok(Number.isFinite(transport.jCME));
  assert.ok(Number.isFinite(transport.jCVE));
  assert.ok(transport.jCME >= 0);
  assert.ok(transport.jCVE > 0);
  assert.ok(Number.isFinite(transport.magnitudeRatio));
  assert.ok(
    transport.jCVEThermal + transport.jCVEChemical > 0
  );
  assert.ok(
    Math.abs(
      (transport.jCVEThermal + transport.jCVEChemical) /
      transport.jCVE - 1
    ) < 1e-12
  );
}

{
  const sweep = A.anomalousTransportSweep(A.DEFAULTS, {
    xKey: "B0",
    values: [10, 100, 1000]
  });
  assert.equal(sweep.points.length, 3);
  assert.ok(sweep.points.every((point) =>
    Number.isFinite(point.jCME) &&
    Number.isFinite(point.jCVE)
  ));
}


{
  const T = A.DEFAULTS.temperature;
  const mu = 1e-6;
  const n5 = A.axialChargeDensity(mu, T);
  const recovered = A.mu5FromAxialCharge(n5, T);
  assert.ok(Math.abs(recovered / mu - 1) < 1e-10);
  assert.ok(A.axialSusceptibility(mu, T) > 0);
}

{
  const T = A.DEFAULTS.temperature;
  const mu = -2e-6;
  const n5 = A.axialChargeDensity(mu, T);
  const recovered = A.mu5FromAxialCharge(n5, T);
  assert.ok(recovered < 0);
  assert.ok(Math.abs(recovered / mu - 1) < 1e-10);
}

{
  const analysis = A.chiralityDynamics(A.DEFAULTS, {
    flipRatePerSecond: 1e-6,
    horizonSeconds: 1e6,
    electricAlignment: 0
  });
  assert.ok(Number.isFinite(analysis.finalMu5));
  assert.ok(Number.isFinite(analysis.equilibriumMu5));
  assert.ok(analysis.sourceProxyGeV4 > 0);
  assert.ok(analysis.temperatureToElectronMass < 0.01);
  assert.equal(analysis.masslessRegime, "nonrelativistic");
  assert.ok(analysis.electricAlignmentCrossover > 0);
}

{
  const plus = A.chiralityDynamics(A.DEFAULTS, {
    flipRatePerSecond: 1e-6,
    horizonSeconds: 1e6,
    electricAlignment: 1e-20
  });
  const minus = A.chiralityDynamics(A.DEFAULTS, {
    flipRatePerSecond: 1e-6,
    horizonSeconds: 1e6,
    electricAlignment: -1e-20
  });
  assert.ok(plus.netSourceGeV4 > minus.netSourceGeV4);
  assert.ok(plus.finalMu5 > minus.finalMu5);
}

{
  const series = A.chiralityDynamicsSeries(
    A.DEFAULTS,
    {
      flipRatePerSecond: 1e-6,
      horizonSeconds: 1e6,
      electricAlignment: 0
    },
    40
  );
  assert.ok(series.points.length >= 16);
  assert.equal(series.points[0].timeSeconds, 0);
  assert.ok(
    series.points.every((point) =>
      Number.isFinite(point.n5) &&
      Number.isFinite(point.mu5)
    )
  );
}

{
  const diagnostics = A.diagnoseRun(
    "cme",
    A.DEFAULTS,
    A.cme(A.DEFAULTS)
  );
  const regime = diagnostics.checks.find(
    (item) => item.code === "massless_fermion_regime"
  );
  assert.ok(regime);
  assert.equal(regime.level, "warning");
}


{
  const sigma = A.massiveAxialVorticalConductivity(
    1e12,
    0,
    1e-12
  );
  const ref = A.masslessAxialVorticalReference(
    1e12,
    0
  );
  assert.ok(Math.abs(sigma / ref - 1) < 1e-6);
}

{
  const T = 1e7;
  const plasma = A.finiteMassPlasmaDiagnostics({
    ...A.DEFAULTS,
    temperature: T,
    electronMuMeV: 0
  });
  assert.ok(plasma.massOverT > 500);
  assert.ok(
    plasma.pairSymmetricSuppression > 1e-255 &&
    plasma.pairSymmetricSuppression < 1e-253
  );
}

{
  const lowMu = A.finiteMassPlasmaDiagnostics({
    ...A.DEFAULTS,
    electronMuMeV: 0
  });
  const highMu = A.finiteMassPlasmaDiagnostics({
    ...A.DEFAULTS,
    electronMuMeV: 1
  });
  assert.ok(highMu.sigmaMassive > lowMu.sigmaMassive);
  assert.ok(highMu.suppression > lowMu.suppression);
}

{
  const result = A.cme({
    ...A.DEFAULTS,
    electronMuMeV: 0
  });
  assert.ok(result.closure.finiteMassSuppression < 1e-250);
  assert.ok(result.ratio511 > 0);
  assert.ok(result.ratio511 < 1e-298);
}

{
  const ceiling = A.cmeClosureCeiling({
    ...A.DEFAULTS,
    electronMuMeV: 0
  });
  const expected = Math.sqrt(
    2 * Math.PI * Math.PI *
    A.finiteMassPlasmaDiagnostics(A.DEFAULTS)
      .sigmaMassive
  );
  assert.ok(Math.abs(ceiling.mu5Max / expected - 1) < 1e-10);
  assert.ok(ceiling.mu5Max < ceiling.masslessMu5Max);
}


{
  const ceiling = A.cmeClosureCeiling(A.DEFAULTS);
  assert.ok(Number.isFinite(ceiling.criticalUpstreamProduct));
  assert.ok(ceiling.criticalUpstreamProduct > 1e150);
  assert.ok(ceiling.log10DiscriminantFactor < -300);
}


{
  assert.equal(
    A.electronNetDensityCm3(
      A.DEFAULTS.temperature,
      0
    ),
    0
  );
}

{
  const density = 1e7;
  const mu = A.electronChemicalPotentialFromDensity(
    A.DEFAULTS.temperature,
    density
  );
  const recovered = A.electronNetDensityCm3(
    A.DEFAULTS.temperature,
    mu
  );
  assert.ok(mu > 0);
  assert.ok(mu < A.CONSTANTS.ELECTRON_MASS_GEV);
  assert.ok(Math.abs(recovered / density - 1) < 1e-7);
}

{
  const manual = A.resolveElectronVectorChemicalPotential(
    A.DEFAULTS
  );
  assert.equal(manual.mode, "manual");
  assert.equal(manual.muGeV, 0);
  assert.equal(manual.netDensityCm3, 0);
}

{
  const p = {
    ...A.DEFAULTS,
    electronDensityMode: 1,
    electronDensityCm3: 1e7
  };
  const closure =
    A.resolveElectronVectorChemicalPotential(p);
  assert.equal(closure.mode, "density");
  assert.ok(closure.muMeV > 0);
  assert.ok(
    Math.abs(
      closure.netDensityCm3 /
      p.electronDensityCm3 - 1
    ) < 1e-7
  );

  const plasma =
    A.finiteMassPlasmaDiagnostics(p);
  assert.ok(plasma.densityClosureActive);
  assert.ok(plasma.suppression >
    A.finiteMassPlasmaDiagnostics(A.DEFAULTS)
      .suppression);
}

{
  const manual = A.cme(A.DEFAULTS);
  const density = A.cme({
    ...A.DEFAULTS,
    electronDensityMode: 1,
    electronDensityCm3: 1e7
  });
  assert.ok(density.closure.electronMuMeV > 0);
  assert.ok(
    density.closure.resolvedElectronDensityCm3 > 0
  );
  assert.ok(density.ratio511 > manual.ratio511);
}

{
  const sweep = A.electronDensityClosureSweep(
    A.DEFAULTS,
    {
      minDensityCm3: 1e4,
      maxDensityCm3: 1e10,
      points: 20
    }
  );
  assert.equal(sweep.points.length, 20);
  for (let i = 1; i < sweep.points.length; i += 1) {
    assert.ok(
      sweep.points[i].muMeV >
      sweep.points[i - 1].muMeV
    );
  }
}


{
  assert.equal(A.MODEL_VERSION, "8.9.0");
  assert.equal(A.STATE_SCHEMA_VERSION, 14);
}

{
  const flow = A.accretionElectronDensity({
    ...A.DEFAULTS,
    electronDensityMode: 2
  });
  const p = A.DEFAULTS;
  const geometry = A.kerrGeometry(
    p.massSolar * A.CONSTANTS.MSUN,
    p.spin
  );
  const r = p.accretionRadiusRg * geometry.rg;
  const H = p.scaleHeightRatio * r;
  const v = p.radialVelocityFracC * A.CONSTANTS.C;
  const rho = p.mdot / (4 * Math.PI * r * H * v);
  const expected =
    p.electronFractionYe * rho / A.CONSTANTS.MP;
  assert.ok(
    Math.abs(
      flow.netElectronDensityCm3 / expected - 1
    ) < 1e-12
  );
  assert.ok(flow.inflowTimeSeconds > 0);
}

{
  const p = {
    ...A.DEFAULTS,
    electronDensityMode: 2
  };
  const flow = A.accretionElectronDensity(p);
  const resolved =
    A.resolveElectronVectorChemicalPotential(p);
  assert.equal(resolved.mode, "accretion");
  assert.ok(resolved.muGeV > 0);
  assert.ok(
    Math.abs(
      resolved.netDensityCm3 /
      flow.netElectronDensityCm3 - 1
    ) < 1e-7
  );
}

{
  const manual = A.cme(A.DEFAULTS);
  const accretion = A.cme({
    ...A.DEFAULTS,
    electronDensityMode: 2
  });
  assert.ok(accretion.closure.accretion);
  assert.ok(
    accretion.closure.resolvedElectronDensityCm3 >
    0
  );
  assert.ok(accretion.ratio511 > manual.ratio511);
}

{
  const report = A.modelValidityReport(
    {
      ...A.DEFAULTS,
      electronDensityMode: 2
    },
    "cme"
  );
  assert.equal(report.modelVersion, "8.9.0");
  assert.equal(report.stateSchemaVersion, 14);
  assert.equal(report.layers.length, A.MODEL_LAYERS.length);
  assert.ok(report.accretion);
  assert.ok(report.layers.some(
    (layer) =>
      layer.id === "positron_luminosity" &&
      layer.category === "phenomenological"
  ));
}


{
  const rate = 7.3e-9;
  const gs = A.mdotGsFromMsunPerYear(rate);
  const roundtrip = A.mdotMsunPerYearFromGs(gs);
  assert.ok(Math.abs(roundtrip / rate - 1) < 1e-14);
}

{
  const eht = A.ACCRETION_CALIBRATIONS.eht2023;
  const faraday = A.ACCRETION_CALIBRATIONS.faraday2006;
  assert.equal(eht.minMsunPerYear, 5.2e-9);
  assert.equal(eht.maxMsunPerYear, 9.5e-9);
  assert.equal(faraday.minMsunPerYear, 2e-9);
  assert.equal(faraday.maxMsunPerYear, 2e-7);
  assert.equal(
    A.classifyAccretionRate(7e-9, eht).relation,
    "within"
  );
  assert.equal(
    A.classifyAccretionRate(1e-3, eht).relation,
    "above"
  );
}

{
  const analysis =
    A.accretionCalibrationAnalysis(A.DEFAULTS);
  assert.ok(analysis.legacyToEhtHigh > 1e5);
  assert.ok(analysis.legacyToEhtLow > analysis.legacyToEhtHigh);
  assert.equal(
    analysis.ranges.eht2023.low.parameters.electronDensityMode,
    2
  );
  assert.ok(
    analysis.ranges.eht2023.high.flow.netElectronDensityCm3 >
    analysis.ranges.eht2023.low.flow.netElectronDensityCm3
  );
  assert.ok(
    analysis.ranges.eht2023.high.ratio511 >
    analysis.ranges.eht2023.low.ratio511
  );
  assert.ok(
    analysis.legacy.ratio511 >
    analysis.ranges.eht2023.high.ratio511
  );
}


{
  const v = A.riafRadialVelocityFracC(
    10,
    1,
    0.2
  );
  assert.ok(
    Math.abs(v - 0.2 / Math.sqrt(10)) <
    1e-14
  );
}

{
  const analysis =
    A.flowGeometryCalibrationAnalysis(
      A.DEFAULTS,
      { mapResolution: 5 }
    );
  assert.equal(analysis.corners.length, 16);
  assert.ok(analysis.best);
  assert.ok(analysis.worst);
  assert.ok(
    analysis.best.deficitDex <
    analysis.worst.deficitDex
  );
  assert.ok(analysis.geometryLeverageDex > 0);
  assert.ok(analysis.densityLeverageDex > 0);
  assert.equal(analysis.map.radiusRg.length, 5);
  assert.equal(
    analysis.map.scaleHeightRatio.length,
    5
  );
  assert.equal(
    analysis.map.deficitDex.length,
    5
  );
  assert.ok(
    analysis.best.deficitDex > 0
  );
}

{
  const point = A.flowGeometryCalibrationPoint(
    A.DEFAULTS,
    {
      radiusRg: 10,
      scaleHeightRatio: 1,
      alpha: 0.2,
      electronFractionYe: 0.85,
      mdotMsunPerYear: 7e-9
    }
  );
  assert.equal(
    point.parameters.electronDensityMode,
    2
  );
  assert.ok(point.flow.netElectronDensityCm3 > 0);
  assert.ok(point.plasma.vectorMuMeV > 0);
  assert.ok(point.ratio511 > 0);
}

{
  assert.equal(A.CONSTANTS.POSITRON_RATE_OBS_511,2e43);
  const obs=A.positronObservableFromPower(
    A.CONSTANTS.PAIR_REST_ENERGY_ERG * 1e43
  );
  assert.ok(Math.abs(obs.positronRatePerSecond-1e43)/1e43<1e-12);
  assert.ok(Math.abs(obs.ratio511-0.5)<1e-12);
}
{
  const audit=A.microphysicsAudit(A.DEFAULTS);
  assert.equal(audit.observed511.unit,"e+/s");
  assert.ok(audit.dimensionalCorrectionDex>5);
  assert.ok(audit.dimensionalCorrectionDex<6.5);
  assert.ok(audit.correctedDeficitDex<audit.historicalDeficitDex);
  assert.equal(audit.axionToMu5.status,"phenomenological");
}

{const ec=A.CONSTANTS.SCHWINGER_ECRIT_V_CM;assert.equal(A.schwingerPairRateDensity(0),0);assert.ok(A.schwingerPairRateDensity(ec)>A.schwingerPairRateDensity(.1*ec));}
{const inf=A.inferSchwingerFieldForObservedRate(A.DEFAULTS);assert.ok(inf.electricFieldOverCritical>0&&inf.electricFieldOverCritical<10);const got=A.schwingerPairProduction(A.DEFAULTS,{electricFieldVcm:inf.electricFieldVcm});assert.ok(Math.abs(Math.log10(got.rawRatio511))<1e-6);}
{const a=A.pairProductionAudit(A.DEFAULTS);assert.equal(a.status,"explicit-idealized");assert.ok(a.minimumObservedPairPowerErgS>0);}


{
  const result=A.cme(A.DEFAULTS);
  const obs=A.positronObservableFromPower(
    result.luminosity
  );
  assert.equal(result.ratio511,obs.ratio511);
  assert.equal(
    result.positronBudgetRatio,
    result.ratio511
  );
  assert.ok(result.ratio511>result.legacyRatio511);
  const factor=result.ratio511/result.legacyRatio511;
  assert.ok(factor>3.2e5&&factor<3.3e5);
}

{
  const audit=A.microphysicsAudit(A.DEFAULTS);
  assert.ok(audit.axionToMu5.derivativeCe1PeakGeV>0);
  assert.ok(audit.axionToMu5.legacyToDerivativeRatio>1e12);
  assert.ok(
    Number.isFinite(
      audit.axionToMu5.requiredCeForLegacyScale
    )
  );
}

{
  const scale=A.derivativeAxialBackgroundPeak(
    {
      ...A.DEFAULTS,
      axionMassEv:2e-5,
      faGev:1e10
    },
    1e-6,
    1
  );
  const expected=
    (2e-5*1e-9)*1e-6/(2*1e10);
  assert.ok(Math.abs(scale/expected-1)<1e-14);
}

{
  const pair=A.pairProductionAudit(A.DEFAULTS);
  assert.ok(
    Math.abs(
      pair.minimumObservedPairPowerErgS /
      (
        A.CONSTANTS.POSITRON_RATE_OBS_511 *
        A.CONSTANTS.PAIR_REST_ENERGY_ERG
      ) - 1
    ) < 1e-12
  );
}

{const f=A.blackHoleRotationalField(A.DEFAULTS);assert.ok(f.electricFieldVcm>0);}
{const a=A.gapElectrodynamicsAudit(A.DEFAULTS);assert.equal(a.status,"gap-cascade-audit");assert.ok(a.fieldToRequiredRatio>0);assert.ok(a.fieldDeficitDex>0);}
{const a=A.gapParallelElectricField(A.DEFAULTS,{screeningFraction:.1}),b=A.gapParallelElectricField(A.DEFAULTS,{screeningFraction:1});assert.ok(a.parallelElectricFieldVcm<b.parallelElectricFieldVcm);}

{
  assert.equal(A.MODEL_VERSION,"8.9.0");
  assert.equal(A.CONSTANTS.POSITRON_RATE_OBS_511,2e43);
  assert.equal(A.CONSTANTS.POSITRON_RATE_GALAXY_511,5e43);
  const base=A.cme(A.DEFAULTS);
  const gain=A.cmeWithGains(A.DEFAULTS);
  assert.ok(Math.abs(gain.ratio511/base.ratio511-1)<1e-12);
  const ceiling=A.cmeClosureCeiling(A.DEFAULTS);
  assert.ok(Math.abs(ceiling.ratioMax-ceiling.positronRateMax/A.CONSTANTS.POSITRON_RATE_OBS_511)<1e-12);
  const audit=A.microphysicsAudit(A.DEFAULTS);
  assert.equal(audit.observed511.scope,"Galactic bulge");
}


{
  const gj=A.goldreichJulianDensityScale(A.DEFAULTS);
  assert.ok(gj.numberDensityCm3>0);
  assert.ok(gj.omegaFPerSecond>0);
}

{
  const full=A.gapChargeStarvationAudit(A.DEFAULTS,{
    plasmaInjectionFraction:1
  });
  const weak=A.gapChargeStarvationAudit(A.DEFAULTS,{
    plasmaInjectionFraction:1e-18
  });
  assert.equal(full.starved,false);
  assert.equal(weak.starved,true);
  assert.ok(full.supplyRatio>1);
  assert.ok(weak.supplyRatio<1);
  assert.ok(
    weak.requiredInjectionFractionForScreening>1e-18 &&
    weak.requiredInjectionFractionForScreening<1
  );
}

{
  const h1=A.gapPotentialDrop(A.DEFAULTS,{
    gapHeightRg:0.1,
    potentialModel:"vacuum-h2"
  });
  const h2=A.gapPotentialDrop(A.DEFAULTS,{
    gapHeightRg:0.2,
    potentialModel:"vacuum-h2"
  });
  assert.ok(Math.abs(h2.voltageV/h1.voltageV-4)<1e-12);

  const g1=A.gapPotentialDrop(A.DEFAULTS,{
    gapHeightRg:0.1,
    potentialModel:"near-gj-h3"
  });
  const g2=A.gapPotentialDrop(A.DEFAULTS,{
    gapHeightRg:0.2,
    potentialModel:"near-gj-h3"
  });
  assert.ok(Math.abs(g2.voltageV/g1.voltageV-8)<1e-12);
}

{
  const below=A.breitWheelerCrossSection(1e9,1);
  const above=A.breitWheelerCrossSection(1e12,1);
  assert.equal(below.aboveThreshold,false);
  assert.equal(below.crossSectionCm2,0);
  assert.equal(above.aboveThreshold,true);
  assert.ok(above.crossSectionCm2>0);
  assert.ok(above.crossSectionCm2<A.CONSTANTS.THOMSON_CROSS_SECTION_CM2);
}

{
  const potential=A.gapPotentialDrop(A.DEFAULTS,{
    gapHeightRg:1,
    chargeDeficitFraction:1
  });
  const curvature=A.curvatureRadiationAudit(A.DEFAULTS,{
    potential,
    curvatureRadiusRg:1
  });
  assert.ok(curvature.gamma>1);
  assert.ok(curvature.characteristicPhotonEnergyEv>0);
  assert.ok(curvature.photonsPerPrimary>0);
}

{
  const optical=A.gapCascadeAudit(A.DEFAULTS,{
    gapHeightRg:1,
    plasmaInjectionFraction:1e-18,
    curvatureRadiusRg:1,
    softPhotonEnergyEv:1,
    softPhotonLuminosityErgS:1e36
  });
  const xray=A.gapCascadeAudit(A.DEFAULTS,{
    gapHeightRg:1,
    plasmaInjectionFraction:1e-18,
    curvatureRadiusRg:1,
    softPhotonEnergyEv:1e3,
    softPhotonLuminosityErgS:1e36
  });
  assert.equal(optical.starvation.starved,true);
  assert.equal(optical.gammaGamma.breitWheeler.aboveThreshold,false);
  assert.equal(optical.multiplicityOneGeneration,0);
  assert.equal(xray.gammaGamma.breitWheeler.aboveThreshold,true);
  assert.ok(xray.gammaGamma.opticalDepth>0);
  assert.ok(xray.multiplicityOneGeneration>1);
  assert.equal(xray.cascadeSelfSustaining,true);
  assert.ok(
    xray.cappedPairRatePerSecond<=
    xray.energyLimitedPairRatePerSecond
  );
  assert.ok(
    xray.schwinger.cappedPairRatePerSecond<=
    xray.schwinger.energyLimitedRatePerSecond
  );
}

{
  const report=A.modelValidityReport(A.DEFAULTS,"cme");
  for(const id of [
    "gap_charge_supply",
    "gap_potential",
    "pair_cascade"
  ]){
    assert.ok(report.layers.some((layer)=>layer.id===id));
  }
}


{
  const spectrum=A.powerLawSoftPhotonSpectrum(A.DEFAULTS,{
    softPhotonMinEv:1e-3,
    softPhotonMaxEv:1e4,
    softPhotonIndex:2,
    softPhotonLuminosityErgS:1e36,
    softPhotonBins:48
  });
  assert.equal(spectrum.bins.length,48);
  assert.ok(spectrum.totalEnergyDensityErgCm3>0);
  const fraction=spectrum.bins.reduce((sum,bin)=>sum+bin.energyFraction,0);
  assert.ok(Math.abs(fraction-1)<1e-12);
  assert.ok(spectrum.totalNumberDensityCm3>0);
}

{
  const spectrum=A.powerLawSoftPhotonSpectrum(A.DEFAULTS,{
    softPhotonMinEv:1e-3,
    softPhotonMaxEv:1e4,
    softPhotonIndex:2
  });
  const low=A.inverseComptonCoolingAudit(A.DEFAULTS,{gamma:10,spectrum});
  const high=A.inverseComptonCoolingAudit(A.DEFAULTS,{gamma:1e8,spectrum});
  assert.ok(low.powerErgS>0);
  assert.ok(high.powerErgS>0);
  assert.ok(low.effectiveKleinNishinaSuppression<=1);
  assert.ok(high.effectiveKleinNishinaSuppression<low.effectiveKleinNishinaSuppression);
}

{
  const spectrum=A.powerLawSoftPhotonSpectrum(A.DEFAULTS,{
    softPhotonMinEv:1e-3,
    softPhotonMaxEv:1e4,
    softPhotonIndex:2,
    softPhotonLuminosityErgS:1e36
  });
  const below=A.spectralGammaGammaAudit(A.DEFAULTS,{
    gammaPhotonEnergyEv:1e6,
    spectrum,
    pathLengthCm:1e12
  });
  const above=A.spectralGammaGammaAudit(A.DEFAULTS,{
    gammaPhotonEnergyEv:1e12,
    spectrum,
    pathLengthCm:1e12
  });
  assert.ok(below.opticalDepth>=0);
  assert.ok(above.opticalDepth>below.opticalDepth);
  assert.ok(above.conversionProbability>0);
}

{
  const audit=A.radiativeGapCascadeAudit(A.DEFAULTS,{
    gapHeightRg:1,
    plasmaInjectionFraction:1e-18,
    curvatureRadiusRg:1,
    softPhotonMinEv:1e-3,
    softPhotonMaxEv:1e4,
    softPhotonIndex:2,
    softPhotonLuminosityErgS:1e36
  });
  assert.equal(audit.starvation.starved,true);
  assert.ok(audit.radiationBalance.gamma>1);
  assert.ok(audit.radiationBalance.inverseCompton.powerErgS>=0);
  assert.ok(audit.curvaturePairMultiplicity>=0);
  assert.ok(audit.icPairMultiplicity>=0);
  assert.ok(audit.multiplicityOneGeneration>=audit.curvaturePairMultiplicity);
  assert.ok(audit.cappedPairRatePerSecond<=audit.energyLimitedPairRatePerSecond);
}

{
  const closure=A.solveGapClosure(A.DEFAULTS,{
    plasmaInjectionFraction:1e-18,
    curvatureRadiusRg:1,
    softPhotonMinEv:1e-3,
    softPhotonMaxEv:1e4,
    softPhotonIndex:2,
    softPhotonLuminosityErgS:1e36,
    closureScanSteps:32
  });
  assert.ok(["closure-found","closure-not-found"].includes(closure.status));
  assert.equal(closure.points.length,32);
  assert.ok(closure.multiplicityClosure);
  if(closure.closureAudit){
    assert.ok(closure.closureAudit.multiplicityOneGeneration>=1);
    assert.ok(closure.closureAudit.closureSupplyRatio>=1);
  }
}

{
  const report=A.modelValidityReport(A.DEFAULTS,"cme");
  for(const id of ["soft_photon_spectrum","inverse_compton","gap_closure"]){
    assert.ok(report.layers.some((layer)=>layer.id===id));
  }
}


{
  const ref=A.bulge511Reference();
  assert.equal(ref.scope,"Galactic bulge");
  assert.ok(Math.abs(ref.lineFluxPhCm2S/0.96e-3-1)<1e-12);
  assert.ok(ref.linePhotonRatePerSecond>8e42);
  assert.ok(ref.linePhotonRatePerSecond<8.6e42);
  assert.ok(Math.abs(A.CONSTANTS.LINE_PHOTON_RATE_OBS_511/ref.linePhotonRatePerSecond-1)<1e-12);
}

{
  const direct=A.positroniumLineYield(0);
  const allPs=A.positroniumLineYield(1);
  const typical=A.positroniumLineYield(0.95);
  assert.equal(direct.linePhotonsPerAnnihilation,2);
  assert.equal(allPs.linePhotonsPerAnnihilation,0.5);
  assert.ok(Math.abs(typical.linePhotonsPerAnnihilation-0.575)<1e-12);
  assert.ok(Math.abs(typical.continuumPhotonsPerAnnihilation-2.1375)<1e-12);
}

{
  const near=A.gaussianTransportRetentionFraction(1000,100);
  const broad=A.gaussianTransportRetentionFraction(1000,500);
  assert.ok(near>broad);
  assert.ok(near<=1&&near>0);
  assert.ok(broad<1&&broad>0);
}

{
  const source=A.positronProductionSourceAudit("cme",A.DEFAULTS,{
    sourceKind:"mode-proxy"
  });
  assert.equal(source.sourceKind,"mode-proxy");
  assert.ok(source.positronProductionRatePerSecond>=0);
}

{
  const pipe=A.positronTransportPipeline(A.DEFAULTS,{
    mode:"cme",
    sourceKind:"mode-proxy",
    transportModel:"legacy-factors",
    sourceEscapeFraction:0.5,
    smearingScalePc:150,
    bulgeAcceptanceRadiusPc:1000,
    thermalizationSurvivalFraction:0.8,
    annihilationFraction:0.9,
    positroniumFraction:0.95,
    injectionEnergyMeV:1
  });
  assert.ok(pipe.productionRatePerSecond>=pipe.annihilationRatePerSecond);
  assert.ok(pipe.spatialRetentionFraction>0&&pipe.spatialRetentionFraction<=1);
  assert.ok(pipe.linePhotonRatePerSecond>=0);
  assert.ok(pipe.lineFluxAtEarthPhCm2S>=0);
  assert.equal(pipe.injectionEnergyCompatibleWithSmearingScenario,true);
  assert.equal(pipe.smearingWithinOneSigma,true);
}

{
  const highE=A.positronTransportPipeline(A.DEFAULTS,{
    mode:"cme",
    sourceKind:"mode-proxy",
    transportModel:"legacy-factors",
    injectionEnergyMeV:2,
    smearingScalePc:250
  });
  assert.equal(highE.injectionEnergyCompatibleWithSmearingScenario,false);
  assert.ok(highE.smearingOffsetSigma>=2);
}

{
  const unresolved=A.positronProductionSourceAudit("cme",A.DEFAULTS,{
    sourceKind:"gap-cascade",
    gapOptions:{
      plasmaInjectionFraction:1e-18,
      softPhotonMinEv:1e-3,
      softPhotonMaxEv:1e4,
      softPhotonIndex:2,
      softPhotonLuminosityErgS:1e36,
      curvatureRadiusRg:1,
      closureScanSteps:32
    }
  });
  if(unresolved.status==="unresolved-gap-closure"){
    assert.equal(unresolved.positronProductionRatePerSecond,0);
  }else{
    assert.ok(unresolved.positronProductionRatePerSecond>0);
  }
}

{
  const sweep=A.positronTransportSweep(A.DEFAULTS,{
    mode:"cme",
    sourceKind:"mode-proxy",
    transportModel:"legacy-factors",
    smearingValuesPc:[50,150,500]
  });
  assert.equal(sweep.points.length,3);
  assert.ok(sweep.points[0].spatialRetentionFraction>=sweep.points[2].spatialRetentionFraction);
}

{
  const report=A.modelValidityReport(A.DEFAULTS,"cme");
  for(const id of ["positron_transport","annihilation_observable"]){
    assert.ok(report.layers.some((layer)=>layer.id===id));
  }
}


{
  const phase=A.resolveIsmPhase("warm-neutral");
  assert.equal(phase.id,"warm-neutral");
  assert.ok(phase.hydrogenDensityCm3>0);
  assert.ok(phase.electronDensityCm3>0);
  assert.ok(phase.electronDensityCm3<phase.hydrogenDensityCm3);
}

{
  const beta=A.positronBetaFromKineticEnergy(1);
  assert.ok(beta.gamma>1);
  assert.ok(beta.beta>0&&beta.beta<1);
  const sigma=A.inFlightAnnihilationCrossSectionCm2(1);
  assert.ok(sigma>0);
}

{
  const t=A.jeanCollisionalSlowingTimeSeconds(1,1);
  const path=A.positronBetaFromKineticEnergy(1).beta*A.CONSTANTS.C*t/A.CONSTANTS.PC_TO_CM;
  assert.ok(t/A.CONSTANTS.YEAR>9.9e4&&t/A.CONSTANTS.YEAR<1.01e5);
  assert.ok(path>2.8e4&&path<3.2e4);
}

{
  const d=A.positronDiffusionCoefficientCm2S(1,{D10GeVCm2S:1e28,delta:0.5});
  assert.ok(Math.abs(d/1e26-1)<1e-12);
}

{
  const a=A.ismPositronTransportAudit({
    ismPhase:"warm-neutral",
    propagationMode:"diffusion-advection",
    injectionEnergyMeV:1,
    bulgeAcceptanceRadiusPc:1000,
    D10GeVCm2S:1e28,
    diffusionDelta:0.5
  });
  assert.equal(a.status,"ism-timescale-proxy");
  assert.ok(a.slowingTimeYears>3e5&&a.slowingTimeYears<3.5e5);
  assert.ok(a.pathLengthPc>8e4);
  assert.ok(a.diffusionSigmaPc>0);
  assert.ok(a.effectiveSmearingPc>0);
  assert.ok(a.inFlightSurvivalFraction>0&&a.inFlightSurvivalFraction<=1);
  assert.ok(a.postThermalAnnihilationFraction>=0&&a.postThermalAnnihilationFraction<=1);
}

{
  const diff=A.ismPositronTransportAudit({
    ismPhase:"warm-neutral",
    propagationMode:"diffusion-advection",
    injectionEnergyMeV:1
  });
  const ballistic=A.ismPositronTransportAudit({
    ismPhase:"warm-neutral",
    propagationMode:"collisional-ballistic",
    injectionEnergyMeV:1,
    fieldLineDisplacementFraction:0.01
  });
  assert.notEqual(diff.effectiveSmearingPc,ballistic.effectiveSmearingPc);
  assert.ok(ballistic.effectiveSmearingPc>diff.effectiveSmearingPc);
}

{
  const pipeline=A.positronTransportPipeline(A.DEFAULTS,{
    mode:"cme",
    sourceKind:"mode-proxy",
    transportModel:"ism-timescale",
    ismPhase:"warm-neutral",
    propagationMode:"diffusion-advection",
    sourceEscapeFraction:1,
    bulgeAcceptanceRadiusPc:1000,
    injectionEnergyMeV:1,
    D10GeVCm2S:1e28,
    diffusionDelta:0.5,
    positroniumFraction:0.95
  });
  assert.equal(pipeline.transportModel,"ism-timescale");
  assert.ok(pipeline.ismTransport);
  assert.equal(pipeline.smearingScalePc,pipeline.ismTransport.effectiveSmearingPc);
  assert.equal(pipeline.thermalizationSurvivalFraction,pipeline.ismTransport.inFlightSurvivalFraction);
  assert.equal(pipeline.annihilationFraction,pipeline.ismTransport.postThermalAnnihilationFraction);
}

{
  const legacy=A.positronTransportPipeline(A.DEFAULTS,{
    mode:"cme",
    sourceKind:"mode-proxy",
    transportModel:"legacy-factors",
    smearingScalePc:150,
    thermalizationSurvivalFraction:0.7,
    annihilationFraction:0.6,
    injectionEnergyMeV:1
  });
  assert.equal(legacy.transportModel,"legacy-factors");
  assert.equal(legacy.ismTransport,null);
  assert.equal(legacy.smearingScalePc,150);
  assert.equal(legacy.thermalizationSurvivalFraction,0.7);
  assert.equal(legacy.annihilationFraction,0.6);
}

{
  const sweep=A.positronTransportSweep(A.DEFAULTS,{
    mode:"cme",
    sourceKind:"mode-proxy",
    transportModel:"ism-timescale",
    ismPhase:"warm-neutral",
    injectionEnergyValuesMeV:[0.1,1,3]
  });
  assert.equal(sweep.xKey,"injectionEnergyMeV");
  assert.equal(sweep.points.length,3);
  assert.ok(sweep.points.every((p)=>p.effectiveSmearingPc>0));
}

{
  const report=A.modelValidityReport(A.DEFAULTS,"cme");
  for(const id of ["ism_energy_losses","ism_propagation"]){
    assert.ok(report.layers.some((layer)=>layer.id===id));
  }
}

(function (root, factory) {
  const api = factory();
  if (typeof module === "object" && module.exports) module.exports = api;
  if (root) root.AxionBH = api;
})(typeof globalThis !== "undefined" ? globalThis : this, function () {
  "use strict";

  const CONSTANTS = Object.freeze({
    G: 6.6743015e-8,
    C: 2.99792458e10,
    MSUN: 1.988409902e33,
    KB: 1.380649e-16,
    HBAR: 1.054571817e-27,
    MU_B: 9.2740100783e-21,
    MP: 1.67262192369e-24,
    ERG_PER_GEV: 1.602e-3,
    ERG_PER_EV: 1.602176634e-12,
    YEAR: 365.25 * 86400,
    L_OBS_511: 1.07e43,
    POSITRON_ENERGY: 1.6e-6,
    SPIN_THRESHOLD: 0.35,
    B_EQ: 3e4,
    T_NORM: 1e7,
    M_A: 0.4,
    C0_TURB: 8000.0,
    TURB_GAIN: 150.0,
    P_B: 0.7,
    P_T: 0.5,
    P_M: 1.8,
    ALPHA_FINE: 1 / 137.035999084,
    ELECTRON_MASS_GEV: 5.1099895e-4,
    PROTON_MASS_GEV: 0.93827208816,
    MU_B_GEV_INV: 296.3040539,
    GAUSS_TO_GEV2: 1.95e-20,
    CM_TO_GEV_INV: 5.067730716e13,
    S_INV_TO_GEV: 6.582119569e-25,
    K_TO_GEV: 8.617333262e-14
  });

  const DEFAULTS = Object.freeze({
    massSolar: 4.28e6,
    spin: 0.89,
    B0: 93,
    betaTurb: 1.0,
    faGev: 1e16,
    mEff: 2.8e-16,
    mdot: 6.3e22,
    temperature: 1e7,
    nProfile: 1.8,
    axionMassEv: 1e-17,
    burstEnergy: 1e55,
    burstIntervalYears: 1e6,
    burstDuration: 1e6,
    burstEfficiency: 1e-17
  });

  const PRESETS = Object.freeze({
    baseline: { ...DEFAULTS },
    breakthrough: {
      ...DEFAULTS,
      B0: 2e5,
      betaTurb: 2.0
    },
    optimistic: {
      ...DEFAULTS,
      spin: 0.94,
      B0: 1e5,
      betaTurb: 1.5,
      faGev: 1e15,
      mEff: 1e-16
    }
  });

  function assertFinitePositive(value, name, allowZero = false) {
    if (!Number.isFinite(value) || (allowZero ? value < 0 : value <= 0)) {
      throw new RangeError(name + " must be " + (allowZero ? "non-negative" : "positive"));
    }
    return value;
  }

  function normalizeParams(input) {
    const p = { ...DEFAULTS, ...(input || {}) };
    [
      "massSolar", "B0", "betaTurb", "faGev", "mEff", "mdot",
      "temperature", "nProfile", "axionMassEv", "burstEnergy",
      "burstIntervalYears", "burstDuration", "burstEfficiency"
    ].forEach((key) => {
      p[key] = Number(p[key]);
      assertFinitePositive(p[key], key);
    });
    p.spin = Number(p.spin);
    if (!Number.isFinite(p.spin) || p.spin < 0 || p.spin >= 1) {
      throw new RangeError("spin must satisfy 0 <= spin < 1");
    }
    return p;
  }

  function kerrGeometry(massG, spin) {
    assertFinitePositive(massG, "massG");
    if (!Number.isFinite(spin) || spin < 0 || spin >= 1) {
      throw new RangeError("spin must satisfy 0 <= spin < 1");
    }
    const { G, C } = CONSTANTS;
    const rg = G * massG / (C * C);
    const aLength = spin * rg;
    const rPlus = rg * (1 + Math.sqrt(Math.max(0, 1 - spin * spin)));
    const rErgEquator = 2 * rg;
    const omegaH = spin === 0 ? 0 : (aLength * C) / (2 * rg * rPlus);
    return { rg, aLength, rPlus, rErgEquator, omegaH };
  }

  function turbulentFactor(B, temperature, betaTurb) {
    const c = CONSTANTS;
    const field = assertFinitePositive(B, "B");
    const temp = assertFinitePositive(temperature, "temperature");
    const beta = assertFinitePositive(betaTurb, "betaTurb");
    const enhancement =
      c.TURB_GAIN *
      beta *
      Math.pow(field / c.B_EQ, c.P_B) *
      Math.pow(temp / c.T_NORM, c.P_T) *
      Math.pow(c.M_A, c.P_M);
    return c.C0_TURB * (1 + enhancement);
  }

  function temperatureGeV(temperature) {
    return assertFinitePositive(temperature, "temperature") * CONSTANTS.K_TO_GEV;
  }

  function magneticFieldGeV2(B) {
    return assertFinitePositive(B, "B") * CONSTANTS.GAUSS_TO_GEV2;
  }

  function inverseLengthGeV(inverseCm, name = "inverseLength") {
    return assertFinitePositive(inverseCm, name) / CONSTANTS.CM_TO_GEV_INV;
  }

  function lengthGeVInv(cm, name = "length") {
    return assertFinitePositive(cm, name) * CONSTANTS.CM_TO_GEV_INV;
  }

  function angularFrequencyGeV(perSecond) {
    return assertFinitePositive(perSecond, "angularFrequency", true) *
      CONSTANTS.S_INV_TO_GEV;
  }

  function mu5Coupling(B, temperature, faGev, betaTurb) {
    const field = magneticFieldGeV2(B);
    const fa = assertFinitePositive(faGev, "faGev");
    const ct = turbulentFactor(B, temperature, betaTurb);
    return CONSTANTS.ALPHA_FINE *
      CONSTANTS.MU_B_GEV_INV *
      field *
      ct /
      fa;
  }

  function mu5FromA(aBar, B, temperature, faGev, betaTurb) {
    if (!Number.isFinite(aBar) || aBar <= 0) return 0;
    return aBar * mu5Coupling(B, temperature, faGev, betaTurb);
  }

  function chiralDegeneracy(mu5, temperature) {
    const thermal = temperatureGeV(temperature);
    const chemical = Number(mu5);
    if (!Number.isFinite(chemical)) return Number.NaN;
    return chemical / thermal;
  }

  function chiralConductivity(mu5, temperature) {
    const thermal = temperatureGeV(temperature);
    const chemical = Number(mu5);
    if (!Number.isFinite(chemical)) return Number.POSITIVE_INFINITY;
    const result =
      (chemical * chemical) / (2 * Math.PI * Math.PI) +
      (thermal * thermal) / 6;
    return Number.isFinite(result) ? result : Number.POSITIVE_INFINITY;
  }


  function chiralMagneticConductivity(mu5) {
    const chemical = Number(mu5);
    if (!Number.isFinite(chemical)) return Number.NaN;
    return (2 * CONSTANTS.ALPHA_FINE / Math.PI) * chemical;
  }

  function chiralMagneticCurrent(mu5, B) {
    const sigmaB = chiralMagneticConductivity(mu5);
    const field = magneticFieldGeV2(B);
    const current = sigmaB * field;
    return Number.isFinite(current) ? current : Number.NaN;
  }

  function axialVorticalCurrent(mu5, temperature, omegaPerSecond) {
    const sigmaV = chiralConductivity(mu5, temperature);
    const omega = angularFrequencyGeV(omegaPerSecond);
    const current = sigmaV * omega;
    return Number.isFinite(current) ? current : Number.NaN;
  }

  function anomalousTransportDiagnostics(input, result = null) {
    const p = normalizeParams(input);
    const closureResult = result || cme(p);
    const geometry = closureResult.geometry ||
      kerrGeometry(p.massSolar * CONSTANTS.MSUN, p.spin);
    const mu5 = Number(closureResult.mu5) || 0;
    const fieldG = Number(closureResult.avgB) ||
      averageMagneticField(p.B0, geometry, p.nProfile);
    const fieldGeV2 = magneticFieldGeV2(fieldG);
    const omegaGeV = angularFrequencyGeV(geometry.omegaH);
    const thermal = temperatureGeV(p.temperature);

    const sigmaCME = chiralMagneticConductivity(mu5);
    const sigmaCVE = chiralConductivity(mu5, p.temperature);
    const jCME = sigmaCME * fieldGeV2;
    const jCVE = sigmaCVE * omegaGeV;
    const jCVEThermal = (thermal * thermal / 6) * omegaGeV;
    const jCVEChemical =
      (mu5 * mu5 / (2 * Math.PI * Math.PI)) * omegaGeV;
    const magnitudeRatio =
      Number.isFinite(jCME) && Number.isFinite(jCVE) && jCVE !== 0
        ? Math.abs(jCME / jCVE)
        : null;
    const chemicalFraction =
      Number.isFinite(jCVE) && jCVE !== 0
        ? jCVEChemical / jCVE
        : null;

    return {
      legacyModeKey: "cme",
      closureName: "axial CVE closure",
      cmeName: "magnetic CME diagnostic",
      mu5,
      fieldG,
      fieldGeV2,
      omegaPerSecond: geometry.omegaH,
      omegaGeV,
      temperatureGeV: thermal,
      sigmaCME,
      sigmaCVE,
      jCME,
      jCVE,
      jCVEThermal,
      jCVEChemical,
      magnitudeRatio,
      chemicalFraction,
      cmeCurrentType: "vector/electric",
      cmeDirection: "parallel to B",
      cveCurrentType: "axial",
      cveDirection: "parallel to omega",
      luminosityMappingDefined: false
    };
  }

  function anomalousTransportSweep(
    input,
    {
      xKey = "B0",
      values = logSpace(1, 2e5, 100)
    } = {}
  ) {
    const p = normalizeParams(input);
    if (!Array.isArray(values) || values.length < 2) {
      throw new RangeError("values must contain at least two points");
    }
    if (!["B0", "spin"].includes(xKey)) {
      throw new RangeError("transport sweep supports B0 or spin");
    }

    return {
      xKey,
      points: values.map((value) => {
        try {
          const next = { ...p, [xKey]: value };
          const result = cme(next);
          const transport = anomalousTransportDiagnostics(next, result);
          return {
            value,
            jCME: transport.jCME,
            jCVE: transport.jCVE,
            ratio: transport.magnitudeRatio,
            mu5: transport.mu5
          };
        } catch {
          return {
            value,
            jCME: null,
            jCVE: null,
            ratio: null,
            mu5: null
          };
        }
      })
    };
  }


  function axialChargeDensity(mu5, temperature) {
    const chemical = Number(mu5);
    if (!Number.isFinite(chemical)) return Number.NaN;
    const thermal = temperatureGeV(temperature);
    return (
      chemical * thermal * thermal / 3 +
      chemical * chemical * chemical / (3 * Math.PI * Math.PI)
    );
  }

  function axialSusceptibility(mu5, temperature) {
    const chemical = Number(mu5);
    if (!Number.isFinite(chemical)) return Number.NaN;
    const thermal = temperatureGeV(temperature);
    return (
      thermal * thermal / 3 +
      chemical * chemical / (Math.PI * Math.PI)
    );
  }

  function mu5FromAxialCharge(n5, temperature) {
    const density = Number(n5);
    if (!Number.isFinite(density)) return Number.NaN;
    if (density === 0) return 0;

    const sign = Math.sign(density);
    const target = Math.abs(density);
    const thermal = temperatureGeV(temperature);

    function densityPositive(mu) {
      return (
        mu * thermal * thermal / 3 +
        mu * mu * mu / (3 * Math.PI * Math.PI)
      );
    }

    const linearGuess =
      target * 3 / Math.max(thermal * thermal, 1e-300);
    const cubicGuess =
      Math.cbrt(target * 3 * Math.PI * Math.PI);
    let high = Math.max(linearGuess, cubicGuess, 1e-300);

    while (densityPositive(high) < target && high < 1e100) {
      high *= 2;
    }

    let low = 0;
    for (let i = 0; i < 100; i += 1) {
      const mid = (low + high) / 2;
      if (densityPositive(mid) < target) low = mid;
      else high = mid;
    }

    return sign * (low + high) / 2;
  }

  function anomalyCoefficient() {
    return 2 * CONSTANTS.ALPHA_FINE / Math.PI;
  }

  function chiralityFlipRateGeV(ratePerSecond) {
    const rate = Number(ratePerSecond);
    if (!Number.isFinite(rate) || rate < 0) {
      throw new RangeError("flipRatePerSecond must be non-negative");
    }
    return rate * CONSTANTS.S_INV_TO_GEV;
  }

  function chiralitySourceProxy(input, result = null) {
    const p = normalizeParams(input);
    const cveResult = result || cme(p);
    const transport = anomalousTransportDiagnostics(p, cveResult);
    const coefficients = selfConsistencyCoefficients(p);
    const divergence =
      Math.abs(transport.jCVE) /
      Math.max(coefficients.effectiveLengthGeVInv, 1e-300);

    return {
      sourceGeV4: divergence,
      transport,
      effectiveLengthGeVInv: coefficients.effectiveLengthGeVInv,
      note:
        "Diagnostic proxy |J5,CVE|/L_eff; not a derived microscopic axion chirality source."
    };
  }

  function evolveAxialDensity(n0, sourceGeV4, gammaGeV, timeGeVInv) {
    if (!Number.isFinite(n0) || !Number.isFinite(sourceGeV4)) {
      return Number.NaN;
    }
    if (!Number.isFinite(gammaGeV) || gammaGeV < 0) {
      return Number.NaN;
    }
    if (!Number.isFinite(timeGeVInv) || timeGeVInv < 0) {
      return Number.NaN;
    }

    if (gammaGeV === 0) {
      return n0 + sourceGeV4 * timeGeVInv;
    }

    const equilibrium = sourceGeV4 / gammaGeV;
    const decay = Math.exp(-gammaGeV * timeGeVInv);
    return equilibrium + (n0 - equilibrium) * decay;
  }

  function chiralityDynamics(
    input,
    {
      flipRatePerSecond = 1e-6,
      horizonSeconds = 1e6,
      electricAlignment = 0,
      sourceGain = 1,
      initialMu5 = null
    } = {}
  ) {
    const p = normalizeParams(input);
    const flipRate = Number(flipRatePerSecond);
    const horizon = Number(horizonSeconds);
    const alignment = Number(electricAlignment);
    const gain = Number(sourceGain);

    if (!Number.isFinite(flipRate) || flipRate < 0) {
      throw new RangeError("flipRatePerSecond must be non-negative");
    }
    assertFinitePositive(horizon, "horizonSeconds");
    if (!Number.isFinite(alignment)) {
      throw new RangeError("electricAlignment must be finite");
    }
    assertFinitePositive(gain, "sourceGain");

    const result = cme(p);
    const proxy = chiralitySourceProxy(p, result);
    const transport = proxy.transport;
    const thermal = transport.temperatureGeV;
    const masslessRatio = thermal / CONSTANTS.ELECTRON_MASS_GEV;
    const initialChemical =
      initialMu5 === null || initialMu5 === undefined
        ? result.mu5
        : Number(initialMu5);

    if (!Number.isFinite(initialChemical)) {
      throw new RangeError("initialMu5 must be finite");
    }

    const sourceProxyGeV4 = gain * proxy.sourceGeV4;
    const eDotBGeV4 =
      alignment *
      transport.fieldGeV2 *
      transport.fieldGeV2;
    const anomalySourceGeV4 =
      anomalyCoefficient() * eDotBGeV4;
    const netSourceGeV4 =
      sourceProxyGeV4 + anomalySourceGeV4;

    const gammaGeV = chiralityFlipRateGeV(flipRate);
    const horizonGeVInv =
      horizon / CONSTANTS.S_INV_TO_GEV;
    const n0 = axialChargeDensity(initialChemical, p.temperature);
    const nFinal = evolveAxialDensity(
      n0,
      netSourceGeV4,
      gammaGeV,
      horizonGeVInv
    );
    const muFinal = mu5FromAxialCharge(nFinal, p.temperature);
    const nEquilibrium =
      gammaGeV > 0 ? netSourceGeV4 / gammaGeV : null;
    const muEquilibrium =
      nEquilibrium === null
        ? null
        : mu5FromAxialCharge(nEquilibrium, p.temperature);

    const closureCeiling = cmeClosureCeiling(p);
    const nAtClosureCeiling =
      axialChargeDensity(closureCeiling.mu5Max, p.temperature);
    const flipRateAtClosureCeiling =
      proxy.sourceGeV4 > 0 && nAtClosureCeiling > 0
        ? (proxy.sourceGeV4 / nAtClosureCeiling) /
          CONSTANTS.S_INV_TO_GEV
        : null;

    const denominator =
      anomalyCoefficient() *
      transport.fieldGeV2 *
      transport.fieldGeV2;
    const electricAlignmentCrossover =
      denominator > 0
        ? proxy.sourceGeV4 / denominator
        : null;

    const electricAlignmentForClosureCeiling =
      denominator > 0
        ? (
            gammaGeV * nAtClosureCeiling -
            sourceProxyGeV4
          ) / denominator
        : null;

    return {
      model: "massless-free-Dirac diagnostic",
      initialMu5: initialChemical,
      initialN5: n0,
      finalMu5: muFinal,
      finalN5: nFinal,
      equilibriumMu5: muEquilibrium,
      equilibriumN5: nEquilibrium,
      eta5Final: muFinal / thermal,
      flipRatePerSecond: flipRate,
      flipRateGeV: gammaGeV,
      flipTimeSeconds:
        flipRate > 0 ? 1 / flipRate : Number.POSITIVE_INFINITY,
      horizonSeconds: horizon,
      horizonGeVInv,
      sourceGain: gain,
      sourceProxyGeV4,
      anomalySourceGeV4,
      netSourceGeV4,
      electricAlignment: alignment,
      electricAlignmentCrossover,
      electricAlignmentForClosureCeiling,
      closureMu5Ceiling: closureCeiling.mu5Max,
      n5AtClosureCeiling: nAtClosureCeiling,
      flipRateAtClosureCeiling,
      temperatureGeV: thermal,
      electronMassGeV: CONSTANTS.ELECTRON_MASS_GEV,
      temperatureToElectronMass: masslessRatio,
      masslessRegime:
        masslessRatio >= 3
          ? "relativistic"
          : masslessRatio >= 1
            ? "borderline"
            : "nonrelativistic",
      transport,
      sourceProxyNote: proxy.note
    };
  }

  function chiralityDynamicsSeries(
    input,
    options = {},
    points = 120
  ) {
    const count = Math.max(16, Math.min(300, Math.trunc(points)));
    const analysis = chiralityDynamics(input, options);
    const p = normalizeParams(input);
    const gamma = analysis.flipRateGeV;
    const n0 = analysis.initialN5;
    const source = analysis.netSourceGeV4;
    const horizon = analysis.horizonSeconds;

    const minTime = Math.max(horizon * 1e-9, 1e-12);
    const times =
      horizon > minTime
        ? [0, ...logSpace(minTime, horizon, count - 1)]
        : [0, horizon];

    return {
      ...analysis,
      points: times.map((timeSeconds) => {
        const timeGeVInv =
          timeSeconds / CONSTANTS.S_INV_TO_GEV;
        const n5 = evolveAxialDensity(
          n0,
          source,
          gamma,
          timeGeVInv
        );
        const mu5 = mu5FromAxialCharge(n5, p.temperature);
        return {
          timeSeconds,
          n5,
          mu5,
          eta5: mu5 / analysis.temperatureGeV,
          jCME: chiralMagneticCurrent(
            mu5,
            analysis.transport.fieldG
          )
        };
      })
    };
  }


  function stableFermi(y) {
    const value = Number(y);
    if (!Number.isFinite(value)) {
      return value === Number.NEGATIVE_INFINITY ? 1 : 0;
    }
    if (value > 40) return Math.exp(-value);
    if (value < -40) return 1;
    return 1 / (Math.exp(value) + 1);
  }

  function stableSoftplus(value) {
    const x = Number(value);
    if (!Number.isFinite(x)) {
      return x === Number.POSITIVE_INFINITY ? Number.POSITIVE_INFINITY : 0;
    }
    if (x > 40) return x;
    if (x < -40) return Math.exp(x);
    return Math.log1p(Math.exp(x));
  }

  function simpsonIntegral(fn, start, stop, intervals = 600) {
    if (!Number.isFinite(start) || !Number.isFinite(stop) || stop < start) {
      throw new RangeError("simpsonIntegral requires finite stop >= start");
    }
    if (stop === start) return 0;
    let n = Math.max(40, Math.min(2400, Math.trunc(intervals)));
    if (n % 2 !== 0) n += 1;
    const h = (stop - start) / n;
    let sum = fn(start) + fn(stop);
    for (let i = 1; i < n; i += 1) {
      sum += (i % 2 === 0 ? 2 : 4) * fn(start + i * h);
    }
    return sum * h / 3;
  }

  function finiteMassIntegrationLimit(massOverT, muOverT) {
    const z = Math.max(0, Number(massOverT));
    const nu = Math.abs(Number(muOverT));
    const energyMax = Math.max(z, nu) + 42;
    return Math.sqrt(
      Math.max(0, energyMax * energyMax - z * z)
    );
  }

  function finiteMassFermiKernel(
    massGeV,
    temperature,
    vectorMuGeV = 0,
    intervals = 700
  ) {
    const mass = assertFinitePositive(Number(massGeV), "carrierMassGeV", true);
    const thermal = temperatureGeV(temperature);
    const mu = Number(vectorMuGeV);
    if (!Number.isFinite(mu)) {
      throw new RangeError("vectorMuGeV must be finite");
    }

    const z = mass / thermal;
    const nu = mu / thermal;
    const xMax = finiteMassIntegrationLimit(z, nu);

    function energyBar(x) {
      return Math.sqrt(x * x + z * z);
    }

    const f2 = simpsonIntegral((x) => {
      const e = energyBar(x);
      if (e === 0) return 0;
      return (
        stableFermi(e - nu) +
        stableFermi(e + nu)
      ) / e;
    }, 0, xMax, intervals);

    const f3Dimensionless = simpsonIntegral((x) => {
      const e = energyBar(x);
      return (
        stableSoftplus(nu - e) +
        stableSoftplus(-nu - e)
      );
    }, 0, xMax, intervals);

    const electronIntegral = simpsonIntegral((x) => {
      const e = energyBar(x);
      return x * x * stableFermi(e - nu);
    }, 0, xMax, intervals);

    const positronIntegral = simpsonIntegral((x) => {
      const e = energyBar(x);
      return x * x * stableFermi(e + nu);
    }, 0, xMax, intervals);

    const susceptibilityIntegral = simpsonIntegral((x) => {
      const e = energyBar(x);
      const fm = stableFermi(e - nu);
      const fp = stableFermi(e + nu);
      return x * x * (
        fm * (1 - fm) +
        fp * (1 - fp)
      );
    }, 0, xMax, intervals);

    return {
      massGeV: mass,
      temperatureGeV: thermal,
      vectorMuGeV: mu,
      massOverT: z,
      muOverT: nu,
      integrationLimit: xMax,
      f2,
      f3Dimensionless,
      electronIntegral,
      positronIntegral,
      susceptibilityIntegral
    };
  }

  function finiteMassAxialVorticalConductivity(
    massGeV,
    temperature,
    vectorMuGeV = 0,
    intervals = 700
  ) {
    const kernel = finiteMassFermiKernel(
      massGeV,
      temperature,
      vectorMuGeV,
      intervals
    );
    const T = kernel.temperatureGeV;
    const z = kernel.massOverT;

    // Lin & Yang, Phys. Rev. D 98, 114022 (2018), eqs. (8)-(10):
    // sigma_V = [2 F3 + m^2 F2] / (2 pi^2).
    // The implementation below is the dimensionless q/T form at constant
    // vector chemical potential.
    const dimensionless =
      (
        2 * kernel.f3Dimensionless +
        z * z * kernel.f2
      ) /
      (2 * Math.PI * Math.PI);

    const sigmaV = dimensionless * T * T;
    const masslessReference =
      (
        kernel.vectorMuGeV * kernel.vectorMuGeV /
          (2 * Math.PI * Math.PI)
      ) +
      T * T / 6;
    const suppression =
      masslessReference > 0
        ? sigmaV / masslessReference
        : null;

    return {
      ...kernel,
      sigmaV,
      dimensionless,
      masslessReference,
      suppression
    };
  }

  function finiteMassVectorSusceptibility(
    massGeV,
    temperature,
    vectorMuGeV = 0,
    intervals = 700
  ) {
    const kernel = finiteMassFermiKernel(
      massGeV,
      temperature,
      vectorMuGeV,
      intervals
    );
    const T = kernel.temperatureGeV;
    // g=2 spin states; derivative of n_e - n_pos with respect to vector mu.
    const susceptibility =
      T * T *
      kernel.susceptibilityIntegral /
      (Math.PI * Math.PI);
    return {
      ...kernel,
      susceptibility,
      masslessAtZeroMu: T * T / 3,
      zeroMuSuppression:
        (T * T / 3) > 0
          ? susceptibility / (T * T / 3)
          : null
    };
  }

  function finiteMassCarrierDensities(
    massGeV,
    temperature,
    vectorMuGeV = 0,
    intervals = 700
  ) {
    const kernel = finiteMassFermiKernel(
      massGeV,
      temperature,
      vectorMuGeV,
      intervals
    );
    const T = kernel.temperatureGeV;
    const prefactor = T * T * T / (Math.PI * Math.PI);
    const electronGeV3 = prefactor * kernel.electronIntegral;
    const positronGeV3 = prefactor * kernel.positronIntegral;
    const toCm3 = Math.pow(CONSTANTS.CM_TO_GEV_INV, 3);

    return {
      ...kernel,
      electronGeV3,
      positronGeV3,
      netGeV3: electronGeV3 - positronGeV3,
      totalGeV3: electronGeV3 + positronGeV3,
      electronCm3: electronGeV3 * toCm3,
      positronCm3: positronGeV3 * toCm3,
      netCm3: (electronGeV3 - positronGeV3) * toCm3,
      totalCm3: (electronGeV3 + positronGeV3) * toCm3
    };
  }

  function finiteMassPlasmaDiagnostics(
    input,
    {
      carrierMassGeV = CONSTANTS.ELECTRON_MASS_GEV,
      vectorMuOverMass = 0,
      intervals = 700
    } = {}
  ) {
    const p = normalizeParams(input);
    const mass = assertFinitePositive(
      Number(carrierMassGeV),
      "carrierMassGeV",
      true
    );
    const ratio = Number(vectorMuOverMass);
    if (!Number.isFinite(ratio)) {
      throw new RangeError("vectorMuOverMass must be finite");
    }
    const vectorMuGeV = mass * ratio;

    const result = cme(p);
    const geometry = result.geometry;
    const omegaGeV = angularFrequencyGeV(geometry.omegaH);
    const cve = finiteMassAxialVorticalConductivity(
      mass,
      p.temperature,
      vectorMuGeV,
      intervals
    );
    const susceptibility = finiteMassVectorSusceptibility(
      mass,
      p.temperature,
      vectorMuGeV,
      intervals
    );
    const densities = finiteMassCarrierDensities(
      mass,
      p.temperature,
      vectorMuGeV,
      intervals
    );

    const finiteMassCurrent = cve.sigmaV * omegaGeV;
    const masslessCurrent = cve.masslessReference * omegaGeV;
    const coefficients = selfConsistencyCoefficients(p);
    const finiteMassSourceProxy =
      Math.abs(finiteMassCurrent) /
      Math.max(coefficients.effectiveLengthGeVInv, 1e-300);
    const masslessThermalSourceProxy =
      Math.abs(masslessCurrent) /
      Math.max(coefficients.effectiveLengthGeVInv, 1e-300);

    return {
      carrier: "Dirac fermion",
      carrierMassGeV: mass,
      vectorMuGeV,
      vectorMuOverMass: ratio,
      temperatureGeV: cve.temperatureGeV,
      massOverT: cve.massOverT,
      sigmaVFiniteGeV2: cve.sigmaV,
      sigmaVMasslessReferenceGeV2: cve.masslessReference,
      cveSuppression: cve.suppression,
      finiteMassCurrentGeV3: finiteMassCurrent,
      masslessReferenceCurrentGeV3: masslessCurrent,
      finiteMassSourceProxyGeV4: finiteMassSourceProxy,
      masslessReferenceSourceProxyGeV4: masslessThermalSourceProxy,
      vectorSusceptibilityGeV2: susceptibility.susceptibility,
      susceptibilityReferenceGeV2: susceptibility.masslessAtZeroMu,
      susceptibilityZeroMuSuppression: susceptibility.zeroMuSuppression,
      electronDensityCm3: densities.electronCm3,
      positronDensityCm3: densities.positronCm3,
      netDensityCm3: densities.netCm3,
      totalDensityCm3: densities.totalCm3,
      electronDensityGeV3: densities.electronGeV3,
      positronDensityGeV3: densities.positronGeV3,
      omegaGeV,
      baselineMu5GeV: result.mu5,
      assumptions: {
        vectorChemicalPotential: true,
        axialChemicalPotentialConserved: false,
        finiteMassCmeImplemented: false,
        acveFormula:
          "Lin & Yang PRD 98 114022 eqs 8-10, constant T and vector mu",
        densityModel:
          "ideal free Dirac gas; no charge-neutrality or accretion-flow closure"
      }
    };
  }

  function finiteMassPlasmaSweep(
    input,
    {
      carrierMassGeV = CONSTANTS.ELECTRON_MASS_GEV,
      muRatioMin = 0,
      muRatioMax = 2,
      points = 65,
      intervals = 420
    } = {}
  ) {
    const count = Math.max(16, Math.min(160, Math.trunc(points)));
    const ratios = linearSpace(muRatioMin, muRatioMax, count);
    return {
      carrierMassGeV,
      points: ratios.map((vectorMuOverMass) => {
        const d = finiteMassPlasmaDiagnostics(input, {
          carrierMassGeV,
          vectorMuOverMass,
          intervals
        });
        return {
          vectorMuOverMass,
          suppression: d.cveSuppression,
          sigmaVFiniteGeV2: d.sigmaVFiniteGeV2,
          electronDensityCm3: d.electronDensityCm3,
          positronDensityCm3: d.positronDensityCm3,
          netDensityCm3: d.netDensityCm3
        };
      })
    };
  }

  function averageMagneticField(B0, geometry, nProfile) {
    const n = assertFinitePositive(nProfile, "nProfile");
    const x = geometry.rErgEquator / geometry.rPlus;
    if (!(x > 1)) return B0;
    if (Math.abs(n - 1) < 1e-8) {
      return B0 * geometry.rPlus * Math.log(x) /
        (geometry.rErgEquator - geometry.rPlus);
    }
    const integralFactor = (Math.pow(x, 1 - n) - 1) / (1 - n);
    return B0 * geometry.rPlus * integralFactor /
      (geometry.rErgEquator - geometry.rPlus);
  }

  function selfConsistencyCoefficients(input) {
    const p = normalizeParams(input);
    const massG = p.massSolar * CONSTANTS.MSUN;
    const geometry = kerrGeometry(massG, p.spin);
    const fieldG = averageMagneticField(p.B0, geometry, p.nProfile);
    const temperature = temperatureGeV(p.temperature);
    const mass = inverseLengthGeV(p.mEff, "mEff");
    const omega = angularFrequencyGeV(geometry.omegaH);
    const effectiveLength =
      lengthGeVInv(1.2 * geometry.rErgEquator, "effectiveLength");
    const qMu = mu5Coupling(
      fieldG,
      p.temperature,
      p.faGev,
      p.betaTurb
    );

    // In natural units J5 = sigma5 * omega with
    // sigma5 = mu5^2/(2*pi^2) + T^2/6 and mu5 = qMu * a.
    // Using div J5 ~ J5/L_eff gives RHS = c0 + c2*a^2.
    const scale = omega /
      (p.faGev * mass * mass * effectiveLength + 1e-300);
    const c0 = scale * temperature * temperature / 6;
    const c2 = scale * qMu * qMu / (2 * Math.PI * Math.PI);
    const discriminant = 1 - 4 * c0 * c2;

    return {
      geometry,
      fieldG,
      temperatureGeV: temperature,
      mEffGeV: mass,
      omegaGeV: omega,
      effectiveLengthGeVInv: effectiveLength,
      qMu,
      c0,
      c2,
      discriminant
    };
  }

  function selfConsistencyRhs(aBar, input) {
    const coefficients = selfConsistencyCoefficients(input);
    const value =
      coefficients.c0 +
      coefficients.c2 * Number(aBar) * Number(aBar);
    return Number.isFinite(value) ? value : Number.POSITIVE_INFINITY;
  }

  function selfConsistencyResidual(aBar, input) {
    const rhs = selfConsistencyRhs(aBar, input);
    if (!Number.isFinite(rhs)) return Number.NEGATIVE_INFINITY;
    return Number(aBar) - rhs;
  }

  function selfConsistencyBranches(input) {
    const p = normalizeParams(input);
    const coefficients = selfConsistencyCoefficients(p);

    if (p.spin < CONSTANTS.SPIN_THRESHOLD) {
      return {
        ...coefficients,
        active: false,
        hasRealRoots: false,
        stableRoot: 0,
        unstableRoot: null,
        stableSlope: null
      };
    }

    if (!Number.isFinite(coefficients.discriminant) ||
        coefficients.discriminant < 0) {
      return {
        ...coefficients,
        active: true,
        hasRealRoots: false,
        stableRoot: 0,
        unstableRoot: null,
        stableSlope: null
      };
    }

    const sqrtD = Math.sqrt(Math.max(0, coefficients.discriminant));
    const stableRoot =
      2 * coefficients.c0 / Math.max(1 + sqrtD, 1e-300);
    const unstableRoot =
      coefficients.c2 > 0
        ? (1 + sqrtD) / (2 * coefficients.c2)
        : null;
    const stableSlope =
      2 * coefficients.c2 * stableRoot;

    return {
      ...coefficients,
      active: true,
      hasRealRoots: Number.isFinite(stableRoot) && stableRoot > 0,
      stableRoot:
        Number.isFinite(stableRoot) && stableRoot > 0 ? stableRoot : 0,
      unstableRoot:
        Number.isFinite(unstableRoot) && unstableRoot > 0
          ? unstableRoot
          : null,
      stableSlope:
        Number.isFinite(stableSlope) ? stableSlope : null
    };
  }

  function findCloud(input) {
    return selfConsistencyBranches(input).stableRoot;
  }

  function cme(input) {
    const p = normalizeParams(input);
    const closure = selfConsistencyBranches(p);
    const geometry = closure.geometry;

    if (p.spin < CONSTANTS.SPIN_THRESHOLD) {
      return {
        mode: "cme",
        aBar: 0,
        mu5: 0,
        eta5: 0,
        kappa: 0,
        luminosity: 0,
        ratio511: 0,
        avgB: closure.fieldG,
        geometry,
        closure,
        thresholdPassed: false
      };
    }

    const aBar = closure.stableRoot;
    const avgB = closure.fieldG;
    const mu5 = mu5FromA(
      aBar,
      avgB,
      p.temperature,
      p.faGev,
      p.betaTurb
    );
    const eta5 = chiralDegeneracy(mu5, p.temperature);
    const kappa = mu5 / CONSTANTS.PROTON_MASS_GEV;
    const luminosity = kappa * p.mdot * CONSTANTS.C * CONSTANTS.C;
    const safeLuminosity =
      Number.isFinite(luminosity) && luminosity > 0 ? luminosity : 0;

    return {
      mode: "cme",
      aBar,
      mu5,
      eta5,
      kappa: Number.isFinite(kappa) && kappa > 0 ? kappa : 0,
      luminosity: safeLuminosity,
      ratio511: safeLuminosity / CONSTANTS.L_OBS_511,
      avgB,
      geometry,
      closure,
      thresholdPassed: true
    };
  }

  function manualBosenova(input) {
    const p = normalizeParams(input);
    const intervalSeconds = p.burstIntervalYears * CONSTANTS.YEAR;
    const convertedEnergy = p.burstEnergy * p.burstEfficiency;
    const positronsPerBurst = convertedEnergy / CONSTANTS.POSITRON_ENERGY;
    const averageRate = positronsPerBurst / intervalSeconds;
    const averageLuminosity = convertedEnergy / intervalSeconds;
    const burstLuminosity = convertedEnergy / p.burstDuration;

    return {
      mode: "bosenova",
      convertedEnergy,
      positronsPerBurst,
      averageRate,
      averageLuminosity,
      burstLuminosity,
      ratio511: averageLuminosity / CONSTANTS.L_OBS_511,
      intervalSeconds
    };
  }

  function superradiant(input) {
    const p = normalizeParams(input);
    const c = CONSTANTS;
    const massG = p.massSolar * c.MSUN;
    const mu = p.axionMassEv * c.ERG_PER_EV / (c.HBAR * c.C);
    const alpha = c.G * massG * mu / (c.C * c.C);

    let gamma = 0;
    if (alpha >= 0.05 && p.spin >= 0.4) {
      const factor = 0.05 * Math.pow(p.spin * Math.pow(alpha, 4), 4);
      gamma = factor * mu * c.C;
      if (!Number.isFinite(gamma) || gamma < 0) gamma = 0;
    }

    const initialFraction = 1e-10;
    const saturationFraction = 0.05;
    const saturationTime = gamma > 0
      ? Math.log(saturationFraction / initialFraction) / gamma
      : Number.POSITIVE_INFINITY;

    const saturationPower = gamma > 0
      ? saturationFraction * massG * c.C * c.C * gamma
      : 0;
    const positronPower = saturationPower * p.burstEfficiency;
    const positronRate = positronPower / c.POSITRON_ENERGY;

    return {
      mode: "superradiant",
      alpha,
      gamma,
      eFoldTime: gamma > 0 ? 1 / gamma : Number.POSITIVE_INFINITY,
      saturationTime,
      saturationFraction,
      saturationPower,
      positronPower,
      positronRate,
      ratio511: positronPower / c.L_OBS_511,
      active: gamma > 0
    };
  }

  function hybrid(input) {
    const p = normalizeParams(input);
    const sr = superradiant(p);
    const c = CONSTANTS;
    const massG = p.massSolar * c.MSUN;

    if (!sr.active || !Number.isFinite(sr.saturationTime)) {
      return {
        ...sr,
        mode: "hybrid",
        burstEnergy: 0,
        convertedEnergy: 0,
        averageLuminosity: 0,
        burstLuminosity: 0,
        ratio511: 0
      };
    }

    const accumulatedCloudEnergy =
      sr.saturationFraction * massG * c.C * c.C;
    const burstEnergy = 0.1 * accumulatedCloudEnergy;
    const convertedEnergy = burstEnergy * p.burstEfficiency;
    const averageLuminosity = convertedEnergy / sr.saturationTime;
    const burstLuminosity = convertedEnergy / p.burstDuration;

    return {
      ...sr,
      mode: "hybrid",
      burstEnergy,
      convertedEnergy,
      averageLuminosity,
      burstLuminosity,
      ratio511: averageLuminosity / c.L_OBS_511
    };
  }

  function simulate(mode, input) {
    switch (mode) {
      case "cme":
        return cme(input);
      case "bosenova":
        return manualBosenova(input);
      case "superradiant":
        return superradiant(input);
      case "hybrid":
        return hybrid(input);
      default:
        throw new RangeError("Unknown simulation mode: " + mode);
    }
  }

  function spinSweep(input, steps = 70) {
    const p = normalizeParams(input);
    const count = Math.max(8, Math.min(300, Math.trunc(steps)));
    const points = [];
    for (let i = 0; i <= count; i += 1) {
      const spin = 0.05 + (0.948 * i / count);
      const result = cme({ ...p, spin });
      points.push({
        spin,
        kappa: result.kappa,
        luminosity: result.luminosity,
        ratio511: result.ratio511
      });
    }
    return points;
  }

  function linearSpace(start, stop, count) {
    const n = Math.max(2, Math.min(200, Math.trunc(count)));
    if (!Number.isFinite(start) || !Number.isFinite(stop) || stop <= start) {
      throw new RangeError("linearSpace requires finite stop > start");
    }
    return Array.from({ length: n }, (_, index) =>
      start + ((stop - start) * index) / (n - 1)
    );
  }

  function logSpace(start, stop, count) {
    if (!(start > 0) || !(stop > start)) {
      throw new RangeError("logSpace requires 0 < start < stop");
    }
    const lo = Math.log10(start);
    const hi = Math.log10(stop);
    return linearSpace(lo, hi, count).map((value) => Math.pow(10, value));
  }

  function extractMetric(result, metric = "ratio511") {
    const value = Number(result && result[metric]);
    return Number.isFinite(value) ? value : null;
  }

  function parameterMap(
    input,
    {
      mode = "cme",
      xKey = "spin",
      yKey = "B0",
      xValues = linearSpace(0.05, 0.998, 28),
      yValues = logSpace(1, 2e5, 22),
      metric = "ratio511"
    } = {}
  ) {
    const base = normalizeParams(input);
    if (!Array.isArray(xValues) || xValues.length < 2) {
      throw new RangeError("xValues must contain at least two values");
    }
    if (!Array.isArray(yValues) || yValues.length < 2) {
      throw new RangeError("yValues must contain at least two values");
    }

    const z = yValues.map((y) =>
      xValues.map((x) => {
        try {
          const result = simulate(mode, { ...base, [xKey]: x, [yKey]: y });
          return extractMetric(result, metric);
        } catch {
          return null;
        }
      })
    );

    return {
      mode,
      metric,
      xKey,
      yKey,
      xValues: [...xValues],
      yValues: [...yValues],
      z
    };
  }

  function relativeDifferencePercent(valueA, valueB) {
    const a = Number(valueA);
    const b = Number(valueB);
    if (!Number.isFinite(a) || !Number.isFinite(b) || b === 0) return null;
    const result = ((a - b) / Math.abs(b)) * 100;
    return Number.isFinite(result) ? result : null;
  }

  function compareParameterMaps(
    inputA,
    inputB,
    {
      mode = "cme",
      xKey = "spin",
      yKey = "B0",
      xValues = linearSpace(0.05, 0.998, 24),
      yValues = logSpace(1, 2e5, 18),
      metric = "ratio511"
    } = {}
  ) {
    const mapA = parameterMap(inputA, {
      mode,
      xKey,
      yKey,
      xValues,
      yValues,
      metric
    });
    const mapB = parameterMap(inputB, {
      mode,
      xKey,
      yKey,
      xValues,
      yValues,
      metric
    });

    const differencePercent = mapA.z.map((row, rowIndex) =>
      row.map((value, columnIndex) =>
        relativeDifferencePercent(
          value,
          mapB.z[rowIndex][columnIndex]
        )
      )
    );

    return {
      mode,
      metric,
      xKey,
      yKey,
      xValues: [...xValues],
      yValues: [...yValues],
      mapA,
      mapB,
      differencePercent
    };
  }

  function parameterSlices(
    input,
    {
      mode = "cme",
      sliceKey = "faGev",
      sliceValues = logSpace(1e14, 1e18, 5),
      xKey = "spin",
      yKey = "B0",
      xValues = linearSpace(0.05, 0.998, 18),
      yValues = logSpace(1, 2e5, 14),
      metric = "ratio511"
    } = {}
  ) {
    if (!Array.isArray(sliceValues) || sliceValues.length < 1) {
      throw new RangeError("sliceValues must contain at least one value");
    }

    const base = normalizeParams(input);
    return {
      mode,
      metric,
      sliceKey,
      slices: sliceValues.map((sliceValue) => ({
        sliceValue,
        map: parameterMap(
          { ...base, [sliceKey]: sliceValue },
          { mode, xKey, yKey, xValues, yValues, metric }
        )
      }))
    };
  }


  const INFERENCE_BOUNDS = Object.freeze({
    cme: Object.freeze({
      spin: Object.freeze({
        min: CONSTANTS.SPIN_THRESHOLD + 1e-6,
        max: 0.998,
        scale: "linear"
      }),
      B0: Object.freeze({ min: 1e-3, max: 1e60, scale: "log" }),
      betaTurb: Object.freeze({ min: 1e-8, max: 1e60, scale: "log" }),
      faGev: Object.freeze({ min: 1e-30, max: 1e30, scale: "log" }),
      mEff: Object.freeze({ min: 1e-60, max: 1e2, scale: "log" }),
      mdot: Object.freeze({ min: 1e5, max: 1e90, scale: "log" }),
      temperature: Object.freeze({ min: 1, max: 1e40, scale: "log" })
    })
  });

  function deficitOrders(value, target = 1) {
    const metric = Number(value);
    const goal = Number(target);
    if (!Number.isFinite(goal) || goal <= 0) {
      throw new RangeError("target must be positive");
    }
    if (!Number.isFinite(metric) || metric <= 0) {
      return Number.POSITIVE_INFINITY;
    }
    return Math.log10(goal / metric);
  }

  function parameterDeficitMap(
    input,
    {
      target = 1,
      xKey = "spin",
      yKey = "B0",
      xValues = linearSpace(0.05, 0.998, 28),
      yValues = logSpace(1, 2e5, 22)
    } = {}
  ) {
    const map = parameterMap(input, {
      mode: "cme",
      xKey,
      yKey,
      xValues,
      yValues,
      metric: "ratio511"
    });

    return {
      ...map,
      target,
      z: map.z.map((row) =>
        row.map((value) =>
          Number.isFinite(value) && value > 0
            ? deficitOrders(value, target)
            : null
        )
      )
    };
  }

  function inferenceValues(rule, steps) {
    const count = Math.max(24, Math.min(600, Math.trunc(steps)));
    return rule.scale === "linear"
      ? linearSpace(rule.min, rule.max, count)
      : logSpace(rule.min, rule.max, count);
  }

  function inferParameterTarget(
    mode,
    input,
    key,
    {
      target = 1,
      metric = "ratio511",
      steps = 280,
      bounds = null
    } = {}
  ) {
    const base = normalizeParams(input);
    const configured =
      bounds ||
      (INFERENCE_BOUNDS[mode] && INFERENCE_BOUNDS[mode][key]);

    if (!configured) {
      throw new RangeError(
        "No inference bounds configured for " + mode + ":" + key
      );
    }

    const rule = {
      min: Number(configured.min),
      max: Number(configured.max),
      scale: configured.scale === "linear" ? "linear" : "log"
    };

    if (
      !Number.isFinite(rule.min) ||
      !Number.isFinite(rule.max) ||
      rule.max <= rule.min ||
      (rule.scale === "log" && rule.min <= 0)
    ) {
      throw new RangeError("Invalid inference bounds for " + key);
    }

    const goal = Number(target);
    if (!Number.isFinite(goal) || goal <= 0) {
      throw new RangeError("target must be positive");
    }

    const currentResult = simulate(mode, base);
    const currentMetric = extractMetric(currentResult, metric);
    const currentValue = Number(base[key]);
    const values = inferenceValues(rule, steps);
    if (currentValue >= rule.min && currentValue <= rule.max) {
      values.push(currentValue);
      values.sort((a, b) => a - b);
    }

    const samples = [];
    let best = null;

    function evaluate(value) {
      try {
        const result = simulate(mode, { ...base, [key]: value });
        const measured = extractMetric(result, metric);
        if (measured === null || measured < 0) return null;
        return { value, metric: measured };
      } catch {
        return null;
      }
    }

    values.forEach((value) => {
      const sample = evaluate(value);
      if (!sample) return;
      samples.push(sample);
      if (!best || sample.metric > best.metric) best = sample;
    });

    const brackets = [];
    let previous = null;
    for (const sample of samples) {
      if (!(sample.metric > 0)) continue;
      const objective = Math.log(sample.metric / goal);
      if (!Number.isFinite(objective)) continue;
      const point = { ...sample, objective };
      if (Math.abs(objective) < 1e-12) {
        brackets.push([point, point]);
      } else if (
        previous &&
        Math.sign(previous.objective) !== Math.sign(objective)
      ) {
        brackets.push([previous, point]);
      }
      previous = point;
    }

    function coordinate(value) {
      return rule.scale === "log" ? Math.log10(value) : value;
    }

    function fromCoordinate(value) {
      return rule.scale === "log" ? Math.pow(10, value) : value;
    }

    const roots = [];
    for (const [leftPoint, rightPoint] of brackets) {
      if (leftPoint.value === rightPoint.value) {
        roots.push(leftPoint);
        continue;
      }

      let lo = coordinate(leftPoint.value);
      let hi = coordinate(rightPoint.value);
      let flo = leftPoint.objective;
      let candidate = null;

      for (let i = 0; i < 72; i += 1) {
        const midCoordinate = (lo + hi) / 2;
        const midValue = fromCoordinate(midCoordinate);
        const mid = evaluate(midValue);
        if (!mid || !(mid.metric > 0)) break;
        const fm = Math.log(mid.metric / goal);
        if (!Number.isFinite(fm)) break;
        candidate = { ...mid, objective: fm };

        if (Math.abs(fm) < 1e-10) break;
        if (Math.sign(fm) === Math.sign(flo)) {
          lo = midCoordinate;
          flo = fm;
        } else {
          hi = midCoordinate;
        }
      }

      if (candidate) roots.push(candidate);
    }

    const validRoots = roots.filter((root) =>
      Number.isFinite(root.value) &&
      root.value > 0 &&
      Number.isFinite(root.metric)
    );

    validRoots.sort((a, b) =>
      Math.abs(Math.log(a.value / currentValue)) -
      Math.abs(Math.log(b.value / currentValue))
    );

    const solution = validRoots[0] || null;
    const bestMetric = best ? best.metric : null;
    const bestValue = best ? best.value : null;
    const currentDeficit = deficitOrders(currentMetric, goal);
    const remainingDeficit =
      solution
        ? 0
        : deficitOrders(bestMetric, goal);

    return {
      mode,
      key,
      metric,
      target: goal,
      status: solution ? "solved" : "unreachable",
      currentValue,
      currentMetric,
      currentDeficitOrders: currentDeficit,
      requiredValue: solution ? solution.value : null,
      requiredFactor:
        solution && currentValue > 0
          ? solution.value / currentValue
          : null,
      achievedMetric: solution ? solution.metric : null,
      bestValue,
      bestMetric,
      bestFactor:
        bestValue !== null && currentValue > 0
          ? bestValue / currentValue
          : null,
      remainingDeficitOrders: remainingDeficit,
      bounds: { ...rule },
      samplesEvaluated: samples.length
    };
  }

  function parameterInference(
    mode,
    input,
    {
      target = 1,
      metric = "ratio511",
      keys = Object.keys(INFERENCE_BOUNDS[mode] || {}),
      steps = 280
    } = {}
  ) {
    const base = normalizeParams(input);
    const result = simulate(mode, base);
    const currentMetric = extractMetric(result, metric);
    const rows = keys.map((key) =>
      inferParameterTarget(mode, base, key, {
        target,
        metric,
        steps
      })
    );

    return {
      mode,
      metric,
      target,
      currentMetric,
      deficitOrders: deficitOrders(currentMetric, target),
      requiredGain:
        currentMetric && currentMetric > 0
          ? target / currentMetric
          : Number.POSITIVE_INFINITY,
      rows
    };
  }


  const MISSING_PHYSICS_CHANNELS = Object.freeze({
    source: Object.freeze({
      label: "closure source",
      description: "Множитель источника div J5 / геометрической closure."
    }),
    chiral: Object.freeze({
      label: "axion → μ5",
      description: "Множитель эффективной связи поля a с хиральным дисбалансом."
    }),
    conversion: Object.freeze({
      label: "post-closure e+ conversion",
      description: "Множитель финальной конверсии после вычисления μ5; не влияет на closure."
    })
  });

  function normalizeMissingPhysicsGains(input = {}) {
    const gains = {
      source: Number(input.source ?? 1),
      chiral: Number(input.chiral ?? 1),
      conversion: Number(input.conversion ?? 1)
    };
    Object.entries(gains).forEach(([key, value]) => {
      assertFinitePositive(value, "missingPhysics." + key);
    });
    return gains;
  }

  function cmeWithGains(input, gainInput = {}) {
    const p = normalizeParams(input);
    const gains = normalizeMissingPhysicsGains(gainInput);
    const base = selfConsistencyCoefficients(p);
    const geometry = base.geometry;

    if (p.spin < CONSTANTS.SPIN_THRESHOLD) {
      return {
        mode: "cme-missing-physics",
        gains,
        aBar: 0,
        mu5: 0,
        eta5: 0,
        kappa: 0,
        luminosity: 0,
        ratio511: 0,
        avgB: base.fieldG,
        geometry,
        closure: {
          ...base,
          c0: 0,
          c2: 0,
          discriminant: 1,
          stableRoot: 0,
          stableSlope: null,
          hasRealRoots: false
        },
        closureValid: false,
        thresholdPassed: false
      };
    }

    const c0 = base.c0 * gains.source;
    const c2 = base.c2 * gains.source * gains.chiral * gains.chiral;
    const discriminant = 1 - 4 * c0 * c2;

    if (
      !Number.isFinite(c0) ||
      !Number.isFinite(c2) ||
      !Number.isFinite(discriminant) ||
      discriminant < 0
    ) {
      return {
        mode: "cme-missing-physics",
        gains,
        aBar: 0,
        mu5: 0,
        eta5: 0,
        kappa: 0,
        luminosity: 0,
        ratio511: 0,
        avgB: base.fieldG,
        geometry,
        closure: {
          ...base,
          c0,
          c2,
          discriminant,
          stableRoot: 0,
          stableSlope: null,
          hasRealRoots: false
        },
        closureValid: false,
        thresholdPassed: true
      };
    }

    const sqrtD = Math.sqrt(Math.max(0, discriminant));
    const aBar = 2 * c0 / Math.max(1 + sqrtD, 1e-300);
    const stableSlope = 2 * c2 * aBar;
    const mu5 = base.qMu * gains.chiral * aBar;
    const eta5 = chiralDegeneracy(mu5, p.temperature);
    const baseKappa = mu5 / CONSTANTS.PROTON_MASS_GEV;
    const kappa = baseKappa * gains.conversion;
    const luminosity = kappa * p.mdot * CONSTANTS.C * CONSTANTS.C;
    const safeLuminosity =
      Number.isFinite(luminosity) && luminosity > 0 ? luminosity : 0;

    return {
      mode: "cme-missing-physics",
      gains,
      aBar,
      mu5,
      eta5,
      baseKappa,
      kappa: Number.isFinite(kappa) && kappa > 0 ? kappa : 0,
      luminosity: safeLuminosity,
      ratio511: safeLuminosity / CONSTANTS.L_OBS_511,
      avgB: base.fieldG,
      geometry,
      closure: {
        ...base,
        c0,
        c2,
        discriminant,
        stableRoot: aBar,
        stableSlope,
        hasRealRoots: true
      },
      closureValid: true,
      thresholdPassed: true
    };
  }

  function cmeClosureCeiling(input, target = 1) {
    const p = normalizeParams(input);
    const coefficients = selfConsistencyCoefficients(p);
    const current = cme(p);
    const thermal = coefficients.temperatureGeV;
    const discriminantFactor = 4 * coefficients.c0 * coefficients.c2;
    const criticalUpstreamProduct =
      discriminantFactor > 0 && Number.isFinite(discriminantFactor)
        ? 1 / Math.sqrt(discriminantFactor)
        : Number.POSITIVE_INFINITY;

    const mu5Max = Math.PI * thermal / Math.sqrt(3);
    const kappaMax = mu5Max / CONSTANTS.PROTON_MASS_GEV;
    const luminosityMax = kappaMax * p.mdot * CONSTANTS.C * CONSTANTS.C;
    const ratioMax = luminosityMax / CONSTANTS.L_OBS_511;
    const goal = Number(target);
    if (!Number.isFinite(goal) || goal <= 0) {
      throw new RangeError("target must be positive");
    }

    return {
      target: goal,
      currentRatio: current.ratio511,
      currentDeficitOrders: deficitOrders(current.ratio511, goal),
      thermalGeV: thermal,
      mu5Max,
      kappaMax,
      luminosityMax,
      ratioMax,
      ceilingDeficitOrders: deficitOrders(ratioMax, goal),
      upstreamHeadroom:
        current.ratio511 > 0 ? ratioMax / current.ratio511 : Number.POSITIVE_INFINITY,
      criticalUpstreamProduct,
      requiredPostGainAtCurrent:
        current.ratio511 > 0 ? goal / current.ratio511 : Number.POSITIVE_INFINITY,
      requiredPostGainAtCeiling:
        ratioMax > 0 ? goal / ratioMax : Number.POSITIVE_INFINITY
    };
  }

  function missingPhysicsPoint(input, placement, gain) {
    const value = assertFinitePositive(Number(gain), "g_extra");
    let gains;
    if (placement === "source") {
      gains = { source: value, chiral: 1, conversion: 1 };
    } else if (placement === "chiral") {
      gains = { source: 1, chiral: value, conversion: 1 };
    } else if (placement === "conversion") {
      gains = { source: 1, chiral: 1, conversion: value };
    } else {
      throw new RangeError("Unknown missing-physics placement: " + placement);
    }
    return cmeWithGains(input, gains);
  }

  function missingPhysicsSweep(
    input,
    placement,
    { minExp = 0, maxExp = 60, steps = 181 } = {}
  ) {
    if (!MISSING_PHYSICS_CHANNELS[placement]) {
      throw new RangeError("Unknown missing-physics placement: " + placement);
    }
    const count = Math.max(24, Math.min(400, Math.trunc(steps)));
    const exponents = linearSpace(minExp, maxExp, count);
    return {
      placement,
      points: exponents.map((exponent) => {
        const gain = Math.pow(10, exponent);
        const result = missingPhysicsPoint(input, placement, gain);
        return {
          exponent,
          gain,
          ratio511: result.closureValid ? result.ratio511 : null,
          discriminant: result.closure.discriminant,
          closureValid: result.closureValid
        };
      })
    };
  }

  function missingPhysicsAnalysis(input, target = 1) {
    const p = normalizeParams(input);
    const goal = Number(target);
    if (!Number.isFinite(goal) || goal <= 0) {
      throw new RangeError("target must be positive");
    }

    const ceiling = cmeClosureCeiling(p, goal);
    const nearCriticalGain =
      Number.isFinite(ceiling.criticalUpstreamProduct)
        ? ceiling.criticalUpstreamProduct * (1 - 1e-12)
        : 1;

    const sourceBoundary = missingPhysicsPoint(p, "source", nearCriticalGain);
    const chiralBoundary = missingPhysicsPoint(p, "chiral", nearCriticalGain);
    const conversionRequired = ceiling.requiredPostGainAtCurrent;
    const conversionTarget =
      Number.isFinite(conversionRequired)
        ? missingPhysicsPoint(p, "conversion", conversionRequired)
        : null;

    const upstreamStatus =
      ceiling.ratioMax >= goal ? "solved" : "ceiling-limited";

    return {
      target: goal,
      ceiling,
      rows: [
        {
          placement: "source",
          status: upstreamStatus,
          criticalGain: ceiling.criticalUpstreamProduct,
          bestMetric: sourceBoundary.ratio511,
          remainingDeficitOrders: deficitOrders(sourceBoundary.ratio511, goal)
        },
        {
          placement: "chiral",
          status: upstreamStatus,
          criticalGain: ceiling.criticalUpstreamProduct,
          bestMetric: chiralBoundary.ratio511,
          remainingDeficitOrders: deficitOrders(chiralBoundary.ratio511, goal)
        },
        {
          placement: "conversion",
          status:
            conversionTarget &&
            Math.abs(conversionTarget.ratio511 / goal - 1) < 1e-9
              ? "solved"
              : "unreachable",
          requiredGain: conversionRequired,
          achievedMetric: conversionTarget ? conversionTarget.ratio511 : null,
          remainingDeficitOrders:
            conversionTarget
              ? Math.max(0, deficitOrders(conversionTarget.ratio511, goal))
              : Number.POSITIVE_INFINITY
        }
      ]
    };
  }

  const SENSITIVITY_KEYS = Object.freeze({
    cme: Object.freeze([
      "massSolar",
      "spin",
      "B0",
      "betaTurb",
      "faGev",
      "mEff",
      "mdot",
      "temperature",
      "nProfile"
    ]),
    bosenova: Object.freeze([
      "burstEnergy",
      "burstIntervalYears",
      "burstDuration",
      "burstEfficiency"
    ]),
    superradiant: Object.freeze([
      "massSolar",
      "spin",
      "axionMassEv",
      "burstEfficiency"
    ]),
    hybrid: Object.freeze([
      "massSolar",
      "spin",
      "axionMassEv",
      "burstDuration",
      "burstEfficiency"
    ])
  });

  function perturbedValue(key, value, factor) {
    let next = value * factor;
    if (key === "spin") {
      next = Math.max(0, Math.min(0.998, next));
    }
    return next;
  }

  function sensitivityAnalysis(
    mode,
    input,
    {
      fraction = 0.1,
      metric = "ratio511",
      keys = SENSITIVITY_KEYS[mode] || []
    } = {}
  ) {
    if (!Number.isFinite(fraction) || fraction <= 0 || fraction >= 0.95) {
      throw new RangeError("fraction must satisfy 0 < fraction < 0.95");
    }

    const baseParams = normalizeParams(input);
    const baseResult = simulate(mode, baseParams);
    const baseValue = extractMetric(baseResult, metric);
    const rows = [];

    for (const key of keys) {
      const center = Number(baseParams[key]);
      if (!Number.isFinite(center) || center <= 0) continue;

      const minusParam = perturbedValue(key, center, 1 - fraction);
      const plusParam = perturbedValue(key, center, 1 + fraction);

      let minusValue = null;
      let plusValue = null;
      try {
        minusValue = extractMetric(
          simulate(mode, { ...baseParams, [key]: minusParam }),
          metric
        );
      } catch {}
      try {
        plusValue = extractMetric(
          simulate(mode, { ...baseParams, [key]: plusParam }),
          metric
        );
      } catch {}

      const minusRelative =
        baseValue && minusValue !== null ? minusValue / baseValue - 1 : null;
      const plusRelative =
        baseValue && plusValue !== null ? plusValue / baseValue - 1 : null;

      let elasticity = null;
      if (
        minusValue !== null &&
        plusValue !== null &&
        minusValue > 0 &&
        plusValue > 0 &&
        minusParam > 0 &&
        plusParam > minusParam
      ) {
        elasticity =
          Math.log(plusValue / minusValue) /
          Math.log(plusParam / minusParam);
      }

      const relativeChanges = [minusRelative, plusRelative]
        .filter((value) => Number.isFinite(value))
        .map((value) => Math.abs(value));

      rows.push({
        key,
        center,
        minusParam,
        plusParam,
        minusValue,
        plusValue,
        minusRelative,
        plusRelative,
        elasticity,
        impact: relativeChanges.length ? Math.max(...relativeChanges) : 0
      });
    }

    rows.sort((a, b) => b.impact - a.impact);

    return {
      mode,
      metric,
      fraction,
      baseValue,
      rows
    };
  }

  function comparePresets(mode, overrides = {}) {
    return Object.entries(PRESETS).map(([name, preset]) => {
      const parameters = normalizeParams({ ...preset, ...overrides });
      const result = simulate(mode, parameters);
      return {
        name,
        parameters,
        result,
        metric: extractMetric(result, "ratio511")
      };
    });
  }


  function diagnoseRun(mode, input, result = null) {
    const p = normalizeParams(input);
    const r = result || simulate(mode, p);
    const checks = [];

    function add(level, code, message, value = null) {
      checks.push({ level, code, message, value });
    }

    const ratio = Number(r && r.ratio511);
    if (Number.isFinite(ratio) && ratio >= 0) {
      add("ok", "finite_ratio", "Основная метрика L/L₅₁₁ конечна.", ratio);
    } else {
      add("error", "finite_ratio", "Основная метрика L/L₅₁₁ не является конечным неотрицательным числом.", ratio);
    }

    if (mode === "cme") {
      add(
        "info",
        "unit_system",
        "CVE closure решается после явного перевода B, T, Ω, m_eff и L_eff в natural units (ℏ=c=k_B=1)."
      );

      const thermalToElectronMass =
        temperatureGeV(p.temperature) / CONSTANTS.ELECTRON_MASS_GEV;
      add(
        thermalToElectronMass >= 1 ? "info" : "warning",
        "massless_fermion_regime",
        thermalToElectronMass >= 1
          ? "Температура не ниже m_e; massless-fermion transport approximation хотя бы не находится в явно нерелятивистском режиме."
          : "T << m_e: massless-fermion CVE/CME coefficients и susceptibility являются структурной диагностикой, а не физически надёжным electron-plasma расчётом.",
        thermalToElectronMass
      );

      if (p.spin < CONSTANTS.SPIN_THRESHOLD) {
        add(
          "info",
          "spin_threshold",
          "Спин ниже феноменологического порога CME; этот gate задан моделью и не выводится из quadratic closure.",
          p.spin
        );
      } else if (!r.closure || !r.closure.hasRealRoots) {
        add(
          "warning",
          "closure_discriminant",
          "Quadratic closure не имеет положительной вещественной устойчивой ветви.",
          r.closure ? Number(r.closure.discriminant) : null
        );
      } else {
        const residual = selfConsistencyResidual(Number(r.aBar), p);
        const relativeResidual =
          Math.abs(residual) / Math.max(Math.abs(Number(r.aBar)), 1e-300);
        add(
          relativeResidual <= 1e-10 ? "ok" : "warning",
          "root_residual",
          relativeResidual <= 1e-10
            ? "Устойчивая CVE-ветвь удовлетворяет самосогласованному уравнению."
            : "Относительный residual устойчивой CVE-ветви выше 1e-10.",
          relativeResidual
        );
        add(
          Number(r.closure.stableSlope) < 0.8 ? "ok" : "warning",
          "fixed_point_slope",
          Number(r.closure.stableSlope) < 0.8
            ? "Малая ветвь устойчива как fixed point (|F′| < 0.8)."
            : "Малая ветвь приближается к границе fixed-point устойчивости.",
          Number(r.closure.stableSlope)
        );
        add(
          "info",
          "closure_discriminant",
          "Дискриминант quadratic closure; D ≥ 0 означает вещественные ветви.",
          Number(r.closure.discriminant)
        );
      }

      if (p.spin > 0.98) {
        add(
          "info",
          "near_extremal",
          "Спин близок к верхней численной границе a/M < 1; интерпретируй результат как пограничный режим реализации.",
          p.spin
        );
      }
    }

    if (mode === "superradiant" || mode === "hybrid") {
      if (!r.active) {
        const reasons = [];
        if (p.spin < 0.4) reasons.push("a/M < 0.4");
        if (Number(r.alpha) < 0.05) reasons.push("α < 0.05");
        add(
          "info",
          "superradiance_inactive",
          "В текущей реализации Γ = 0" +
            (reasons.length ? " (" + reasons.join(", ") + ")." : "."),
          Number(r.alpha)
        );
      } else {
        add(
          "ok",
          "superradiance_active",
          "Суперрадиантная ветка активна по внутренним порогам текущей реализации.",
          Number(r.gamma)
        );
      }
    }

    if (
      mode === "bosenova" &&
      Number.isFinite(r.intervalSeconds) &&
      p.burstDuration >= r.intervalSeconds
    ) {
      add(
        "warning",
        "overlapping_bursts",
        "Длительность вспышки не меньше интервала между вспышками; усреднённая интерпретация циклов перекрывается.",
        p.burstDuration / r.intervalSeconds
      );
    }

    const hasError = checks.some((item) => item.level === "error");
    const hasWarning = checks.some((item) => item.level === "warning");

    return {
      mode,
      status: hasError ? "error" : hasWarning ? "warning" : "ok",
      checks
    };
  }

  function formatScientific(value, digits = 3) {
    if (value === Number.POSITIVE_INFINITY) return "∞";
    if (!Number.isFinite(value)) return "—";
    if (value === 0) return "0";
    return value.toExponential(digits);
  }

  function formatDuration(seconds) {
    if (!Number.isFinite(seconds)) return "∞";
    if (seconds < 1e-6) return formatScientific(seconds, 2) + " s";
    if (seconds < 60) return seconds.toPrecision(3) + " s";
    if (seconds < 3600) return (seconds / 60).toPrecision(3) + " min";
    if (seconds < 86400) return (seconds / 3600).toPrecision(3) + " h";
    if (seconds < CONSTANTS.YEAR) return (seconds / 86400).toPrecision(3) + " d";
    return (seconds / CONSTANTS.YEAR).toPrecision(3) + " yr";
  }

  return Object.freeze({
    CONSTANTS,
    DEFAULTS,
    PRESETS,
    normalizeParams,
    kerrGeometry,
    turbulentFactor,
    temperatureGeV,
    magneticFieldGeV2,
    inverseLengthGeV,
    lengthGeVInv,
    angularFrequencyGeV,
    mu5Coupling,
    mu5FromA,
    chiralDegeneracy,
    chiralConductivity,
    chiralMagneticConductivity,
    chiralMagneticCurrent,
    axialVorticalCurrent,
    anomalousTransportDiagnostics,
    anomalousTransportSweep,
    axialChargeDensity,
    axialSusceptibility,
    mu5FromAxialCharge,
    anomalyCoefficient,
    chiralityFlipRateGeV,
    chiralitySourceProxy,
    evolveAxialDensity,
    chiralityDynamics,
    chiralityDynamicsSeries,
    stableFermi,
    stableSoftplus,
    simpsonIntegral,
    finiteMassFermiKernel,
    finiteMassAxialVorticalConductivity,
    finiteMassVectorSusceptibility,
    finiteMassCarrierDensities,
    finiteMassPlasmaDiagnostics,
    finiteMassPlasmaSweep,
    averageMagneticField,
    selfConsistencyCoefficients,
    selfConsistencyRhs,
    selfConsistencyResidual,
    selfConsistencyBranches,
    findCloud,
    cme,
    manualBosenova,
    superradiant,
    hybrid,
    simulate,
    spinSweep,
    linearSpace,
    logSpace,
    parameterMap,
    relativeDifferencePercent,
    compareParameterMaps,
    parameterSlices,
    deficitOrders,
    parameterDeficitMap,
    inferParameterTarget,
    parameterInference,
    INFERENCE_BOUNDS,
    MISSING_PHYSICS_CHANNELS,
    normalizeMissingPhysicsGains,
    cmeWithGains,
    cmeClosureCeiling,
    missingPhysicsPoint,
    missingPhysicsSweep,
    missingPhysicsAnalysis,
    sensitivityAnalysis,
    comparePresets,
    diagnoseRun,
    SENSITIVITY_KEYS,
    formatScientific,
    formatDuration
  });
});

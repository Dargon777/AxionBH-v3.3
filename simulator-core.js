(function (root, factory) {
  const api = factory();
  if (typeof module === "object" && module.exports) module.exports = api;
  if (root) root.AxionBH = api;
})(typeof globalThis !== "undefined" ? globalThis : this, function () {
  "use strict";

  const MODEL_VERSION = "8.5.0";
  const STATE_SCHEMA_VERSION = 8;

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
    POSITRON_RATE_OBS_511: 1.07e43,
    SCHWINGER_ECRIT_V_CM: 1.323285474e16,
    ELECTRON_COMPTON_REDUCED_CM: 3.8615926796e-11,
    L_OBS_511: 1.07e43, // deprecated numeric alias; historical v7/v8.2 code treated this as erg/s
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
    electronMuMeV: 0,
    electronDensityMode: 0,
    electronDensityCm3: 1e7,
    accretionRadiusRg: 10,
    radialVelocityFracC: 0.01,
    scaleHeightRatio: 0.5,
    electronFractionYe: 1,
    nProfile: 1.8,
    axionMassEv: 1e-17,
    burstEnergy: 1e55,
    burstIntervalYears: 1e6,
    burstDuration: 1e6,
    burstEfficiency: 1e-17
  });

  function mdotGsFromMsunPerYear(value) {
    const rate = assertFinitePositive(
      Number(value),
      "mdotMsunPerYear"
    );
    return rate * CONSTANTS.MSUN / CONSTANTS.YEAR;
  }

  function mdotMsunPerYearFromGs(value) {
    const rate = assertFinitePositive(
      Number(value),
      "mdotGs"
    );
    return rate * CONSTANTS.YEAR / CONSTANTS.MSUN;
  }

  const ACCRETION_CALIBRATIONS = Object.freeze({
    eht2023: Object.freeze({
      id: "eht2023",
      label: "EHT 2023 promising GRMHD cluster",
      kind: "model-cluster",
      minMsunPerYear: 5.2e-9,
      maxMsunPerYear: 9.5e-9,
      source:
        "Event Horizon Telescope Collaboration, Sgr A* Paper V, arXiv:2311.09478",
      sourceUrl:
        "https://arxiv.org/abs/2311.09478",
      caveat:
        "Promising MAD, low-inclination model cluster; all tested EHT model families fail at least one observational constraint."
    }),
    faraday2006: Object.freeze({
      id: "faraday2006",
      label: "Faraday-rotation conditional range",
      kind: "conditional-observational",
      minMsunPerYear: 2e-9,
      maxMsunPerYear: 2e-7,
      source:
        "Marrone et al. 2007, arXiv:astro-ph/0611791",
      sourceUrl:
        "https://arxiv.org/abs/astro-ph/0611791",
      caveat:
        "Conditional on magnetic-field strength, ordering and geometry; not a model-independent interval."
    })
  });

  const FLOW_GEOMETRY_CONTEXT = Object.freeze({
    source: Object.freeze({
      label: "ADAF / RIAF geometry and kinematics",
      citation:
        "Narayan & McClintock 2008, arXiv:0803.0322",
      sourceUrl:
        "https://arxiv.org/abs/0803.0322",
      statement:
        "Geometrically thick flow with H of order R and v_r ~ alpha v_K (H/R)^2; review quotes alpha ~ 0.1-0.3."
    }),
    radiusRg: Object.freeze({
      min: 3,
      max: 30,
      kind: "exploratory-horizon-scale",
      caveat:
        "Chosen as a broad horizon-scale scan, not an observational confidence interval."
    }),
    scaleHeightRatio: Object.freeze({
      min: 0.3,
      max: 1,
      kind: "RIAF-envelope",
      caveat:
        "H/R ~ 1 is literature-motivated for ADAF/RIAF; 0.3 is an intentionally broad lower exploratory edge."
    }),
    alpha: Object.freeze({
      min: 0.1,
      max: 0.3,
      kind: "literature-context",
      caveat:
        "Viscosity-parameter interval quoted in the ADAF review."
    }),
    electronFractionYe: Object.freeze({
      min: 0.5,
      max: 1,
      kind: "composition-envelope",
      caveat:
        "Fully ionized He-to-H electron-per-baryon envelope; not a measured Sgr A* composition."
    })
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
      "temperature", "accretionRadiusRg", "radialVelocityFracC",
      "scaleHeightRatio", "electronFractionYe", "nProfile",
      "axionMassEv", "burstEnergy", "burstIntervalYears",
      "burstDuration", "burstEfficiency"
    ].forEach((key) => {
      p[key] = Number(p[key]);
      assertFinitePositive(p[key], key);
    });
    p.electronMuMeV = Number(p.electronMuMeV);
    assertFinitePositive(
      p.electronMuMeV,
      "electronMuMeV",
      true
    );
    p.electronDensityMode = Number(p.electronDensityMode);
    if (![0, 1, 2].includes(p.electronDensityMode)) {
      throw new RangeError(
        "electronDensityMode must be 0 (manual muV), 1 (density closure), or 2 (accretion closure)"
      );
    }
    p.electronDensityCm3 = Number(p.electronDensityCm3);
    assertFinitePositive(
      p.electronDensityCm3,
      "electronDensityCm3",
      true
    );
    if (p.radialVelocityFracC > 1) {
      throw new RangeError(
        "radialVelocityFracC must not exceed 1"
      );
    }
    if (p.electronFractionYe > 1) {
      throw new RangeError(
        "electronFractionYe must not exceed 1"
      );
    }

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
    const plasma = finiteMassPlasmaDiagnostics(p);
    const sigmaCVEBase = plasma.sigmaMassive;
    const sigmaCVENonlinear =
      mu5 * mu5 / (2 * Math.PI * Math.PI);
    const sigmaCVE =
      sigmaCVEBase + sigmaCVENonlinear;
    const jCME = sigmaCME * fieldGeV2;
    const jCVE = sigmaCVE * omegaGeV;
    const jCVEThermal = sigmaCVEBase * omegaGeV;
    const jCVEChemical =
      sigmaCVENonlinear * omegaGeV;
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
      sigmaCVEBase,
      sigmaCVENonlinear,
      finiteMassSuppression: plasma.suppression,
      electronMuGeV: plasma.vectorMuGeV,
      massOverT: plasma.massOverT,
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


  const massiveCveCache = new Map();

  function fermiDerivativeKernel(value) {
    const x = Number(value);
    if (!Number.isFinite(x)) return 0;
    if (x >= 0) {
      if (x > 745) return 0;
      const z = Math.exp(-x);
      return z / ((1 + z) * (1 + z));
    }
    if (x < -745) return 0;
    const z = Math.exp(x);
    return z / ((1 + z) * (1 + z));
  }

  function simpson1D(fn, start, stop, intervals = 800) {
    if (!(stop > start)) return 0;
    let n = Math.max(20, Math.trunc(intervals));
    if (n % 2) n += 1;
    const h = (stop - start) / n;
    let sum = fn(start) + fn(stop);
    for (let i = 1; i < n; i += 1) {
      sum += (i % 2 ? 4 : 2) * fn(start + i * h);
    }
    return sum * h / 3;
  }



  const electronMuDensityCache = new Map();

  function accretionElectronDensity(input) {
    const p = normalizeParams(input);
    const geometry = kerrGeometry(
      p.massSolar * CONSTANTS.MSUN,
      p.spin
    );
    const horizonRg = geometry.rPlus / geometry.rg;
    if (!(p.accretionRadiusRg > horizonRg)) {
      throw new RangeError(
        "accretionRadiusRg must lie outside the Kerr horizon"
      );
    }

    const radiusCm =
      p.accretionRadiusRg * geometry.rg;
    const scaleHeightCm =
      p.scaleHeightRatio * radiusCm;
    const radialVelocityCmS =
      p.radialVelocityFracC * CONSTANTS.C;
    const inflowAreaCm2 =
      4 * Math.PI * radiusCm * scaleHeightCm;
    const massDensityGcm3 =
      p.mdot /
      Math.max(
        inflowAreaCm2 * radialVelocityCmS,
        1e-300
      );
    const baryonDensityCm3 =
      massDensityGcm3 / CONSTANTS.MP;
    const netElectronDensityCm3 =
      p.electronFractionYe * baryonDensityCm3;
    const inflowTimeSeconds =
      radiusCm / radialVelocityCmS;

    return {
      model: "steady thick-disk continuity proxy",
      radiusRg: p.accretionRadiusRg,
      radiusCm,
      horizonRg,
      scaleHeightRatio: p.scaleHeightRatio,
      scaleHeightCm,
      radialVelocityFracC: p.radialVelocityFracC,
      radialVelocityCmS,
      inflowAreaCm2,
      mdotGs: p.mdot,
      massDensityGcm3,
      baryonDensityCm3,
      electronFractionYe: p.electronFractionYe,
      netElectronDensityCm3,
      inflowTimeSeconds,
      continuity:
        "mdot = 4*pi*r*H*rho*|v_r|"
    };
  }

  function fermiOccupation(value) {
    const x = Number(value);
    if (!Number.isFinite(x)) {
      if (x === Number.POSITIVE_INFINITY) return 0;
      if (x === Number.NEGATIVE_INFINITY) return 1;
      return Number.NaN;
    }
    if (x > 50) return Math.exp(-x);
    if (x < -50) return 1 - Math.exp(x);
    return 1 / (Math.exp(x) + 1);
  }

  function naturalDensityToCm3(value) {
    const density = Number(value);
    if (!Number.isFinite(density)) return Number.NaN;
    return density * Math.pow(CONSTANTS.CM_TO_GEV_INV, 3);
  }

  function densityCm3ToNatural(value) {
    const density = Number(value);
    if (!Number.isFinite(density)) return Number.NaN;
    return density / Math.pow(CONSTANTS.CM_TO_GEV_INV, 3);
  }

  function electronPairDensitiesNatural(
    temperature,
    vectorMuGeV,
    massGeV = CONSTANTS.ELECTRON_MASS_GEV
  ) {
    const thermal = temperatureGeV(temperature);
    const mass = assertFinitePositive(massGeV, "massGeV");
    const mu = Number(vectorMuGeV);
    if (!Number.isFinite(mu) || mu < 0) {
      throw new RangeError(
        "vectorMuGeV must be finite and non-negative"
      );
    }

    const a = mass / thermal;
    const b = mu / thermal;
    const upperExtra = Math.max(60, b - a + 40);
    const tMax = Math.sqrt(upperExtra);

    function integrate(sign) {
      const integral = simpson1D((t) => {
        const x = a + t * t;
        const p = Math.sqrt(
          Math.max(0, x * x - a * a)
        );
        const occupation = fermiOccupation(
          x + sign * b
        );
        return x * p * occupation * 2 * t;
      }, 0, tMax, 1200);
      return (
        thermal * thermal * thermal /
        (Math.PI * Math.PI) *
        integral
      );
    }

    return {
      electron: integrate(-1),
      positron: integrate(1)
    };
  }

  function electronNetDensityNatural(
    temperature,
    vectorMuGeV,
    massGeV = CONSTANTS.ELECTRON_MASS_GEV
  ) {
    const pair = electronPairDensitiesNatural(
      temperature,
      vectorMuGeV,
      massGeV
    );
    return pair.electron - pair.positron;
  }

  function electronNetDensityCm3(
    temperature,
    vectorMuGeV,
    massGeV = CONSTANTS.ELECTRON_MASS_GEV
  ) {
    return naturalDensityToCm3(
      electronNetDensityNatural(
        temperature,
        vectorMuGeV,
        massGeV
      )
    );
  }

  function electronChemicalPotentialFromDensity(
    temperature,
    netDensityCm3,
    massGeV = CONSTANTS.ELECTRON_MASS_GEV
  ) {
    const targetCm3 = Number(netDensityCm3);
    if (!Number.isFinite(targetCm3) || targetCm3 < 0) {
      throw new RangeError(
        "netDensityCm3 must be finite and non-negative"
      );
    }
    if (targetCm3 === 0) return 0;

    const cacheKey = [
      Number(temperature).toPrecision(12),
      targetCm3.toPrecision(12),
      Number(massGeV).toPrecision(12)
    ].join("|");
    if (electronMuDensityCache.has(cacheKey)) {
      return electronMuDensityCache.get(cacheKey);
    }

    const thermal = temperatureGeV(temperature);
    const mass = assertFinitePositive(massGeV, "massGeV");
    const target = densityCm3ToNatural(targetCm3);
    const ultraGuess = Math.cbrt(
      3 * Math.PI * Math.PI * target
    );
    let low = 0;
    let high = Math.max(
      mass + 60 * thermal,
      2 * ultraGuess,
      thermal
    );

    let highDensity = electronNetDensityNatural(
      temperature,
      high,
      mass
    );
    let guard = 0;
    while (
      highDensity < target &&
      high < 1e6 &&
      guard < 80
    ) {
      high *= 2;
      highDensity = electronNetDensityNatural(
        temperature,
        high,
        mass
      );
      guard += 1;
    }

    if (!(highDensity >= target)) {
      throw new RangeError(
        "density closure could not bracket electron chemical potential"
      );
    }

    for (let i = 0; i < 90; i += 1) {
      const mid = (low + high) / 2;
      const density = electronNetDensityNatural(
        temperature,
        mid,
        mass
      );
      if (density < target) low = mid;
      else high = mid;
    }

    const resolved = (low + high) / 2;
    electronMuDensityCache.set(cacheKey, resolved);
    if (electronMuDensityCache.size > 256) {
      const first =
        electronMuDensityCache.keys().next().value;
      electronMuDensityCache.delete(first);
    }
    return resolved;
  }

  function resolveElectronVectorChemicalPotential(input) {
    const p = normalizeParams(input);
    const manualMuGeV = p.electronMuMeV * 1e-3;

    if (p.electronDensityMode === 2) {
      const accretion = accretionElectronDensity(p);
      const muGeV =
        electronChemicalPotentialFromDensity(
          p.temperature,
          accretion.netElectronDensityCm3
        );
      const pair = electronPairDensitiesNatural(
        p.temperature,
        muGeV
      );
      return {
        mode: "accretion",
        muGeV,
        muMeV: muGeV * 1e3,
        targetNetDensityCm3:
          accretion.netElectronDensityCm3,
        netDensityCm3: naturalDensityToCm3(
          pair.electron - pair.positron
        ),
        electronDensityCm3:
          naturalDensityToCm3(pair.electron),
        positronDensityCm3:
          naturalDensityToCm3(pair.positron),
        accretion
      };
    }

    if (p.electronDensityMode !== 1) {
      const pair = electronPairDensitiesNatural(
        p.temperature,
        manualMuGeV
      );
      return {
        mode: "manual",
        muGeV: manualMuGeV,
        muMeV: manualMuGeV * 1e3,
        targetNetDensityCm3: null,
        netDensityCm3: naturalDensityToCm3(
          pair.electron - pair.positron
        ),
        electronDensityCm3:
          naturalDensityToCm3(pair.electron),
        positronDensityCm3:
          naturalDensityToCm3(pair.positron),
        accretion: null
      };
    }

    const muGeV = electronChemicalPotentialFromDensity(
      p.temperature,
      p.electronDensityCm3
    );
    const pair = electronPairDensitiesNatural(
      p.temperature,
      muGeV
    );

    return {
      mode: "density",
      muGeV,
      muMeV: muGeV * 1e3,
      targetNetDensityCm3: p.electronDensityCm3,
      netDensityCm3: naturalDensityToCm3(
        pair.electron - pair.positron
      ),
      electronDensityCm3:
        naturalDensityToCm3(pair.electron),
      positronDensityCm3:
        naturalDensityToCm3(pair.positron),
      accretion: null
    };
  }

  function electronDensityClosureSweep(
    input,
    {
      minDensityCm3 = 1,
      maxDensityCm3 = 1e30,
      points = 64
    } = {}
  ) {
    const p = normalizeParams(input);
    const minDensity = assertFinitePositive(
      Number(minDensityCm3),
      "minDensityCm3"
    );
    const maxDensity = assertFinitePositive(
      Number(maxDensityCm3),
      "maxDensityCm3"
    );
    if (!(maxDensity > minDensity)) {
      throw new RangeError(
        "maxDensityCm3 must exceed minDensityCm3"
      );
    }

    const count = Math.max(
      16,
      Math.min(100, Math.trunc(points))
    );
    const densities = logSpace(
      minDensity,
      maxDensity,
      count
    );

    return {
      points: densities.map((netDensityCm3) => {
        const muGeV =
          electronChemicalPotentialFromDensity(
            p.temperature,
            netDensityCm3
          );
        const plasma = finiteMassPlasmaDiagnostics({
          ...p,
          electronDensityMode: 0,
          electronMuMeV: muGeV * 1e3
        });
        return {
          netDensityCm3,
          muGeV,
          muMeV: muGeV * 1e3,
          suppression: plasma.suppression
        };
      })
    };
  }

  function massiveCveDimensionlessIntegral(
    massOverT,
    muOverT
  ) {
    const a = Math.max(0, Number(massOverT));
    const b = Math.abs(Number(muOverT));
    if (!Number.isFinite(a) || !Number.isFinite(b)) {
      return Number.NaN;
    }

    const key =
      a.toPrecision(12) + "|" + b.toPrecision(12);
    if (massiveCveCache.has(key)) {
      return massiveCveCache.get(key);
    }

    function phase(x) {
      return x * Math.sqrt(Math.max(0, x * x - a * a));
    }

    function integrateNearThreshold(kernelShift, upperExtra) {
      const tMax = Math.sqrt(upperExtra);
      return simpson1D((t) => {
        const x = a + t * t;
        return (
          phase(x) *
          fermiDerivativeKernel(x + kernelShift) *
          2 * t
        );
      }, 0, tMax, 1000);
    }

    let particle = 0;
    if (b > a + 40) {
      const lo = Math.max(a, b - 40);
      const hi = b + 40;
      particle = simpson1D(
        (x) => phase(x) * fermiDerivativeKernel(x - b),
        lo,
        hi,
        1200
      );
    } else {
      const extra = Math.max(60, b - a + 40);
      particle = integrateNearThreshold(-b, extra);
    }

    const antiparticle = integrateNearThreshold(b, 60);
    const result =
      (particle + antiparticle) /
      (2 * Math.PI * Math.PI);

    massiveCveCache.set(key, result);
    if (massiveCveCache.size > 256) {
      const first = massiveCveCache.keys().next().value;
      massiveCveCache.delete(first);
    }
    return result;
  }

  function massiveAxialVorticalConductivity(
    temperature,
    vectorMuGeV = 0,
    massGeV = CONSTANTS.ELECTRON_MASS_GEV
  ) {
    const thermal = temperatureGeV(temperature);
    const mass = assertFinitePositive(massGeV, "massGeV");
    const mu = Number(vectorMuGeV);
    if (!Number.isFinite(mu)) {
      throw new RangeError("vectorMuGeV must be finite");
    }
    const dimensionless = massiveCveDimensionlessIntegral(
      mass / thermal,
      mu / thermal
    );
    const sigma = thermal * thermal * dimensionless;
    return Number.isFinite(sigma) ? sigma : Number.NaN;
  }

  function masslessAxialVorticalReference(
    temperature,
    vectorMuGeV = 0
  ) {
    const thermal = temperatureGeV(temperature);
    const mu = Number(vectorMuGeV);
    if (!Number.isFinite(mu)) {
      throw new RangeError("vectorMuGeV must be finite");
    }
    return (
      thermal * thermal / 6 +
      mu * mu / (2 * Math.PI * Math.PI)
    );
  }

  function finiteMassPlasmaDiagnostics(input) {
    const p = normalizeParams(input);
    const thermal = temperatureGeV(p.temperature);
    const densityClosure =
      resolveElectronVectorChemicalPotential(p);
    const muVectorGeV = densityClosure.muGeV;
    const mass = CONSTANTS.ELECTRON_MASS_GEV;
    const sigmaMassive =
      massiveAxialVorticalConductivity(
        p.temperature,
        muVectorGeV,
        mass
      );
    const sigmaMassless =
      masslessAxialVorticalReference(
        p.temperature,
        muVectorGeV
      );
    const suppression =
      sigmaMassless > 0
        ? sigmaMassive / sigmaMassless
        : null;
    const pairSymmetricMassive =
      massiveAxialVorticalConductivity(
        p.temperature,
        0,
        mass
      );
    const pairSymmetricMassless =
      masslessAxialVorticalReference(
        p.temperature,
        0
      );
    const pairSymmetricSuppression =
      pairSymmetricMassless > 0
        ? pairSymmetricMassive /
          pairSymmetricMassless
        : null;
    const fermiMomentumGeV =
      muVectorGeV > mass
        ? Math.sqrt(
            muVectorGeV * muVectorGeV -
            mass * mass
          )
        : 0;

    return {
      temperatureGeV: thermal,
      massGeV: mass,
      massOverT: mass / thermal,
      vectorMuGeV: muVectorGeV,
      vectorMuMeV: muVectorGeV * 1e3,
      vectorMuOverT: muVectorGeV / thermal,
      densityClosureMode: densityClosure.mode,
      densityClosureActive:
        densityClosure.mode === "density",
      accretionClosureActive:
        densityClosure.mode === "accretion",
      accretion:
        densityClosure.accretion || null,
      targetNetDensityCm3:
        densityClosure.targetNetDensityCm3,
      resolvedNetDensityCm3:
        densityClosure.netDensityCm3,
      electronDensityCm3:
        densityClosure.electronDensityCm3,
      positronDensityCm3:
        densityClosure.positronDensityCm3,
      positronFraction:
        densityClosure.electronDensityCm3 > 0
          ? densityClosure.positronDensityCm3 /
            densityClosure.electronDensityCm3
          : null,
      sigmaMassive,
      sigmaMassless,
      suppression,
      pairSymmetricMassive,
      pairSymmetricMassless,
      pairSymmetricSuppression,
      fermiMomentumGeV,
      degenerateAtZeroT: muVectorGeV > mass,
      formula:
        "free massive Dirac bulk axial CVE, linear in vorticity",
      nonlinearMu5Term:
        "legacy massless ansatz retained separately"
    };
  }

  function finiteMassPlasmaSweep(
    input,
    {
      maxMuMeV = 2,
      points = 100
    } = {}
  ) {
    const p = normalizeParams(input);
    const maxMu = assertFinitePositive(
      Number(maxMuMeV),
      "maxMuMeV"
    );
    const count = Math.max(
      16,
      Math.min(180, Math.trunc(points))
    );
    const values = Array.from(
      { length: count },
      (_, index) => maxMu * index / (count - 1)
    );

    return {
      points: values.map((electronMuMeV) => {
        const plasma = finiteMassPlasmaDiagnostics({
          ...p,
          electronDensityMode: 0,
          electronMuMeV
        });
        return {
          electronMuMeV,
          sigmaMassive: plasma.sigmaMassive,
          sigmaMassless: plasma.sigmaMassless,
          suppression: plasma.suppression,
          massOverT: plasma.massOverT
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
    const plasma =
      finiteMassPlasmaDiagnostics(p);
    const electronMuGeV = plasma.vectorMuGeV;
    const cveBaseCoefficient =
      plasma.sigmaMassive;
    const cveMasslessReference =
      plasma.sigmaMassless;
    const finiteMassSuppression =
      plasma.suppression;

    // v7.9: the source term uses the exact free massive-Dirac
    // bulk axial-CVE coefficient at vector chemical potential mu_V.
    // The mu5^2 nonlinear term is retained from the legacy massless
    // closure as an explicit phenomenological ansatz.
    const scale = omega /
      (p.faGev * mass * mass * effectiveLength + 1e-300);
    const c0 = scale * cveBaseCoefficient;
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
      electronMuGeV,
      electronMuMeV: electronMuGeV * 1e3,
      electronDensityMode: p.electronDensityMode,
      accretion:
        plasma.accretion || null,
      targetElectronDensityCm3:
        plasma.targetNetDensityCm3,
      resolvedElectronDensityCm3:
        plasma.resolvedNetDensityCm3,
      electronDensityCm3:
        plasma.electronDensityCm3,
      positronDensityCm3:
        plasma.positronDensityCm3,
      positronFraction:
        plasma.positronFraction,
      cveBaseCoefficient,
      cveMasslessReference,
      finiteMassSuppression,
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
      temperature: Object.freeze({ min: 1, max: 1e40, scale: "log" }),
      electronMuMeV: Object.freeze({ min: 1e-9, max: 1e9, scale: "log" }),
      electronDensityCm3: Object.freeze({ min: 1, max: 1e40, scale: "log" })
    })
  });

  function positronRateFromPower(powerErgS, energyCostErg = CONSTANTS.POSITRON_ENERGY) {
    const power = Number(powerErgS);
    const cost = Number(energyCostErg);
    if (!Number.isFinite(power) || power < 0) {
      throw new RangeError("powerErgS must be non-negative");
    }
    assertFinitePositive(cost, "energyCostErg");
    return power / cost;
  }

  function positronObservableFromPower(powerErgS, energyCostErg = CONSTANTS.POSITRON_ENERGY) {
    const rate = positronRateFromPower(powerErgS, energyCostErg);
    return {
      powerErgS,
      energyCostErg,
      positronRatePerSecond: rate,
      observedPositronRatePerSecond:
        CONSTANTS.POSITRON_RATE_OBS_511,
      ratio511:
        rate / CONSTANTS.POSITRON_RATE_OBS_511,
      note:
        "Observed ~1e43 quantity is a Galactic positron annihilation/injection rate in e+/s. Conversion from model power to e+/s remains an explicit phenomenological energy-cost proxy."
    };
  }

  function microphysicsAudit(input) {
    const p = normalizeParams(input);
    const result = cme(p);
    const observable =
      positronObservableFromPower(result.luminosity);
    const historicalRatio =
      result.luminosity / CONSTANTS.L_OBS_511;
    const correctedDeficit =
      deficitOrders(observable.ratio511, 1);
    const historicalDeficit =
      deficitOrders(historicalRatio, 1);
    const transport =
      anomalousTransportDiagnostics(p, result);
    return {
      modelVersion: MODEL_VERSION,
      observed511: {
        quantity: "Galactic positron annihilation/injection rate",
        valuePerSecond:
          CONSTANTS.POSITRON_RATE_OBS_511,
        unit: "e+/s",
        historicalBug:
          "Legacy code compared model power in erg/s directly with a ~1e43 e+/s observational rate."
      },
      axionToMu5: {
        status: "phenomenological",
        modelRelation:
          "mu5 = alpha_F * (a/fa) * mu_B * B * C_turb",
        warning:
          "Derivative axion-fermion couplings can bias charge production in appropriate non-equilibrium settings, but they do not by themselves derive this stationary local mu5 ansatz.",
        mu5GeV: result.mu5
      },
      mu5ToPositrons: {
        status: "phenomenological-energy-proxy",
        modelRelation:
          "Ndot_e+ = L_model / E_cost",
        energyCostErg:
          CONSTANTS.POSITRON_ENERGY,
        powerErgS: result.luminosity,
        positronRatePerSecond:
          observable.positronRatePerSecond
      },
      observable,
      historicalRatio511: historicalRatio,
      historicalDeficitDex: historicalDeficit,
      correctedRatio511: observable.ratio511,
      correctedDeficitDex: correctedDeficit,
      dimensionalCorrectionDex:
        historicalDeficit - correctedDeficit,
      transport
    };
  }


  function schwingerPairRateDensity(electricFieldVcm, terms = 8) {
    const eField=Number(electricFieldVcm);if(!Number.isFinite(eField)||eField<0)throw new RangeError("electricFieldVcm must be non-negative");if(eField===0)return 0;
    const nTerms=Math.max(1,Math.min(100,Math.trunc(terms))),x=eField/CONSTANTS.SCHWINGER_ECRIT_V_CM;let series=0;
    for(let n=1;n<=nTerms;n+=1)series+=Math.exp(-Math.PI*n/x)/(n*n);
    const lambda=CONSTANTS.ELECTRON_COMPTON_REDUCED_CM;
    return CONSTANTS.C/(4*Math.PI**3*lambda**4)*x*x*series;
  }
  function pairProductionVolume(input,radiusRg=1,thicknessRg=1,fillingFactor=1){
    const p=normalizeParams(input),r=assertFinitePositive(Number(radiusRg),"radiusRg"),dr=assertFinitePositive(Number(thicknessRg),"thicknessRg"),f=Number(fillingFactor);
    if(!(f>0&&f<=1))throw new RangeError("fillingFactor must satisfy 0 < f <= 1");
    const rg=kerrGeometry(p.massSolar*CONSTANTS.MSUN,p.spin).rg;
    return {rgCm:rg,radiusCm:r*rg,thicknessCm:dr*rg,fillingFactor:f,volumeCm3:4*Math.PI*(r*rg)**2*(dr*rg)*f};
  }
  function schwingerPairProduction(input,options={}){
    const p=normalizeParams(input),E=Number(options.electricFieldVcm||0),volume=pairProductionVolume(p,options.radiusRg||1,options.thicknessRg||1,options.fillingFactor||1),density=schwingerPairRateDensity(E),raw=density*volume.volumeCm3;
    const power=options.availablePowerErgS==null?p.mdot*CONSTANTS.C**2:Number(options.availablePowerErgS);if(!Number.isFinite(power)||power<0)throw new RangeError("availablePowerErgS must be non-negative");
    const pairRestEnergy=2*0.511*CONSTANTS.POSITRON_ENERGY,energyRate=power/pairRestEnergy,capped=Math.min(raw,energyRate);
    return {electricFieldVcm:E,electricFieldOverCritical:E/CONSTANTS.SCHWINGER_ECRIT_V_CM,rateDensityCm3S:density,volume,rawPairRatePerSecond:raw,availablePowerErgS:power,minimumPairEnergyErg:pairRestEnergy,energyLimitedRatePerSecond:energyRate,cappedPairRatePerSecond:capped,observedPositronRatePerSecond:CONSTANTS.POSITRON_RATE_OBS_511,rawRatio511:raw/CONSTANTS.POSITRON_RATE_OBS_511,cappedRatio511:capped/CONSTANTS.POSITRON_RATE_OBS_511,energyLimited:raw>energyRate};
  }
  function inferSchwingerFieldForObservedRate(input,options={}){
    const target=options.targetRatePerSecond||CONSTANTS.POSITRON_RATE_OBS_511,volume=pairProductionVolume(input,options.radiusRg||1,options.thicknessRg||1,options.fillingFactor||1),targetDensity=target/volume.volumeCm3;let lo=1e-8,hi=10;
    for(let i=0;i<180;i+=1){const mid=Math.sqrt(lo*hi),rate=schwingerPairRateDensity(mid*CONSTANTS.SCHWINGER_ECRIT_V_CM);if(rate<targetDensity)lo=mid;else hi=mid;}
    const x=Math.sqrt(lo*hi),E=x*CONSTANTS.SCHWINGER_ECRIT_V_CM;return {targetRatePerSecond:target,volume,electricFieldOverCritical:x,electricFieldVcm:E,rateDensityCm3S:schwingerPairRateDensity(E)};
  }
  function pairProductionAudit(input){
    const p=normalizeParams(input),required=inferSchwingerFieldForObservedRate(p),accretionPower=p.mdot*CONSTANTS.C**2,pairRestEnergy=2*0.511*CONSTANTS.POSITRON_ENERGY,minimumObservedPairPower=CONSTANTS.POSITRON_RATE_OBS_511*pairRestEnergy;
    return {mechanism:"Schwinger constant-field e+e- production",status:"explicit-idealized",assumptions:["locally constant homogeneous electric field","vacuum Schwinger rate; plasma screening/backreaction omitted","fiducial active volume 4π r² Δr with r=Δr=r_g and filling factor 1","energy ceiling uses mdot c², not a derived electromagnetic extraction efficiency"],criticalFieldVcm:CONSTANTS.SCHWINGER_ECRIT_V_CM,required,accretionPowerErgS:accretionPower,minimumObservedPairPowerErgS:minimumObservedPairPower,energyBudgetRatio:accretionPower/minimumObservedPairPower,energyBudgetCanSupplyMinimumRestMass:accretionPower>=minimumObservedPairPower};
  }


  function statvoltPerCmToVoltPerCm(value){return Number(value)*299.792458;}
  function blackHoleRotationalField(input,{radiusRg=1,fieldG=null,fieldLineOmegaFraction=0.5}={}){
    const p=normalizeParams(input),geometry=kerrGeometry(p.massSolar*CONSTANTS.MSUN,p.spin),radius=assertFinitePositive(Number(radiusRg),"radiusRg")*geometry.rg;
    const B=fieldG===null?averageMagneticField(p.B0,geometry,p.nProfile):assertFinitePositive(Number(fieldG),"fieldG");
    const fraction=Number(fieldLineOmegaFraction);if(!(fraction>=0&&fraction<=1))throw new RangeError("fieldLineOmegaFraction must be in [0,1]");
    const omegaF=geometry.omegaH*fraction,eStat=Math.abs(omegaF*radius/CONSTANTS.C)*B;
    return {radiusRg:Number(radiusRg),radiusCm:radius,fieldG:B,omegaHPerSecond:geometry.omegaH,fieldLineOmegaFraction:fraction,omegaFPerSecond:omegaF,electricFieldStatvoltCm:eStat,electricFieldVcm:statvoltPerCmToVoltPerCm(eStat),interpretation:"rotation-induced unscreened field scale; not a self-consistent E_parallel solution"};
  }
  function gapParallelElectricField(input,options={}){const u=blackHoleRotationalField(input,options),s=options.screeningFraction==null?1:Number(options.screeningFraction);if(!(s>=0&&s<=1))throw new RangeError("screeningFraction must be in [0,1]");return {...u,screeningFraction:s,parallelElectricFieldVcm:u.electricFieldVcm*s};}
  function gapElectrodynamicsAudit(input,options={}){
    const p=normalizeParams(input),field=gapParallelElectricField(p,options),required=inferSchwingerFieldForObservedRate(p,{radiusRg:options.activeRadiusRg||1,thicknessRg:options.activeThicknessRg||1,fillingFactor:options.fillingFactor||1}),ratio=field.parallelElectricFieldVcm/required.electricFieldVcm;
    const rawPairs=schwingerPairProduction(p,{electricFieldVcm:field.parallelElectricFieldVcm,radiusRg:options.activeRadiusRg||1,thicknessRg:options.activeThicknessRg||1,fillingFactor:options.fillingFactor||1});
    return {status:"upper-bound-scale",field,required,fieldToRequiredRatio:ratio,fieldDeficitDex:ratio>0?-Math.log10(ratio):Number.POSITIVE_INFINITY,schwingerAtGapField:rawPairs,caveats:["E~(Omega_F r/c)B is an unscreened rotational scale, not a GR gap Poisson solution.","Force-free plasma screens E_parallel; screeningFraction=1 is therefore an optimistic ceiling.","Real black-hole gaps are regulated by pair cascades, radiation and soft-photon fields.","Schwinger vacuum production is distinct from gamma-gamma pair cascades usually studied in BH gaps."]};
  }

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
    const logDiscriminantFactor =
      coefficients.c0 > 0 && coefficients.c2 > 0
        ? Math.log(4) +
          Math.log(coefficients.c0) +
          Math.log(coefficients.c2)
        : Number.NEGATIVE_INFINITY;
    const discriminantFactor =
      logDiscriminantFactor > Math.log(Number.MIN_VALUE)
        ? Math.exp(logDiscriminantFactor)
        : 0;
    const criticalLog =
      Number.isFinite(logDiscriminantFactor)
        ? -0.5 * logDiscriminantFactor
        : Number.POSITIVE_INFINITY;
    const criticalUpstreamProduct =
      Number.isFinite(criticalLog) &&
      criticalLog < Math.log(Number.MAX_VALUE)
        ? Math.exp(criticalLog)
        : Number.POSITIVE_INFINITY;

    const mu5Max = Math.sqrt(
      Math.max(
        0,
        2 * Math.PI * Math.PI *
        coefficients.cveBaseCoefficient
      )
    );
    const masslessMu5Max =
      Math.PI * thermal / Math.sqrt(3);
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
      masslessMu5Max,
      finiteMassSuppression:
        coefficients.finiteMassSuppression,
      electronMuGeV:
        coefficients.electronMuGeV,
      kappaMax,
      luminosityMax,
      ratioMax,
      ceilingDeficitOrders: deficitOrders(ratioMax, goal),
      upstreamHeadroom:
        current.ratio511 > 0 ? ratioMax / current.ratio511 : Number.POSITIVE_INFINITY,
      discriminantFactor,
      log10DiscriminantFactor:
        Number.isFinite(logDiscriminantFactor)
          ? logDiscriminantFactor / Math.LN10
          : Number.NEGATIVE_INFINITY,
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
      "electronMuMeV",
      "electronDensityCm3",
      "accretionRadiusRg",
      "radialVelocityFracC",
      "scaleHeightRatio",
      "electronFractionYe",
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



  function classifyAccretionRate(
    mdotMsunPerYear,
    calibration
  ) {
    const value = assertFinitePositive(
      Number(mdotMsunPerYear),
      "mdotMsunPerYear"
    );
    const min = calibration.minMsunPerYear;
    const max = calibration.maxMsunPerYear;
    if (value < min) {
      return {
        relation: "below",
        factorToNearestBound: min / value
      };
    }
    if (value > max) {
      return {
        relation: "above",
        factorToNearestBound: value / max
      };
    }
    return {
      relation: "within",
      factorToNearestBound: 1
    };
  }

  function accretionCalibrationPoint(
    input,
    mdotMsunPerYear,
    {
      id = "point",
      label = "calibration point",
      sourceId = null,
      role = "point"
    } = {}
  ) {
    const p = normalizeParams(input);
    const mdotGs =
      mdotGsFromMsunPerYear(mdotMsunPerYear);
    const parameters = normalizeParams({
      ...p,
      mdot: mdotGs,
      electronDensityMode: 2
    });
    const flow = accretionElectronDensity(parameters);
    const plasma =
      finiteMassPlasmaDiagnostics(parameters);
    const result = cme(parameters);

    return {
      id,
      label,
      sourceId,
      role,
      mdotMsunPerYear,
      mdotGs,
      parameters,
      flow,
      plasma,
      result,
      ratio511: result.ratio511,
      deficitDex: deficitOrders(result.ratio511, 1)
    };
  }

  function accretionCalibrationAnalysis(input) {
    const p = normalizeParams(input);
    const currentMsunPerYear =
      mdotMsunPerYearFromGs(p.mdot);
    const legacyMsunPerYear =
      mdotMsunPerYearFromGs(DEFAULTS.mdot);

    const ranges = Object.fromEntries(
      Object.entries(ACCRETION_CALIBRATIONS).map(
        ([key, calibration]) => {
          const geometricMid = Math.sqrt(
            calibration.minMsunPerYear *
            calibration.maxMsunPerYear
          );
          return [
            key,
            {
              ...calibration,
              geometricMidMsunPerYear: geometricMid,
              currentRelation: classifyAccretionRate(
                currentMsunPerYear,
                calibration
              ),
              low: accretionCalibrationPoint(
                p,
                calibration.minMsunPerYear,
                {
                  id: key + "-low",
                  label: calibration.label + " · low",
                  sourceId: key,
                  role: "low"
                }
              ),
              mid: accretionCalibrationPoint(
                p,
                geometricMid,
                {
                  id: key + "-mid",
                  label: calibration.label + " · geometric mid",
                  sourceId: key,
                  role: "mid"
                }
              ),
              high: accretionCalibrationPoint(
                p,
                calibration.maxMsunPerYear,
                {
                  id: key + "-high",
                  label: calibration.label + " · high",
                  sourceId: key,
                  role: "high"
                }
              )
            }
          ];
        }
      )
    );

    const current = accretionCalibrationPoint(
      p,
      currentMsunPerYear,
      {
        id: "current",
        label: "Current Ṁ",
        role: "current"
      }
    );
    const legacy = accretionCalibrationPoint(
      p,
      legacyMsunPerYear,
      {
        id: "legacy",
        label: "AxionBH legacy Ṁ",
        role: "legacy"
      }
    );

    return {
      currentMsunPerYear,
      legacyMsunPerYear,
      current,
      legacy,
      ranges,
      legacyToEhtLow:
        legacyMsunPerYear /
        ACCRETION_CALIBRATIONS.eht2023.minMsunPerYear,
      legacyToEhtHigh:
        legacyMsunPerYear /
        ACCRETION_CALIBRATIONS.eht2023.maxMsunPerYear,
      points: [
        current,
        legacy,
        ranges.eht2023.low,
        ranges.eht2023.mid,
        ranges.eht2023.high,
        ranges.faraday2006.low,
        ranges.faraday2006.mid,
        ranges.faraday2006.high
      ]
    };
  }


  function riafRadialVelocityFracC(
    radiusRg,
    scaleHeightRatio,
    alpha
  ) {
    const radius = assertFinitePositive(
      Number(radiusRg),
      "radiusRg"
    );
    const h = assertFinitePositive(
      Number(scaleHeightRatio),
      "scaleHeightRatio"
    );
    const viscosity = assertFinitePositive(
      Number(alpha),
      "alpha"
    );
    const value =
      viscosity * h * h / Math.sqrt(radius);
    if (!(value > 0 && value < 1)) {
      throw new RangeError(
        "RIAF radial-velocity proxy must satisfy 0 < |v_r|/c < 1"
      );
    }
    return value;
  }

  function flowGeometryCalibrationPoint(
    input,
    {
      radiusRg,
      scaleHeightRatio,
      alpha,
      electronFractionYe,
      mdotMsunPerYear,
      id = "flow-point",
      label = "flow point"
    }
  ) {
    const p = normalizeParams(input);
    const radialVelocityFracC =
      riafRadialVelocityFracC(
        radiusRg,
        scaleHeightRatio,
        alpha
      );
    const parameters = normalizeParams({
      ...p,
      mdot: mdotGsFromMsunPerYear(
        mdotMsunPerYear
      ),
      electronDensityMode: 2,
      accretionRadiusRg: radiusRg,
      scaleHeightRatio,
      radialVelocityFracC,
      electronFractionYe
    });
    const flow = accretionElectronDensity(parameters);
    const plasma =
      finiteMassPlasmaDiagnostics(parameters);
    const result = cme(parameters);

    return {
      id,
      label,
      mdotMsunPerYear,
      radiusRg,
      scaleHeightRatio,
      alpha,
      radialVelocityFracC,
      electronFractionYe,
      parameters,
      flow,
      plasma,
      result,
      ratio511: result.ratio511,
      deficitDex: deficitOrders(
        result.ratio511,
        1
      )
    };
  }

  function flowGeometryCalibrationAnalysis(
    input,
    {
      mdotMsunPerYear = Math.sqrt(
        ACCRETION_CALIBRATIONS.eht2023
          .minMsunPerYear *
        ACCRETION_CALIBRATIONS.eht2023
          .maxMsunPerYear
      ),
      mapResolution = 7
    } = {}
  ) {
    const p = normalizeParams(input);
    const context = FLOW_GEOMETRY_CONTEXT;
    const radii = [
      context.radiusRg.min,
      context.radiusRg.max
    ];
    const heights = [
      context.scaleHeightRatio.min,
      context.scaleHeightRatio.max
    ];
    const alphas = [
      context.alpha.min,
      context.alpha.max
    ];
    const electronFractions = [
      context.electronFractionYe.min,
      context.electronFractionYe.max
    ];

    const corners = [];
    for (const radiusRg of radii) {
      for (const scaleHeightRatio of heights) {
        for (const alpha of alphas) {
          for (const electronFractionYe of electronFractions) {
            corners.push(
              flowGeometryCalibrationPoint(
                p,
                {
                  radiusRg,
                  scaleHeightRatio,
                  alpha,
                  electronFractionYe,
                  mdotMsunPerYear,
                  id:
                    "r" + radiusRg +
                    "-h" + scaleHeightRatio +
                    "-a" + alpha +
                    "-ye" + electronFractionYe,
                  label: "RIAF envelope corner"
                }
              )
            );
          }
        }
      }
    }

    const finiteCorners = corners.filter(
      (point) =>
        Number.isFinite(point.ratio511) &&
        point.ratio511 > 0 &&
        Number.isFinite(point.deficitDex)
    );
    finiteCorners.sort(
      (a, b) => a.deficitDex - b.deficitDex
    );
    const best = finiteCorners[0] || null;
    const worst =
      finiteCorners[finiteCorners.length - 1] ||
      null;

    const reference =
      flowGeometryCalibrationPoint(
        p,
        {
          radiusRg: 10,
          scaleHeightRatio: 1,
          alpha: 0.2,
          electronFractionYe: 0.85,
          mdotMsunPerYear,
          id: "riaf-reference",
          label: "RIAF reference"
        }
      );

    const currentGeometry = {
      ...p,
      mdot: mdotGsFromMsunPerYear(
        mdotMsunPerYear
      ),
      electronDensityMode: 2
    };
    const currentResult = cme(currentGeometry);
    const currentFlow =
      accretionElectronDensity(currentGeometry);
    const currentPlasma =
      finiteMassPlasmaDiagnostics(currentGeometry);
    const current = {
      id: "current-geometry",
      label: "Current explicit geometry",
      mdotMsunPerYear,
      radiusRg: p.accretionRadiusRg,
      scaleHeightRatio:
        p.scaleHeightRatio,
      alpha: null,
      radialVelocityFracC:
        p.radialVelocityFracC,
      electronFractionYe:
        p.electronFractionYe,
      parameters: normalizeParams(
        currentGeometry
      ),
      flow: currentFlow,
      plasma: currentPlasma,
      result: currentResult,
      ratio511: currentResult.ratio511,
      deficitDex: deficitOrders(
        currentResult.ratio511,
        1
      )
    };

    const count = Math.max(
      4,
      Math.min(12, Math.trunc(mapResolution))
    );
    const mapRadii = logSpace(
      context.radiusRg.min,
      context.radiusRg.max,
      count
    );
    const mapHeights = linearSpace(
      context.scaleHeightRatio.min,
      context.scaleHeightRatio.max,
      count
    );
    const mapAlpha =
      Math.sqrt(
        context.alpha.min *
        context.alpha.max
      );
    const mapYe = 0.85;
    const map = [];

    for (const scaleHeightRatio of mapHeights) {
      const row = [];
      for (const radiusRg of mapRadii) {
        row.push(
          flowGeometryCalibrationPoint(
            p,
            {
              radiusRg,
              scaleHeightRatio,
              alpha: mapAlpha,
              electronFractionYe: mapYe,
              mdotMsunPerYear,
              id: "map",
              label: "RIAF map"
            }
          )
        );
      }
      map.push(row);
    }

    return {
      mdotMsunPerYear,
      context,
      reference,
      current,
      corners,
      best,
      worst,
      geometryLeverageDex:
        best && worst
          ? worst.deficitDex - best.deficitDex
          : null,
      densityLeverageDex:
        best && worst
          ? Math.abs(
              Math.log10(
                best.flow.netElectronDensityCm3 /
                worst.flow.netElectronDensityCm3
              )
            )
          : null,
      map: {
        radiusRg: mapRadii,
        scaleHeightRatio: mapHeights,
        alpha: mapAlpha,
        electronFractionYe: mapYe,
        deficitDex: map.map((row) =>
          row.map((point) => point.deficitDex)
        ),
        densityCm3: map.map((row) =>
          row.map(
            (point) =>
              point.flow.netElectronDensityCm3
          )
        )
      }
    };
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
      const plasma = finiteMassPlasmaDiagnostics(p);
      add(
        "info",
        "finite_mass_cve",
        "CVE source uses the free massive-Dirac bulk coefficient at the resolved electron vector chemical potential μ_V.",
        plasma.suppression
      );
      add(
        "info",
        "electron_density_closure",
        plasma.accretionClosureActive
          ? "μ_V is solved from an accretion-continuity estimate of net electron density, then inverted through a massive ideal Fermi gas."
          : plasma.densityClosureActive
            ? "μ_V is solved from the selected net electron density n(e−)-n(e+) using a massive ideal Fermi gas."
            : "μ_V is manual; the code reports the implied ideal-gas net electron density for comparison.",
        plasma.resolvedNetDensityCm3
      );
      if (plasma.accretionClosureActive && plasma.accretion) {
        add(
          "info",
          "accretion_density_closure",
          "Accretion density uses the steady thick-disk continuity proxy mdot = 4π r H rho |v_r|; H/r, v_r/c and Y_e are explicit model inputs.",
          plasma.accretion.netElectronDensityCm3
        );
        const mdotContext =
          mdotMsunPerYearFromGs(p.mdot);
        const ehtContext = classifyAccretionRate(
          mdotContext,
          ACCRETION_CALIBRATIONS.eht2023
        );
        add(
          "info",
          "accretion_literature_context",
          ehtContext.relation === "within"
            ? "Current Ṁ lies inside the EHT 2023 promising GRMHD cluster range; that cluster is model-dependent and not a universal observational bound."
            : "Current Ṁ lies " + ehtContext.relation +
              " the EHT 2023 promising GRMHD cluster by a factor of " +
              ehtContext.factorToNearestBound.toExponential(2) +
              " relative to the nearest range edge; this is context, not a hard exclusion.",
          mdotContext
        );
      }
      add(
        thermalToElectronMass >= 1 ? "info" : "warning",
        "massless_fermion_regime",
        thermalToElectronMass >= 1
          ? "T ≳ m_e: finite-mass correction is moderate; Chirality Lab massless susceptibility is still an approximation."
          : "T << m_e: finite-mass CVE is applied in the closure, while the Chirality Lab susceptibility remains a massless structural diagnostic.",
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


  const MODEL_LAYERS = Object.freeze([
    "geometry",
    "accretion",
    "electron_plasma",
    "anomalous_transport",
    "axion_chiral_coupling",
    "stationary_closure",
    "chirality_dynamics",
    "positron_luminosity"
  ]);

  function modelValidityReport(
    input,
    mode = "cme",
    result = null
  ) {
    const p = normalizeParams(input);
    const r = result || simulate(mode, p);
    const plasma =
      mode === "cme"
        ? finiteMassPlasmaDiagnostics(p)
        : null;
    const accretion =
      plasma && plasma.accretionClosureActive
        ? plasma.accretion
        : null;

    const layers = [
      {
        id: "geometry",
        category: "analytic",
        title: "Kerr geometry",
        state: "implemented",
        detail:
          "r_g, r_+, ergosphere scale and Omega_H are algebraic Kerr relations."
      },
      {
        id: "accretion",
        category:
          p.electronDensityMode === 2
            ? "phenomenological"
            : "external-input",
        title: "Accretion plasma",
        state:
          p.electronDensityMode === 2
            ? "active closure"
            : "not closed from flow",
        detail:
          p.electronDensityMode === 2
            ? "Steady thick-disk continuity proxy with explicit r/r_g, H/r, |v_r|/c and Y_e."
            : "Electron density or chemical potential is supplied independently of an accretion-flow model."
      },
      {
        id: "electron_plasma",
        category: "idealized",
        title: "Electron Fermi gas",
        state: "implemented",
        detail:
          "Massive ideal Fermi-Dirac gas maps net electron density and vector chemical potential."
      },
      {
        id: "anomalous_transport",
        category: "literature-model",
        title: "CVE / CME transport",
        state: "implemented",
        detail:
          "Finite-mass free-Dirac axial CVE base coefficient; magnetic CME is reported separately."
      },
      {
        id: "axion_chiral_coupling",
        category: "phenomenological",
        title: "Axion → μ5 coupling",
        state: "model ansatz",
        detail:
          "The q_mu relation, turbulent enhancement and its normalization are AxionBH assumptions, not derived from the plasma closure."
      },
      {
        id: "stationary_closure",
        category: "phenomenological",
        title: "Stationary CVE closure",
        state: "model ansatz",
        detail:
          "Quadratic self-consistency and the a/M = 0.35 gate are implementation assumptions."
      },
      {
        id: "chirality_dynamics",
        category: "diagnostic-proxy",
        title: "Chirality dynamics",
        state: "diagnostic only",
        detail:
          "S_proxy = |J5,CVE|/L_eff and massless axial susceptibility are not a finite-mass kinetic derivation."
      },
      {
        id: "positron_luminosity",
        category: "phenomenological",
        title: "μ5 → positron luminosity",
        state: "model ansatz",
        detail:
          "kappa = mu5/m_p and L = kappa mdot c^2 are not a derived pair-production calculation."
      }
    ];

    return {
      modelVersion: MODEL_VERSION,
      stateSchemaVersion: STATE_SCHEMA_VERSION,
      legacyModeKey:
        mode === "cme" ? "cme" : null,
      mode,
      activePlasmaClosure:
        plasma ? plasma.densityClosureMode : null,
      ratio511:
        Number(r && r.ratio511),
      accretion,
      layers
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
    MODEL_VERSION,
    STATE_SCHEMA_VERSION,
    MODEL_LAYERS,
    ACCRETION_CALIBRATIONS,
    FLOW_GEOMETRY_CONTEXT,
    CONSTANTS,
    DEFAULTS,
    positronRateFromPower,
    positronObservableFromPower,
    microphysicsAudit,
    schwingerPairRateDensity,
    pairProductionVolume,
    schwingerPairProduction,
    inferSchwingerFieldForObservedRate,
    pairProductionAudit,
    statvoltPerCmToVoltPerCm,
    blackHoleRotationalField,
    gapParallelElectricField,
    gapElectrodynamicsAudit,
    PRESETS,
    mdotGsFromMsunPerYear,
    mdotMsunPerYearFromGs,
    classifyAccretionRate,
    accretionCalibrationPoint,
    accretionCalibrationAnalysis,
    riafRadialVelocityFracC,
    flowGeometryCalibrationPoint,
    flowGeometryCalibrationAnalysis,
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
    fermiDerivativeKernel,
    accretionElectronDensity,
    fermiOccupation,
    naturalDensityToCm3,
    densityCm3ToNatural,
    electronPairDensitiesNatural,
    electronNetDensityNatural,
    electronNetDensityCm3,
    electronChemicalPotentialFromDensity,
    resolveElectronVectorChemicalPotential,
    electronDensityClosureSweep,
    massiveCveDimensionlessIntegral,
    massiveAxialVorticalConductivity,
    masslessAxialVorticalReference,
    finiteMassPlasmaDiagnostics,
    finiteMassPlasmaSweep,
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
    modelValidityReport,
    SENSITIVITY_KEYS,
    formatScientific,
    formatDuration
  });
});

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
        "CME closure решается после явного перевода B, T, Ω, m_eff и L_eff в natural units (ℏ=c=k_B=1)."
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
            ? "Устойчивая CME-ветвь удовлетворяет самосогласованному уравнению."
            : "Относительный residual устойчивой CME-ветви выше 1e-10.",
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
    sensitivityAnalysis,
    comparePresets,
    diagnoseRun,
    SENSITIVITY_KEYS,
    formatScientific,
    formatDuration
  });
});

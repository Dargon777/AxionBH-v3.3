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
    P_M: 1.8
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

  function mu5FromA(aBar, B, temperature, faGev, betaTurb) {
    if (!Number.isFinite(aBar) || aBar <= 0) return 0;
    const c = CONSTANTS;
    const faErg = assertFinitePositive(faGev, "faGev") * c.ERG_PER_GEV;
    const thermal = c.KB * assertFinitePositive(temperature, "temperature");
    const ct = turbulentFactor(B, temperature, betaTurb);
    return (aBar / faErg) * (c.MU_B * B / thermal) * ct;
  }

  function chiralConductivity(mu5, temperature) {
    const c = CONSTANTS;
    const thermal = c.KB * assertFinitePositive(temperature, "temperature");
    const prefactor = (thermal * thermal) / Math.pow(c.HBAR * c.C, 3);
    const chemical = (mu5 * mu5) / (2 * Math.PI * Math.PI);
    const thermalTerm =
      Math.pow(Math.PI * thermal, 2) / (6 * Math.PI * Math.PI);
    const result = prefactor * (chemical + thermalTerm);
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

  function selfConsistencyRhs(aBar, p) {
    const massG = p.massSolar * CONSTANTS.MSUN;
    const geometry = kerrGeometry(massG, p.spin);
    const mu5 = mu5FromA(aBar, p.B0, p.temperature, p.faGev, p.betaTurb);
    const sigma5 = chiralConductivity(mu5, p.temperature);
    const faErg = p.faGev * CONSTANTS.ERG_PER_GEV;
    const source = sigma5 * geometry.omegaH * geometry.rErgEquator * 1.2;
    const denominator = faErg * p.mEff * p.mEff + 1e-300;
    const rhs = source / denominator;
    return Number.isFinite(rhs) ? rhs : Number.POSITIVE_INFINITY;
  }

  function selfConsistencyResidual(aBar, p) {
    const rhs = selfConsistencyRhs(aBar, p);
    if (!Number.isFinite(rhs)) return Number.NEGATIVE_INFINITY;
    return aBar - rhs;
  }

  function bisectRoot(fn, low, high, iterations = 90) {
    let fl = fn(low);
    let fh = fn(high);
    if (!Number.isFinite(fl) && !Number.isFinite(fh)) return null;
    if (fl === 0) return low;
    if (fh === 0) return high;
    if (Math.sign(fl) === Math.sign(fh)) return null;

    for (let i = 0; i < iterations; i += 1) {
      const mid = Math.sqrt(low * high);
      const fm = fn(mid);
      if (fm === 0 || Math.abs(Math.log(high / low)) < 1e-12) return mid;
      if (Math.sign(fm) === Math.sign(fl)) {
        low = mid;
        fl = fm;
      } else {
        high = mid;
        fh = fm;
      }
    }
    return Math.sqrt(low * high);
  }

  function findCloud(input) {
    const p = normalizeParams(input);
    if (p.spin < CONSTANTS.SPIN_THRESHOLD) return 0;

    const residual = (x) => selfConsistencyResidual(x, p);
    const roots = [];
    let previousX = 1e-32;
    let previousF = residual(previousX);

    for (let i = 1; i <= 320; i += 1) {
      const exponent = -32 + (i / 320) * 44;
      const x = Math.pow(10, exponent);
      const fx = residual(x);

      if (Number.isFinite(previousF) || Number.isFinite(fx)) {
        if (Math.sign(previousF) !== Math.sign(fx)) {
          const root = bisectRoot(residual, previousX, x);
          if (root && Number.isFinite(root) && root > 1e-30) roots.push(root);
        }
      }
      previousX = x;
      previousF = fx;
    }

    if (!roots.length) return 0;
    return Math.max(...roots);
  }

  function cme(input) {
    const p = normalizeParams(input);
    const massG = p.massSolar * CONSTANTS.MSUN;
    const geometry = kerrGeometry(massG, p.spin);

    if (p.spin < CONSTANTS.SPIN_THRESHOLD) {
      return {
        mode: "cme",
        aBar: 0,
        mu5: 0,
        kappa: 0,
        luminosity: 0,
        ratio511: 0,
        avgB: averageMagneticField(p.B0, geometry, p.nProfile),
        geometry,
        thresholdPassed: false
      };
    }

    const aBar = findCloud(p);
    const avgB = averageMagneticField(p.B0, geometry, p.nProfile);
    const mu5 = mu5FromA(aBar, avgB, p.temperature, p.faGev, p.betaTurb);
    const kappa = mu5 / (CONSTANTS.MP * CONSTANTS.C * CONSTANTS.C);
    const luminosity = kappa * p.mdot * CONSTANTS.C * CONSTANTS.C;
    const safeLuminosity = Number.isFinite(luminosity) && luminosity > 0
      ? luminosity
      : 0;

    return {
      mode: "cme",
      aBar,
      mu5,
      kappa: Number.isFinite(kappa) && kappa > 0 ? kappa : 0,
      luminosity: safeLuminosity,
      ratio511: safeLuminosity / CONSTANTS.L_OBS_511,
      avgB,
      geometry,
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
        mode: "hybrid",
        ...sr,
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
      mode: "hybrid",
      ...sr,
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
    mu5FromA,
    chiralConductivity,
    averageMagneticField,
    selfConsistencyResidual,
    findCloud,
    cme,
    manualBosenova,
    superradiant,
    hybrid,
    simulate,
    spinSweep,
    formatScientific,
    formatDuration
  });
});

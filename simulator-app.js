(() => {
  "use strict";

  const A = window.AxionBH;
  const $ = (id) => document.getElementById(id);
  const USER_PRESETS_KEY = "axionbh-user-presets-v1";

  const state = {
    lastResult: null,
    lastParams: null,
    lastMode: "cme",
    analysis: "spin",
    userPresets: [],
    explorerCache: new Map()
  };

  const modeNames = {
    cme: "CVE closure / stationary cloud",
    bosenova: "Bosenova / manual bursts",
    superradiant: "Scalar superradiant growth",
    hybrid: "Superradiant + Bosenova"
  };

  const parameterLabels = {
    massSolar: "M",
    spin: "a/M",
    B0: "B₀",
    betaTurb: "β_turb",
    faGev: "fₐ",
    mEff: "m_eff",
    mdot: "Ṁ",
    temperature: "T",
    electronMuMeV: "μ_V(e)",
    electronDensityMode: "plasma closure",
    electronDensityCm3: "nₑ,net",
    accretionRadiusRg: "r/r_g",
    radialVelocityFracC: "|v_r|/c",
    scaleHeightRatio: "H/r",
    electronFractionYe: "Y_e",
    nProfile: "n",
    axionMassEv: "mₐ",
    burstEnergy: "E_burst",
    burstIntervalYears: "Δt_burst",
    burstDuration: "t_burst",
    burstEfficiency: "ε_pair",
    superradianceSeedOccupation: "N_seed"
  };

  const parameterIds = [
    "massSolar", "spin", "B0", "betaTurb", "faGev", "mEff", "mdot",
    "temperature", "electronMuMeV", "electronDensityMode",
    "electronDensityCm3", "accretionRadiusRg",
    "radialVelocityFracC", "scaleHeightRatio",
    "electronFractionYe", "nProfile", "axionMassEv", "burstEnergy",
    "burstIntervalYears", "burstDuration", "burstEfficiency",
    "superradianceSeedOccupation"
  ];

  function n(id) {
    return Number($(id).value);
  }

  function params() {
    const out = {};
    parameterIds.forEach((id) => { out[id] = n(id); });
    return A.normalizeParams(out);
  }

  function displayInput(value) {
    const v = Number(value);
    if (!Number.isFinite(v)) return "—";
    if ((Math.abs(v) >= 1e5 || (Math.abs(v) > 0 && Math.abs(v) < 1e-3))) {
      return v.toExponential(2);
    }
    return String(Number(v.toPrecision(5)));
  }

  function setValue(id, value) {
    const element = $(id);
    if (!element) return;
    element.value = value;
    const output = $(id + "Out");
    if (output) output.textContent = displayInput(value);
  }

  function applyParameters(values) {
    Object.entries(values || {}).forEach(([key, value]) => {
      if ($(key) && Number.isFinite(Number(value))) setValue(key, Number(value));
    });
  }

  function loadUserPresets() {
    try {
      const parsed = JSON.parse(localStorage.getItem(USER_PRESETS_KEY) || "[]");
      if (!Array.isArray(parsed)) return [];
      return parsed
        .filter((item) =>
          item &&
          typeof item.id === "string" &&
          typeof item.name === "string" &&
          typeof item.mode === "string" &&
          item.params &&
          typeof item.params === "object"
        )
        .slice(0, 20);
    } catch {
      return [];
    }
  }

  function persistUserPresets() {
    localStorage.setItem(
      USER_PRESETS_KEY,
      JSON.stringify(state.userPresets.slice(0, 20))
    );
  }

  function refreshPresetOptions(selectedValue) {
    const select = $("preset");
    [...select.querySelectorAll('option[data-user="true"]')].forEach((option) =>
      option.remove()
    );

    state.userPresets.forEach((preset) => {
      const option = document.createElement("option");
      option.value = "user:" + preset.id;
      option.textContent = "★ " + preset.name;
      option.dataset.user = "true";
      select.appendChild(option);
    });

    if (selectedValue && [...select.options].some((o) => o.value === selectedValue)) {
      select.value = selectedValue;
    }
    updatePresetButtons();
  }

  function updatePresetButtons() {
    $("deletePresetBtn").disabled = !$("preset").value.startsWith("user:");
  }

  function selectPreset(value) {
    if (value === "custom") {
      updatePresetButtons();
      return;
    }

    if (value.startsWith("user:")) {
      const id = value.slice(5);
      const saved = state.userPresets.find((item) => item.id === id);
      if (!saved) return;
      applyParameters(saved.params);
      $("mode").value = saved.mode;
      updateConditionalFields();
      updatePresetButtons();
      run();
      return;
    }

    const preset = A.PRESETS[value];
    if (!preset) return;
    applyParameters(preset);
    updatePresetButtons();
    run();
  }

  function saveUserPreset() {
    let name = window.prompt("Preset name:");
    if (!name) return;
    name = name.trim().slice(0, 48);
    if (!name) return;

    let p;
    try {
      p = params();
    } catch (error) {
      return toast(error.message || String(error));
    }

    const existing = state.userPresets.find(
      (item) => item.name.toLocaleLowerCase() === name.toLocaleLowerCase()
    );
    const record = {
      id: existing ? existing.id : String(Date.now()),
      name,
      mode: $("mode").value,
      params: p
    };

    if (existing) {
      state.userPresets = state.userPresets.map((item) =>
        item.id === existing.id ? record : item
      );
    } else {
      state.userPresets.unshift(record);
      state.userPresets = state.userPresets.slice(0, 20);
    }

    persistUserPresets();
    refreshPresetOptions("user:" + record.id);
    toast("Preset saved locally.");
  }

  function deleteUserPreset() {
    const value = $("preset").value;
    if (!value.startsWith("user:")) return;
    const id = value.slice(5);
    state.userPresets = state.userPresets.filter((item) => item.id !== id);
    persistUserPresets();
    refreshPresetOptions("custom");
    toast("Preset deleted.");
  }

  function markCustom() {
    if (!$("preset").value.startsWith("user:")) {
      $("preset").value = "custom";
    }
    updatePresetButtons();
  }

  function updateConditionalFields() {
    const mode = $("mode").value;
    $("bosenovaFields").classList.toggle(
      "hidden",
      !["bosenova", "hybrid"].includes(mode)
    );
    $("axionMassField").classList.toggle(
      "hidden",
      !["superradiant", "hybrid"].includes(mode)
    );
    $("superradianceFields").classList.toggle(
      "hidden",
      !["superradiant", "hybrid"].includes(mode)
    );
    $("conversionEfficiencyField").classList.toggle(
      "hidden",
      mode === "cme"
    );
    $("burstManualFields").classList.toggle("hidden", mode !== "bosenova");

    const plasmaMode =
      Number($("electronDensityMode").value);
    $("electronMuMeV").disabled = plasmaMode !== 0;
    $("electronDensityCm3").disabled = plasmaMode !== 1;
    [
      "accretionRadiusRg",
      "radialVelocityFracC",
      "scaleHeightRatio",
      "electronFractionYe"
    ].forEach((id) => {
      $(id).disabled = plasmaMode !== 2;
    });
  }

  function formatRatio(value) {
    const v = Number(value);
    if (!Number.isFinite(v)) return "—";
    if (v === 0) return "0 ×";
    if (v >= 0.01 && v < 1000) return v.toPrecision(4) + " ×";
    return A.formatScientific(v, 3) + " ×";
  }

  function formatPercent(value) {
    if (!Number.isFinite(value)) return "—";
    const pct = value * 100;
    return (pct >= 0 ? "+" : "") + pct.toFixed(Math.abs(pct) < 10 ? 2 : 1) + "%";
  }

  function primaryMetrics(result) {
    if (result.mode === "cme") {
      return [
        ["ā", A.formatScientific(result.aBar) + " GeV", "stable natural-unit branch"],
        ["κ", A.formatScientific(result.kappa), "conversion efficiency"],
        ["P_proxy", A.formatScientific(result.luminosity) + " erg/s", "phenomenological energy-budget power"],
        ["Ṅₑ₊,eq", A.formatScientific(result.equivalentPositronRate) + " s⁻¹", "energy-budget equivalent"],
        ["e⁺ budget / target", formatRatio(result.ratio511), "target 2×10⁴³ e⁺/s"]
      ];
    }
    if (result.mode === "bosenova") {
      return [
        ["Eₑ₊ / burst", A.formatScientific(result.convertedEnergy) + " erg", "energy after efficiency"],
        ["Nₑ₊ / burst", A.formatScientific(result.positronsPerBurst), "positron-count estimate"],
        ["⟨L⟩", A.formatScientific(result.averageLuminosity) + " erg/s", "average luminosity"],
        ["⟨L⟩ / L₅₁₁", formatRatio(result.ratio511), "relative to observed"]
      ];
    }
    if (result.mode === "superradiant") {
      return [
        ["α", A.formatScientific(result.alpha), "gravitational coupling"],
        ["SR gate", result.superradiantCondition ? "OPEN" : "CLOSED", "ω_R < mΩ_H"],
        ["Γ₂₁₁", A.formatScientific(result.gamma) + " s⁻¹", "small-α literature fit"],
        ["e⁺ budget / target", formatRatio(result.ratio511), "phenomenological conversion"]
      ];
    }
    return [
      ["α", A.formatScientific(result.alpha), "gravitational coupling"],
      ["t_sat", A.formatDuration(result.saturationTime), "growth time"],
      ["⟨L_burst⟩", A.formatScientific(result.averageLuminosity) + " erg/s", "cycle average"],
      ["⟨L⟩ / L₅₁₁", formatRatio(result.ratio511), "relative to observed"]
    ];
  }

  function detailedRows(result) {
    const rows = [["Mode", modeNames[result.mode]]];
    if (result.mode === "cme") {
      rows.push(
        ["Spin threshold", result.thresholdPassed ? "passed" : "not passed (a/M < 0.35)"],
        ["Average B in ergosphere", A.formatScientific(result.avgB) + " G"],
        ["ā", A.formatScientific(result.aBar) + " GeV"],
        ["μ₅", A.formatScientific(result.mu5) + " GeV"],
        ["η₅ = μ₅/T", A.formatScientific(result.eta5)],
        ["Electron plasma closure",
          result.closure && result.closure.electronDensityMode === 2
            ? "Ṁ → nₑ,net → μ_V"
            : result.closure && result.closure.electronDensityMode === 1
              ? "nₑ,net → μ_V"
              : "manual μ_V"],
        ["μ_V(e), resolved", result.closure ? A.formatScientific(result.closure.electronMuMeV) + " MeV" : "—"],
        ["nₑ,net, resolved", result.closure ? A.formatScientific(result.closure.resolvedElectronDensityCm3) + " cm⁻³" : "—"],
        ["e⁺ / e⁻", result.closure ? A.formatScientific(result.closure.positronFraction) : "—"],
        ["Accretion ρ", result.closure && result.closure.accretion ? A.formatScientific(result.closure.accretion.massDensityGcm3) + " g/cm³" : "—"],
        ["Inflow time", result.closure && result.closure.accretion ? A.formatDuration(result.closure.accretion.inflowTimeSeconds) : "—"],
        ["Finite-mass CVE suppression", result.closure ? A.formatScientific(result.closure.finiteMassSuppression) : "—"],
        ["σ_CVE,base", result.closure ? A.formatScientific(result.closure.cveBaseCoefficient) + " GeV²" : "—"],
        ["Closure D", result.closure ? A.formatScientific(result.closure.discriminant) : "—"],
        ["Fixed-point slope", result.closure ? A.formatScientific(result.closure.stableSlope) : "—"],
        ["r₊", A.formatScientific(result.geometry.rPlus) + " cm"],
        ["Ω_H", A.formatScientific(result.geometry.omegaH) + " s⁻¹"],
        ["Lₑ₊", A.formatScientific(result.luminosity) + " erg/s"],
        ["Lₑ₊ / Lobs", formatRatio(result.ratio511)]
      );
    } else if (result.mode === "bosenova") {
      rows.push(
        ["Converted energy", A.formatScientific(result.convertedEnergy) + " erg"],
        ["Average e⁺ rate", A.formatScientific(result.averageRate) + " s⁻¹"],
        ["Average luminosity", A.formatScientific(result.averageLuminosity) + " erg/s"],
        ["Peak luminosity", A.formatScientific(result.burstLuminosity) + " erg/s"],
        ["Interval", A.formatDuration(result.intervalSeconds)]
      );
    } else {
      rows.push(
        ["Level", result.level || "211"],
        ["Superradiance active", result.active ? "yes" : "no"],
        ["Condition ω_R < mΩ_H", result.superradiantCondition ? "satisfied" : "not satisfied"],
        ["α", A.formatScientific(result.alpha)],
        ["ω_R M", A.formatScientific(result.omegaRDimensionless)],
        ["Ω_H M", A.formatScientific(result.horizonOmegaDimensionless)],
        ["Critical spin", result.criticalSpin == null ? "—" : A.formatScientific(result.criticalSpin)],
        ["Growth bracket", A.formatScientific(result.growthBracket)],
        ["Γ₂₁₁", A.formatScientific(result.gamma) + " s⁻¹"],
        ["e-fold", A.formatDuration(result.eFoldTime)],
        ["N_seed", A.formatScientific(result.seedOccupation)],
        ["N_sat", A.formatScientific(result.saturationOccupation)],
        ["Number of e-folds", A.formatScientific(result.eFoldCount)],
        ["Cloud-mass fraction at saturation", A.formatScientific(result.saturationFraction)],
        ["Saturation", A.formatDuration(result.saturationTime)]
      );
      if (result.mode === "superradiant") {
        rows.push(
          ["Cloud energy at saturation", A.formatScientific(result.cloudEnergyErg) + " erg"],
          ["ΓE_cloud proxy", A.formatScientific(result.growthPowerAtSaturationProxy) + " erg/s"],
          ["Average extraction power", A.formatScientific(result.averageExtractionPower) + " erg/s"],
          ["ε_pair", A.formatScientific(result.conversionEfficiency)],
          ["Positron-power proxy", A.formatScientific(result.positronPower) + " erg/s"]
        );
      } else {
        rows.push(
          ["Burst energy", A.formatScientific(result.burstEnergy) + " erg"],
          ["Converted energy", A.formatScientific(result.convertedEnergy) + " erg"],
          ["Average luminosity", A.formatScientific(result.averageLuminosity) + " erg/s"],
          ["Peak luminosity", A.formatScientific(result.burstLuminosity) + " erg/s"]
        );
      }
    }
    return rows;
  }


  function runStateId(mode, p) {
    const ordered = {};
    parameterIds.forEach((key) => {
      ordered[key] = Number(p[key]);
    });
    const source = JSON.stringify({
      model: "AxionBH-v8.9.1",
      mode,
      parameters: ordered
    });
    let hash = 2166136261;
    for (let i = 0; i < source.length; i += 1) {
      hash ^= source.charCodeAt(i);
      hash = Math.imul(hash, 16777619);
    }
    return "ax7-" + (hash >>> 0).toString(16).padStart(8, "0");
  }

  function currentDiagnostics() {
    if (!state.lastResult || !state.lastParams) return null;
    return A.diagnoseRun(
      state.lastMode,
      state.lastParams,
      state.lastResult
    );
  }

  function renderDiagnostics(result) {
    const p = state.lastParams || params();
    const diagnostics = A.diagnoseRun(result.mode, p, result);
    const stateId = runStateId(result.mode, p);
    const labels = {
      ok: "OK",
      warning: "WARN",
      error: "ERROR",
      info: "INFO"
    };

    const items = diagnostics.checks.map((item) => {
      const value =
        item.value !== null && Number.isFinite(Number(item.value))
          ? '<span class="diag-value">' +
            A.formatScientific(Number(item.value), 2) +
            '</span>'
          : "";
      return '<div class="diag-item diag-' + item.level + '">' +
        '<span class="diag-level">' + (labels[item.level] || item.level) + '</span>' +
        '<span class="diag-message">' + item.message + '</span>' +
        value +
        '</div>';
    }).join("");

    $("diagnostics").innerHTML =
      '<div class="diagnostics-head">' +
      '<strong>Diagnostics</strong>' +
      '<span class="state-id" title="Deterministic identifier for the mode and parameter state">' +
      stateId + '</span>' +
      '</div>' +
      '<div class="diagnostics-list">' + items + '</div>';
  }

  function render(result) {
    $("emptyState").classList.add("hidden");
    $("resultArea").classList.remove("hidden");
    $("modeBadge").textContent = modeNames[result.mode];

    $("metricGrid").innerHTML = primaryMetrics(result)
      .map(([key, value, detail]) =>
        '<div class="metric"><span>' + key + '</span><strong>' +
        value + '</strong><small>' + detail + '</small></div>'
      )
      .join("");

    $("resultTable").innerHTML = detailedRows(result)
      .flatMap(([key, value]) => [
        '<div class="key">' + key + '</div>',
        '<div class="value">' + value + '</div>'
      ])
      .join("");

    const ratio = Number(result.ratio511 || 0);
    if (
      (result.mode === "superradiant" || result.mode === "hybrid") &&
      !result.superradiantCondition
    ) {
      $("interpretation").textContent =
        "Scalar 211 superradiance kinematically closed: ω_R ≥ mΩ_H. Γ is set to zero before any positron-conversion proxy.";
    } else {
      $("interpretation").textContent = ratio >= 1
        ? "At this point the implemented model reaches or exceeds the selected positron-rate target."
        : "At this point the implemented model remains below the selected positron-rate target.";
    }
    renderDiagnostics(result);
  }

  function themeColors() {
    const styles = getComputedStyle(document.documentElement);
    return {
      text: styles.getPropertyValue("--muted").trim() || "#94a3b8",
      grid: styles.getPropertyValue("--border").trim() || "#263347",
      accent: styles.getPropertyValue("--accent").trim() || "#7aa8ff",
      accent2: styles.getPropertyValue("--accent-2").trim() || "#9b8cff"
    };
  }

  function plotLayout(titleX, titleY) {
    const colors = themeColors();
    return {
      paper_bgcolor: "transparent",
      plot_bgcolor: "transparent",
      font: { color: colors.text },
      xaxis: { title: titleX, gridcolor: colors.grid, zerolinecolor: colors.grid },
      yaxis: { title: titleY, gridcolor: colors.grid, zerolinecolor: colors.grid },
      margin: { l: 70, r: 24, t: 24, b: 60 }
    };
  }

  function setAnalysisMeta(title, subtitle) {
    $("analysisTitle").textContent = title;
    $("analysisSubtitle").textContent = subtitle;
  }

  function setAnalysisTable(html) {
    const table = $("analysisTable");
    table.innerHTML = html || "";
    table.classList.toggle("hidden", !html);
  }

  function setAnalysisBusy(busy) {
    $("analysisBusy").classList.toggle("hidden", !busy);
  }

  function renderSpinAnalysis() {
    const p = params();
    const points = A.spinSweep(p, 72);
    setAnalysisMeta("κ as a function of spin", "CVE closure · logarithmic scale");
    setAnalysisTable("");

    if (!window.Plotly) return toast("Plotly did not load; the numerical calculations still work.");

    const layout = plotLayout("spin a/M", "κ");
    layout.yaxis.type = "log";
    layout.shapes = [{
      type: "line",
      x0: 0.35, x1: 0.35, y0: 0, y1: 1, yref: "paper",
      line: { dash: "dot", width: 1 }
    }];

    Plotly.react("plot", [{
      x: points.map((point) => point.spin),
      y: points.map((point) => point.kappa > 0 ? point.kappa : null),
      mode: "lines",
      line: { width: 3, color: themeColors().accent },
      hovertemplate: "a/M=%{x:.3f}<br>κ=%{y:.3e}<extra></extra>"
    }], layout, { responsive: true, displaylogo: false });
  }

  const referenceNames = {
    baseline: "Sgr A* · EHT-context baseline",
    legacy: "Legacy AxionBH baseline",
    breakthrough: "High-B breakthrough",
    optimistic: "Optimistic"
  };

  const explorerResolutions = {
    low: [14, 10],
    medium: [20, 15],
    high: [28, 20]
  };

  function explorerFaValue() {
    return Math.pow(10, Number($("explorerFaExp").value));
  }

  function updateExplorerFaLabel() {
    $("explorerFaOut").textContent =
      A.formatScientific(explorerFaValue(), 2);
  }

  function explorerResolution() {
    return explorerResolutions[$("explorerResolution").value] ||
      explorerResolutions.medium;
  }

  function logMetricMatrix(matrix) {
    return matrix.map((row) =>
      row.map((value) =>
        value !== null && value > 0 ? Math.log10(value) : null
      )
    );
  }

  function finiteValues(matrix) {
    return matrix.flat().filter((value) => Number.isFinite(value));
  }

  function finiteRange(...matrices) {
    const values = matrices.flatMap((matrix) => finiteValues(matrix));
    if (!values.length) return [-1, 1];
    const minimum = Math.min(...values);
    const maximum = Math.max(...values);
    if (minimum === maximum) {
      const padding = Math.max(0.5, Math.abs(minimum) * 0.05);
      return [minimum - padding, maximum + padding];
    }
    return [minimum, maximum];
  }

  function robustSymmetricRange(matrix) {
    const values = finiteValues(matrix)
      .map((value) => Math.abs(value))
      .sort((a, b) => a - b);
    if (!values.length) return 1;
    const index = Math.min(
      values.length - 1,
      Math.max(0, Math.floor(values.length * 0.95))
    );
    return Math.max(1, values[index]);
  }

  function explorerCacheKey(base, reference, faGev, resolution) {
    return JSON.stringify({
      base,
      reference,
      faGev,
      resolution
    });
  }

  function getExplorerComparison() {
    const current = params();
    const referenceKey = $("explorerReference").value;
    const reference = A.PRESETS[referenceKey] || A.PRESETS.baseline;
    const faGev = explorerFaValue();
    const [xCount, yCount] = explorerResolution();

    const modelA = { ...current, faGev };
    const modelB = { ...reference, faGev };
    const key = explorerCacheKey(
      modelA,
      referenceKey,
      faGev,
      [xCount, yCount]
    );

    if (state.explorerCache.has(key)) {
      return {
        referenceKey,
        faGev,
        resolution: [xCount, yCount],
        comparison: state.explorerCache.get(key)
      };
    }

    const comparison = A.compareParameterMaps(modelA, modelB, {
      mode: "cme",
      xValues: A.linearSpace(0.05, 0.998, xCount),
      yValues: A.logSpace(1, 2e5, yCount),
      metric: "ratio511"
    });

    state.explorerCache.set(key, comparison);
    while (state.explorerCache.size > 6) {
      state.explorerCache.delete(state.explorerCache.keys().next().value);
    }

    return {
      referenceKey,
      faGev,
      resolution: [xCount, yCount],
      comparison
    };
  }

  function explorerSummary(referenceKey, faGev, resolution, difference) {
    const finiteDiff = finiteValues(difference);
    const absolute = finiteDiff
      .map((value) => Math.abs(value))
      .sort((a, b) => a - b);
    const median = absolute.length
      ? absolute[Math.floor(absolute.length / 2)]
      : null;
    const maximum = absolute.length ? absolute[absolute.length - 1] : null;

    return [
      '<div class="explorer-summary">',
      '<div><span>Model A</span><strong>Current parameters</strong></div>',
      '<div><span>Model B</span><strong>' +
        (referenceNames[referenceKey] || referenceKey) + '</strong></div>',
      '<div><span>fₐ slice</span><strong>' +
        A.formatScientific(faGev, 2) + ' GeV</strong></div>',
      '<div><span>Grid</span><strong>' +
        resolution[0] + '×' + resolution[1] + '</strong></div>',
      '<div><span>Median |Δ|</span><strong>' +
        (median === null ? "—" : median.toFixed(2) + "%") + '</strong></div>',
      '<div><span>Max |Δ|</span><strong>' +
        (maximum === null ? "—" : maximum.toFixed(2) + "%") + '</strong></div>',
      '</div>'
    ].join("");
  }

  function surfaceLayout(colors, cmin, cmax) {
    const sceneBase = {
      bgcolor: "transparent",
      xaxis: {
        title: "spin a/M",
        color: colors.text,
        gridcolor: colors.grid
      },
      yaxis: {
        title: "B₀, G",
        type: "log",
        color: colors.text,
        gridcolor: colors.grid
      },
      zaxis: {
        title: "log₁₀ e⁺ budget ratio",
        color: colors.text,
        gridcolor: colors.grid
      },
      aspectmode: "cube"
    };

    return {
      paper_bgcolor: "transparent",
      font: { color: colors.text },
      margin: { l: 0, r: 0, t: 44, b: 0 },
      scene: {
        ...sceneBase,
        domain: { x: [0, 0.48], y: [0, 1] }
      },
      scene2: {
        ...sceneBase,
        domain: { x: [0.52, 1], y: [0, 1] }
      },
      annotations: [
        {
          text: "A · current",
          x: 0.24, y: 1.02, xref: "paper", yref: "paper",
          showarrow: false, font: { color: colors.text, size: 12 }
        },
        {
          text: "B · reference",
          x: 0.76, y: 1.02, xref: "paper", yref: "paper",
          showarrow: false, font: { color: colors.text, size: 12 }
        }
      ],
      showlegend: false,
      _cmin: cmin,
      _cmax: cmax
    };
  }

  function renderExplorerSurface(data) {
    const { comparison } = data;
    const zA = logMetricMatrix(comparison.mapA.z);
    const zB = logMetricMatrix(comparison.mapB.z);
    const [cmin, cmax] = finiteRange(zA, zB);
    const colors = themeColors();
    const layout = surfaceLayout(colors, cmin, cmax);
    delete layout._cmin;
    delete layout._cmax;

    Plotly.react("plot", [
      {
        type: "surface",
        scene: "scene",
        x: comparison.xValues,
        y: comparison.yValues,
        z: zA,
        customdata: comparison.mapA.z,
        cmin,
        cmax,
        colorscale: "Viridis",
        showscale: false,
        hovertemplate:
          "A<br>a/M=%{x:.3f}<br>B₀=%{y:.3e} G" +
          "<br>e⁺ budget ratio=%{customdata:.3e}<extra></extra>"
      },
      {
        type: "surface",
        scene: "scene2",
        x: comparison.xValues,
        y: comparison.yValues,
        z: zB,
        customdata: comparison.mapB.z,
        cmin,
        cmax,
        colorscale: "Viridis",
        showscale: true,
        colorbar: { title: "log₁₀ e⁺ budget ratio", len: 0.72 },
        hovertemplate:
          "B<br>a/M=%{x:.3f}<br>B₀=%{y:.3e} G" +
          "<br>e⁺ budget ratio=%{customdata:.3e}<extra></extra>"
      }
    ], layout, { responsive: true, displaylogo: false });
  }

  function renderExplorerContour(data) {
    const { comparison } = data;
    const zA = logMetricMatrix(comparison.mapA.z);
    const zB = logMetricMatrix(comparison.mapB.z);
    const [cmin, cmax] = finiteRange(zA, zB);
    const colors = themeColors();

    Plotly.react("plot", [
      {
        type: "contour",
        x: comparison.xValues,
        y: comparison.yValues,
        z: zA,
        customdata: comparison.mapA.z,
        xaxis: "x",
        yaxis: "y",
        zmin: cmin,
        zmax: cmax,
        colorscale: "Viridis",
        showscale: false,
        contours: { coloring: "heatmap", showlabels: false },
        hovertemplate:
          "A<br>a/M=%{x:.3f}<br>B₀=%{y:.3e} G" +
          "<br>e⁺ budget ratio=%{customdata:.3e}<extra></extra>"
      },
      {
        type: "contour",
        x: comparison.xValues,
        y: comparison.yValues,
        z: zB,
        customdata: comparison.mapB.z,
        xaxis: "x2",
        yaxis: "y2",
        zmin: cmin,
        zmax: cmax,
        colorscale: "Viridis",
        showscale: true,
        colorbar: { title: "log₁₀ e⁺ budget ratio", len: 0.75 },
        contours: { coloring: "heatmap", showlabels: false },
        hovertemplate:
          "B<br>a/M=%{x:.3f}<br>B₀=%{y:.3e} G" +
          "<br>e⁺ budget ratio=%{customdata:.3e}<extra></extra>"
      }
    ], {
      paper_bgcolor: "transparent",
      plot_bgcolor: "transparent",
      font: { color: colors.text },
      margin: { l: 68, r: 68, t: 42, b: 58 },
      xaxis: {
        domain: [0, 0.46],
        title: "spin a/M",
        gridcolor: colors.grid
      },
      yaxis: {
        title: "B₀, G",
        type: "log",
        gridcolor: colors.grid
      },
      xaxis2: {
        domain: [0.54, 1],
        title: "spin a/M",
        gridcolor: colors.grid
      },
      yaxis2: {
        anchor: "x2",
        title: "B₀, G",
        type: "log",
        gridcolor: colors.grid
      },
      annotations: [
        {
          text: "A · current",
          x: 0.23, y: 1.08, xref: "paper", yref: "paper",
          showarrow: false
        },
        {
          text: "B · reference",
          x: 0.77, y: 1.08, xref: "paper", yref: "paper",
          showarrow: false
        }
      ]
    }, { responsive: true, displaylogo: false });
  }

  function renderExplorerDifference(data) {
    const { comparison } = data;
    const difference = comparison.differencePercent;
    const cap = robustSymmetricRange(difference);
    const colors = themeColors();
    const layout = plotLayout("spin a/M", "B₀, G");
    layout.yaxis.type = "log";
    layout.margin.l = 78;

    Plotly.react("plot", [{
      type: "heatmap",
      x: comparison.xValues,
      y: comparison.yValues,
      z: difference,
      zmid: 0,
      zmin: -cap,
      zmax: cap,
      colorscale: "RdBu",
      reversescale: true,
      colorbar: { title: "Δ%, A vs B" },
      hovertemplate:
        "a/M=%{x:.3f}<br>B₀=%{y:.3e} G<br>Δ=%{z:.2f}%<extra></extra>"
    }], {
      ...layout,
      font: { color: colors.text }
    }, { responsive: true, displaylogo: false });
  }


  function explorerDeficitSummary(data) {
    const deficits = data.comparison.mapA.z.flat()
      .filter((value) => Number.isFinite(value) && value > 0)
      .map((value) => A.deficitOrders(value, 1))
      .filter((value) => Number.isFinite(value))
      .sort((a, b) => a - b);

    const minimum = deficits.length ? deficits[0] : null;
    const median = deficits.length
      ? deficits[Math.floor(deficits.length / 2)]
      : null;
    const maximum = deficits.length ? deficits[deficits.length - 1] : null;

    return [
      '<div class="explorer-summary">',
      '<div><span>Map</span><strong>Deficit to the e⁺ target</strong></div>',
      '<div><span>Model</span><strong>Current parameters</strong></div>',
      '<div><span>fₐ slice</span><strong>' +
        A.formatScientific(data.faGev, 2) + ' GeV</strong></div>',
      '<div><span>Best gap</span><strong>' +
        (minimum === null ? "—" : minimum.toFixed(2) + ' dex') +
        '</strong></div>',
      '<div><span>Median gap</span><strong>' +
        (median === null ? "—" : median.toFixed(2) + ' dex') +
        '</strong></div>',
      '<div><span>Worst finite</span><strong>' +
        (maximum === null ? "—" : maximum.toFixed(2) + ' dex') +
        '</strong></div>',
      '</div>'
    ].join("");
  }

  function renderExplorerDeficit(data) {
    const { comparison } = data;
    const deficit = comparison.mapA.z.map((row) =>
      row.map((value) =>
        Number.isFinite(value) && value > 0
          ? A.deficitOrders(value, 1)
          : null
      )
    );
    const values = finiteValues(deficit);
    const zmin = values.length ? Math.min(...values) : 0;
    const zmax = values.length ? Math.max(...values) : 1;
    const colors = themeColors();
    const layout = plotLayout("spin a/M", "B₀, G");
    layout.yaxis.type = "log";
    layout.margin.l = 78;

    Plotly.react("plot", [{
      type: "heatmap",
      x: comparison.xValues,
      y: comparison.yValues,
      z: deficit,
      customdata: comparison.mapA.z,
      zmin,
      zmax,
      colorscale: "Viridis",
      reversescale: true,
      colorbar: { title: "orders short" },
      hovertemplate:
        "a/M=%{x:.3f}<br>B₀=%{y:.3e} G" +
        "<br>e⁺ budget ratio=%{customdata:.3e}" +
        "<br>gap=%{z:.2f} dex<extra></extra>"
    }], {
      ...layout,
      font: { color: colors.text }
    }, { responsive: true, displaylogo: false });
  }

  function renderParameterExplorer() {
    const view = $("explorerView").value;
    setAnalysisMeta(
      view === "deficit" ? "CME deficit map" : "3D Parameter Explorer",
      view === "deficit"
        ? "Decimal orders separating the e⁺ budget ratio from unity; zero-output points have no finite log gap"
        : "CVE closure · spin × B₀ · fₐ defines the logarithmic slice; A and B use the same fₐ"
    );

    const data = getExplorerComparison();
    setAnalysisTable(
      view === "deficit"
        ? explorerDeficitSummary(data)
        : explorerSummary(
            data.referenceKey,
            data.faGev,
            data.resolution,
            data.comparison.differencePercent
          )
    );

    $("explorerReference").disabled = view === "deficit";

    if (!window.Plotly) {
      return toast("Plotly did not load; the grid was computed but cannot be rendered.");
    }

    if (view === "deficit") renderExplorerDeficit(data);
    else if (view === "difference") renderExplorerDifference(data);
    else if (view === "contour") renderExplorerContour(data);
    else renderExplorerSurface(data);
  }

  function renderSensitivity() {
    const mode = $("mode").value;
    const analysis = A.sensitivityAnalysis(mode, params(), {
      fraction: 0.1,
      metric: "ratio511"
    });

    setAnalysisMeta(
      "Sensitivity ±10%",
      modeNames[mode] + " · e⁺ budget-ratio response to a one-parameter perturbation"
    );

    const rows = analysis.rows;
    const html = [
      '<div class="analysis-row analysis-row-head"><span>Parameter</span><span>−10%</span><span>+10%</span><span>Elasticity</span></div>',
      ...rows.map((row) =>
        '<div class="analysis-row"><strong>' +
        (parameterLabels[row.key] || row.key) +
        '</strong><span>' + formatPercent(row.minusRelative) +
        '</span><span>' + formatPercent(row.plusRelative) +
        '</span><span>' +
        (Number.isFinite(row.elasticity) ? row.elasticity.toFixed(3) : "—") +
        '</span></div>'
      )
    ].join("");
    setAnalysisTable(html);

    if (!window.Plotly) return;
    const layout = plotLayout("parameter", "max |Δ(e⁺ budget ratio)|, %");
    Plotly.react("plot", [{
      type: "bar",
      x: rows.map((row) => parameterLabels[row.key] || row.key),
      y: rows.map((row) => row.impact * 100),
      marker: { color: themeColors().accent },
      hovertemplate: "%{x}<br>impact=%{y:.2f}%<extra></extra>"
    }], layout, { responsive: true, displaylogo: false });
  }


  function inferenceStatus(row) {
    if (row.status === "solved") {
      return '<span class="inference-status solved">TARGET</span>';
    }
    return '<span class="inference-status unreachable">UNREACHED</span>';
  }

  function inferenceResultValue(row) {
    const value =
      row.status === "solved" ? row.requiredValue : row.bestValue;
    return value === null ? "—" : A.formatScientific(value, 3);
  }

  function inferenceFactor(row) {
    const factor =
      row.status === "solved" ? row.requiredFactor : row.bestFactor;
    if (!Number.isFinite(factor) || factor <= 0) return "—";
    return A.formatScientific(factor, 3) + "×";
  }

  function renderInference() {
    if ($("mode").value !== "cme") {
      setAnalysisMeta(
        "Parameter Inference",
        "The v8.9 inverse solver is currently defined for the CVE closure"
      );
      setAnalysisTable(
        '<div class="inference-empty">Switch to the CVE closure to estimate the deficit and required one-parameter shifts.</div>'
      );
      if (window.Plotly) Plotly.purge("plot");
      return;
    }

    const analysis = A.parameterInference("cme", params(), {
      target: 1,
      metric: "ratio511",
      steps: 280
    });

    setAnalysisMeta(
      "Parameter Inference",
      "One-parameter inverse scan to e⁺ budget ratio = 1 · scan ranges are diagnostic, not physical priors"
    );

    const deficit = analysis.deficitOrders;
    const gain = analysis.requiredGain;
    const rows = analysis.rows;

    const summary = [
      '<div class="inference-summary">',
      '<div><span>Current e⁺ budget ratio</span><strong>' +
        A.formatScientific(analysis.currentMetric, 3) + '</strong></div>',
      '<div><span>Deficit</span><strong>' +
        (Number.isFinite(deficit) ? deficit.toFixed(2) + ' dex' : '∞') +
        '</strong></div>',
      '<div><span>Generic gain needed</span><strong>' +
        (Number.isFinite(gain) ? A.formatScientific(gain, 3) + '×' : '∞') +
        '</strong></div>',
      '</div>'
    ].join("");

    const table = [
      '<div class="analysis-row analysis-row-head inference"><span>Parameter</span><span>Current</span><span>Required / best</span><span>Shift</span><span>Outcome</span></div>',
      ...rows.map((row) => {
        const remaining = row.status === "solved"
          ? "0 dex"
          : (Number.isFinite(row.remainingDeficitOrders)
              ? row.remainingDeficitOrders.toFixed(2) + " dex short"
              : "∞");
        return '<div class="analysis-row inference"><strong>' +
          (parameterLabels[row.key] || row.key) +
          '</strong><span>' + A.formatScientific(row.currentValue, 3) +
          '</span><span>' + inferenceResultValue(row) +
          '</span><span>' + inferenceFactor(row) +
          '</span><span>' + inferenceStatus(row) + ' ' + remaining +
          '</span></div>';
      })
    ].join("");

    setAnalysisTable(summary + table);

    if (!window.Plotly) return;
    const layout = plotLayout(
      "one varied parameter",
      "remaining deficit, dex"
    );
    layout.yaxis.rangemode = "tozero";
    Plotly.react("plot", [{
      type: "bar",
      x: rows.map((row) => parameterLabels[row.key] || row.key),
      y: rows.map((row) =>
        row.status === "solved"
          ? 0
          : (Number.isFinite(row.remainingDeficitOrders)
              ? Math.max(0, row.remainingDeficitOrders)
              : null)
      ),
      customdata: rows.map((row) => [
        row.status,
        row.status === "solved" ? row.requiredValue : row.bestValue,
        row.status === "solved" ? row.requiredFactor : row.bestFactor
      ]),
      marker: { color: themeColors().accent2 },
      hovertemplate:
        "%{x}<br>remaining=%{y:.2f} dex" +
        "<br>status=%{customdata[0]}" +
        "<br>value=%{customdata[1]:.3e}" +
        "<br>factor=%{customdata[2]:.3e}×<extra></extra>"
    }], layout, { responsive: true, displaylogo: false });
  }


  const missingPlacementNames = {
    source: "Closure source",
    chiral: "Axion → μ₅ coupling",
    conversion: "Post-closure e⁺ conversion"
  };

  function missingGainValue() {
    return Math.pow(10, Number($("missingGainExp").value));
  }

  function updateMissingGainLabel() {
    $("missingGainOut").textContent =
      A.formatScientific(missingGainValue(), 2) + "×";
  }

  function missingPhysicsRow(row) {
    if (row.placement === "conversion") {
      return '<div class="analysis-row missing"><strong>' +
        missingPlacementNames[row.placement] +
        '</strong><span>SOLVABLE</span><span>' +
        A.formatScientific(row.requiredGain, 3) + '×</span><span>' +
        A.formatScientific(row.achievedMetric, 3) +
        '</span></div>';
    }

    return '<div class="analysis-row missing"><strong>' +
      missingPlacementNames[row.placement] +
      '</strong><span>CEILING</span><span>' +
      A.formatScientific(row.criticalGain, 3) + '×</span><span>' +
      row.remainingDeficitOrders.toFixed(2) + ' dex short</span></div>';
  }


  function renderTransport() {
    if ($("mode").value !== "cme") {
      setAnalysisMeta(
        "Anomalous Transport",
        "CVE/CME decomposition is currently tied to the stationary axion closure"
      );
      setAnalysisTable(
        '<div class="inference-empty">Switch to the CVE closure. This analysis compares currents and does not automatically convert them into a 511-keV observable.</div>'
      );
      if (window.Plotly) Plotly.purge("plot");
      return;
    }

    const p = params();
    const result = A.cme(p);
    const transport = A.anomalousTransportDiagnostics(p, result);

    setAnalysisMeta(
      "Anomalous Transport",
      "Axial CVE: massive free-Dirac base + legacy μ₅² term · magnetic CME: j ∥ B"
    );

    const ratioText = Number.isFinite(transport.magnitudeRatio)
      ? A.formatScientific(transport.magnitudeRatio, 3)
      : "—";
    const chemicalShare = Number.isFinite(transport.chemicalFraction)
      ? (100 * transport.chemicalFraction).toExponential(2) + "%"
      : "—";

    const summary = [
      '<div class="transport-summary">',
      '<div><span>μ₅</span><strong>' +
        A.formatScientific(transport.mu5, 3) + ' GeV</strong></div>',
      '<div><span>⟨B⟩</span><strong>' +
        A.formatScientific(transport.fieldG, 3) + ' G</strong></div>',
      '<div><span>ω</span><strong>' +
        A.formatScientific(transport.omegaGeV, 3) + ' GeV</strong></div>',
      '<div><span>|J₅,CVE|</span><strong>' +
        A.formatScientific(Math.abs(transport.jCVE), 3) + ' GeV³</strong></div>',
      '<div><span>|jCME|</span><strong>' +
        A.formatScientific(Math.abs(transport.jCME), 3) + ' GeV³</strong></div>',
      '<div><span>|CME/CVE|</span><strong>' + ratioText + '</strong></div>',
      '<div><span>mass suppression</span><strong>' +
        A.formatScientific(
          transport.finiteMassSuppression,
          3
        ) + '</strong></div>',
      '</div>'
    ].join("");

    const table = [
      '<div class="analysis-row analysis-row-head transport"><span>Channel</span><span>Current type</span><span>Direction</span><span>Coefficient</span></div>',
      '<div class="analysis-row transport"><strong>Axial CVE</strong><span>axial J₅</span><span>∥ ω</span><span>T²/6 + μ₅²/(2π²)</span></div>',
      '<div class="analysis-row transport"><strong>Magnetic CME</strong><span>vector/electric j</span><span>∥ B</span><span>e² μ₅/(2π²)</span></div>'
    ].join("");

    const note =
      '<div class="missing-note"><strong>Not summed into the 511-keV observable:</strong> ' +
      'these are distinct currents with different directions and quantum numbers. ' +
      'Without a dedicated geometry, kinetic model, relaxation treatment, and pair-production closure, ' +
      'converting jCME into positron luminosity would be unjustified. ' +
      'In the current CVE coefficient, the μ₅²-term fraction = ' +
      chemicalShare + '.</div>';

    setAnalysisTable(summary + table + note);

    if (!window.Plotly) return;

    const sweep = A.anomalousTransportSweep(p, {
      xKey: "B0",
      values: A.logSpace(1, 2e5, 100)
    });
    const valid = sweep.points.filter((point) =>
      Number.isFinite(point.jCVE) &&
      Number.isFinite(point.jCME) &&
      point.jCVE > 0 &&
      point.jCME > 0
    );

    const colors = themeColors();
    const layout = plotLayout("B₀, G", "log₁₀ |J|, GeV³");
    layout.xaxis.type = "log";
    Plotly.react("plot", [
      {
        type: "scatter",
        mode: "lines",
        name: "Axial CVE",
        x: valid.map((point) => point.value),
        y: valid.map((point) => Math.log10(Math.abs(point.jCVE))),
        line: { color: colors.accent, width: 2 },
        hovertemplate:
          "CVE<br>B₀=%{x:.3e} G<br>log₁₀|J|=%{y:.2f}<extra></extra>"
      },
      {
        type: "scatter",
        mode: "lines",
        name: "Magnetic CME",
        x: valid.map((point) => point.value),
        y: valid.map((point) => Math.log10(Math.abs(point.jCME))),
        line: { color: colors.accent2, width: 2 },
        hovertemplate:
          "CME<br>B₀=%{x:.3e} G<br>log₁₀|j|=%{y:.2f}<extra></extra>"
      }
    ], layout, { responsive: true, displaylogo: false });
  }


  function chiralityFlipRateValue() {
    return Math.pow(10, Number($("chiralityFlipExp").value));
  }

  function chiralityHorizonValue() {
    return Math.pow(10, Number($("chiralityTimeExp").value));
  }

  function chiralityElectricAlignment() {
    const mode = $("chiralityAnomalyMode").value;
    if (mode === "off") return 0;
    const magnitude =
      Math.pow(10, Number($("chiralityEExp").value));
    return mode === "sink" ? -magnitude : magnitude;
  }

  function updateChiralityLabels() {
    $("chiralityFlipOut").textContent =
      A.formatScientific(chiralityFlipRateValue(), 2);
    $("chiralityTimeOut").textContent =
      A.formatScientific(chiralityHorizonValue(), 2);
    $("chiralityEOut").textContent =
      A.formatScientific(
        Math.pow(10, Number($("chiralityEExp").value)),
        2
      );
  }

  function currentChiralityOptions() {
    return {
      flipRatePerSecond: chiralityFlipRateValue(),
      horizonSeconds: chiralityHorizonValue(),
      electricAlignment: chiralityElectricAlignment()
    };
  }


  function gapHeightValue() {
    return Math.pow(10, Number($("gapHeightExp").value));
  }

  function gapInjectionValue() {
    return Math.pow(10, Number($("gapInjectionExp").value));
  }

  function gapCurvatureValue() {
    return Math.pow(10, Number($("gapCurvatureExp").value));
  }

  function gapSoftMinValue() {
    return Math.pow(10, Number($("gapSoftMinExp").value));
  }

  function gapSoftMaxValue() {
    return Math.pow(10, Number($("gapSoftMaxExp").value));
  }

  function gapPhotonIndexValue() {
    return Number($("gapPhotonIndex").value);
  }

  function gapSoftLuminosityValue() {
    return Math.pow(10, Number($("gapSoftLumExp").value));
  }

  function currentGapOptions() {
    return {
      potentialModel: $("gapPotentialModel").value,
      gapHeightRg: gapHeightValue(),
      plasmaInjectionFraction: gapInjectionValue(),
      curvatureRadiusRg: gapCurvatureValue(),
      softPhotonMinEv: gapSoftMinValue(),
      softPhotonMaxEv: gapSoftMaxValue(),
      softPhotonIndex: gapPhotonIndexValue(),
      softPhotonLuminosityErgS: gapSoftLuminosityValue(),
      softPhotonBins: 48
    };
  }

  function updateGapLabels() {
    $("gapHeightOut").textContent =
      A.formatScientific(gapHeightValue(), 2);
    $("gapInjectionOut").textContent =
      A.formatScientific(gapInjectionValue(), 2);
    $("gapCurvatureOut").textContent =
      A.formatScientific(gapCurvatureValue(), 2);
    $("gapSoftMinOut").textContent =
      A.formatScientific(gapSoftMinValue(), 2);
    $("gapSoftMaxOut").textContent =
      A.formatScientific(gapSoftMaxValue(), 2);
    $("gapPhotonIndexOut").textContent =
      gapPhotonIndexValue().toFixed(2);
    $("gapSoftLumOut").textContent =
      A.formatScientific(gapSoftLuminosityValue(), 2);
  }


  function positronInjectionEnergyValue() {
    return Math.pow(10, Number($("positronInjectionExp").value));
  }

  function currentPositronOptions() {
    return {
      mode: $("mode").value,
      sourceKind: $("positronSourceKind").value,
      gapOptions: currentGapOptions(),
      transportModel: $("positronTransportModel").value,
      ismPhase: $("positronIsmPhase").value,
      propagationMode: $("positronPropagationMode").value,
      sourceEscapeFraction: Number($("positronEscape").value),
      smearingScalePc: Number($("positronSmearingPc").value),
      bulgeAcceptanceRadiusPc: Number($("positronBulgeRadiusPc").value),
      thermalizationSurvivalFraction: Number($("positronThermalization").value),
      annihilationFraction: Number($("positronAnnihilation").value),
      positroniumFraction: Number($("positroniumFraction").value),
      injectionEnergyMeV: positronInjectionEnergyValue(),
      D10GeVCm2S: Math.pow(10, Number($("positronLogD10").value)),
      diffusionDelta: Number($("positronDiffusionDelta").value),
      advectionKms: Number($("positronAdvectionKms").value),
      fieldLineDisplacementFraction:
        Math.pow(10, Number($("positronFieldLineExp").value)),
      effectiveThermalAnnihilationCoefficientCm3S:
        Math.pow(10, Number($("positronAnnCoeffExp").value))
    };
  }

  function updatePositronLabels() {
    $("positronEscapeOut").textContent =
      Number($("positronEscape").value).toFixed(2);
    $("positronSmearingOut").textContent =
      Number($("positronSmearingPc").value).toFixed(0);
    $("positronBulgeRadiusOut").textContent =
      Number($("positronBulgeRadiusPc").value).toFixed(0);
    $("positronThermalizationOut").textContent =
      Number($("positronThermalization").value).toFixed(2);
    $("positronAnnihilationOut").textContent =
      Number($("positronAnnihilation").value).toFixed(2);
    $("positroniumFractionOut").textContent =
      Number($("positroniumFraction").value).toFixed(2);
    $("positronInjectionOut").textContent =
      A.formatScientific(positronInjectionEnergyValue(), 2) + " MeV";
    $("positronLogD10Out").textContent =
      A.formatScientific(Math.pow(10, Number($("positronLogD10").value)), 2);
    $("positronDiffusionDeltaOut").textContent =
      Number($("positronDiffusionDelta").value).toFixed(2);
    $("positronAdvectionKmsOut").textContent =
      Number($("positronAdvectionKms").value).toFixed(0);
    $("positronFieldLineOut").textContent =
      A.formatScientific(Math.pow(10, Number($("positronFieldLineExp").value)), 2);
    $("positronAnnCoeffOut").textContent =
      A.formatScientific(Math.pow(10, Number($("positronAnnCoeffExp").value)), 2);
  }


  function renderPlasma() {
    if ($("mode").value !== "cme") {
      setAnalysisMeta(
        "Finite-Mass Plasma",
        "massive Dirac CVE diagnostic is attached to the stationary CVE closure"
      );
      setAnalysisTable(
        '<div class="inference-empty">Switch to the CVE closure.</div>'
      );
      if (window.Plotly) Plotly.purge("plot");
      return;
    }

    const p = params();
    const plasma = A.finiteMassPlasmaDiagnostics(p);
    const closureMode = plasma.accretionClosureActive
      ? "accretion closure"
      : plasma.densityClosureActive
        ? "density closure"
        : "manual μ_V";
    const suppressionDex =
      plasma.suppression > 0
        ? Math.log10(plasma.suppression)
        : -Infinity;
    const pairDex =
      plasma.pairSymmetricSuppression > 0
        ? Math.log10(plasma.pairSymmetricSuppression)
        : -Infinity;

    setAnalysisMeta(
      "Finite-Mass Plasma",
      "free massive Dirac bulk axial-CVE coefficient · μ_V is vector electron chemical potential"
    );

    const summary = [
      '<div class="plasma-summary">',
      '<div><span>mₑ/T</span><strong>' +
        A.formatScientific(plasma.massOverT, 3) + '</strong></div>',
      '<div><span>μ_V/T</span><strong>' +
        A.formatScientific(plasma.vectorMuOverT, 3) + '</strong></div>',
      '<div><span>closure</span><strong>' +
        closureMode + '</strong></div>',
      '<div><span>nₑ,net</span><strong>' +
        A.formatScientific(
          plasma.resolvedNetDensityCm3,
          3
        ) + ' cm⁻³</strong></div>',
      '<div><span>σ massive</span><strong>' +
        A.formatScientific(plasma.sigmaMassive, 3) +
        ' GeV²</strong></div>',
      '<div><span>σ massless ref</span><strong>' +
        A.formatScientific(plasma.sigmaMassless, 3) +
        ' GeV²</strong></div>',
      '<div><span>suppression</span><strong>' +
        A.formatScientific(plasma.suppression, 3) + '</strong></div>',
      '<div><span>log₁₀ suppression</span><strong>' +
        (Number.isFinite(suppressionDex)
          ? suppressionDex.toFixed(2)
          : "−∞") + ' dex</strong></div>',
      '<div><span>e⁺ / e⁻</span><strong>' +
        A.formatScientific(
          plasma.positronFraction,
          3
        ) + '</strong></div>',
      '</div>'
    ].join("");

    const table = [
      '<div class="analysis-row analysis-row-head plasma"><span>Case</span><span>μ_V(e)</span><span>Suppression</span><span>Interpretation</span></div>',
      '<div class="analysis-row plasma"><strong>Selected</strong><span>' +
        A.formatScientific(plasma.vectorMuMeV, 3) +
        ' MeV</span><span>' +
        A.formatScientific(plasma.suppression, 3) +
        '</span><span>' +
        closureMode + '; nₑ,net=' +
        A.formatScientific(
          plasma.resolvedNetDensityCm3,
          3
        ) + ' cm⁻³</span></div>',
      '<div class="analysis-row plasma"><strong>Pair-symmetric</strong><span>0 MeV</span><span>' +
        A.formatScientific(
          plasma.pairSymmetricSuppression,
          3
        ) +
        '</span><span>' +
        (Number.isFinite(pairDex)
          ? pairDex.toFixed(2) + ' dex'
          : 'underflow') +
        ' vs massless T²/6</span></div>'
    ].join("");

    const note =
      '<div class="missing-note"><strong>Scope:</strong> the coefficient is the free massive-Dirac bulk linear-response CVE at vector chemical potential μ_V. In accretion-closure mode μ_V is derived from a steady continuity proxy; the flow geometry and velocity remain explicit assumptions. The nonlinear μ₅² term in the AxionBH closure remains the legacy massless ansatz and is reported separately.</div>';

    setAnalysisTable(summary + table + note);

    if (!window.Plotly) return;

    const selectedDensity =
      plasma.resolvedNetDensityCm3 > 0
        ? plasma.resolvedNetDensityCm3
        : 1e7;
    const minDensity = Math.max(
      1e-6,
      selectedDensity / 1e8
    );
    const maxDensity = Math.max(
      1e20,
      selectedDensity * 1e8
    );
    const sweep = A.electronDensityClosureSweep(
      p,
      {
        minDensityCm3: minDensity,
        maxDensityCm3: Math.min(1e40, maxDensity),
        points: 56
      }
    );
    const valid = sweep.points.filter((point) =>
      Number.isFinite(point.muMeV) &&
      point.muMeV >= 0
    );
    const colors = themeColors();
    const layout = plotLayout(
      "nₑ,net, cm⁻³",
      "μ_V(e), MeV"
    );
    layout.xaxis.type = "log";

    Plotly.react("plot", [{
      type: "scatter",
      mode: "lines",
      x: valid.map((point) => point.netDensityCm3),
      y: valid.map((point) => point.muMeV),
      customdata: valid.map((point) =>
        point.suppression
      ),
      line: { color: colors.accent2, width: 2 },
      hovertemplate:
        "nₑ,net=%{x:.3e} cm⁻³" +
        "<br>μ_V=%{y:.6f} MeV" +
        "<br>suppression=%{customdata:.3e}" +
        "<extra></extra>"
    }, {
      type: "scatter",
      mode: "markers",
      x: [selectedDensity],
      y: [plasma.vectorMuMeV],
      marker: { size: 10, color: colors.accent },
      hovertemplate:
        "selected<br>nₑ,net=%{x:.3e} cm⁻³" +
        "<br>μ_V=%{y:.6f} MeV<extra></extra>"
    }], layout, {
      responsive: true,
      displaylogo: false
    });
  }



  function calibrationRow(point, sourceLabel) {
    return '<div class="analysis-row calibration">' +
      '<strong>' + point.label + '</strong>' +
      '<span>' + A.formatScientific(
        point.mdotMsunPerYear,
        3
      ) + '</span>' +
      '<span>' + A.formatScientific(
        point.flow.netElectronDensityCm3,
        3
      ) + '</span>' +
      '<span>' + A.formatScientific(
        point.plasma.vectorMuMeV,
        3
      ) + '</span>' +
      '<span>' + A.formatScientific(
        point.plasma.suppression,
        3
      ) + '</span>' +
      '<span>' + A.formatScientific(
        point.ratio511,
        3
      ) + '</span>' +
      '<span>' + (
        Number.isFinite(point.deficitDex)
          ? point.deficitDex.toFixed(2) + " dex"
          : "∞"
      ) + '</span>' +
      '<span>' + (sourceLabel || "current") + '</span>' +
      '</div>';
  }

  function renderAccretionCalibration() {
    if ($("mode").value !== "cme") {
      setAnalysisMeta(
        "Sgr A* Accretion Calibration",
        "Calibration is evaluated through the stationary CVE + accretion-plasma chain"
      );
      setAnalysisTable(
        '<div class="inference-empty">Switch to the CVE closure.</div>'
      );
      if (window.Plotly) Plotly.purge("plot");
      return;
    }

    const analysis =
      A.accretionCalibrationAnalysis(params());
    const eht = analysis.ranges.eht2023;
    const rm = analysis.ranges.faraday2006;
    const currentRelation = eht.currentRelation;

    setAnalysisMeta(
      "Sgr A* Accretion Calibration",
      "Literature ranges are contextual model/conditional constraints, not a single adopted truth"
    );

    const summary = [
      '<div class="calibration-summary">',
      '<div><span>Current Ṁ</span><strong>' +
        A.formatScientific(
          analysis.currentMsunPerYear,
          3
        ) + ' M☉/yr</strong></div>',
      '<div><span>Legacy Ṁ</span><strong>' +
        A.formatScientific(
          analysis.legacyMsunPerYear,
          3
        ) + ' M☉/yr</strong></div>',
      '<div><span>EHT cluster</span><strong>' +
        A.formatScientific(
          eht.minMsunPerYear,
          2
        ) + '–' +
        A.formatScientific(
          eht.maxMsunPerYear,
          2
        ) + '</strong></div>',
      '<div><span>Current vs EHT</span><strong>' +
        currentRelation.relation + ' · ' +
        A.formatScientific(
          currentRelation.factorToNearestBound,
          2
        ) + '×</strong></div>',
      '<div><span>Legacy / EHT high</span><strong>' +
        A.formatScientific(
          analysis.legacyToEhtHigh,
          2
        ) + '×</strong></div>',
      '</div>'
    ].join("");

    const table = [
      '<div class="analysis-row analysis-row-head calibration"><span>Case</span><span>Ṁ, M☉/yr</span><span>nₑ,net cm⁻³</span><span>μ_V MeV</span><span>CVE suppression</span><span>e⁺ budget ratio</span><span>Deficit</span><span>Context</span></div>',
      calibrationRow(
        analysis.current,
        "current input · forced accretion closure"
      ),
      calibrationRow(
        analysis.legacy,
        "AxionBH legacy"
      ),
      calibrationRow(eht.low, "EHT 2023 low"),
      calibrationRow(eht.mid, "EHT 2023 geometric mid"),
      calibrationRow(eht.high, "EHT 2023 high"),
      calibrationRow(rm.low, "Faraday low"),
      calibrationRow(rm.high, "Faraday high")
    ].join("");

    const note =
      '<div class="missing-note"><strong>EHT 2023:</strong> ' +
      eht.caveat +
      '<br><strong>Faraday rotation:</strong> ' +
      rm.caveat +
      '<br>The same v8.0 accretion geometry (r/r_g, H/r, |v_r|/c, Y_e) is held fixed across rows so the table isolates Ṁ.</div>';

    setAnalysisTable(summary + table + note);

    if (!window.Plotly) return;

    const plotPoints = [
      analysis.legacy,
      eht.low,
      eht.mid,
      eht.high,
      rm.low,
      rm.high
    ].filter((point) =>
      Number.isFinite(point.deficitDex)
    );
    const colors = themeColors();
    const layout = plotLayout(
      "Ṁ, M☉/yr",
      "remaining deficit, dex"
    );
    layout.xaxis.type = "log";

    const yValues = plotPoints.map(
      (point) => point.deficitDex
    );
    const yMin = Math.max(
      0,
      Math.min(...yValues) - 3
    );
    const yMax = Math.max(...yValues) + 3;
    layout.shapes = [
      {
        type: "rect",
        x0: eht.minMsunPerYear,
        x1: eht.maxMsunPerYear,
        y0: yMin,
        y1: yMax,
        fillcolor: "rgba(120,120,120,0.10)",
        line: { width: 0 }
      },
      {
        type: "rect",
        x0: rm.minMsunPerYear,
        x1: rm.maxMsunPerYear,
        y0: yMin,
        y1: yMax,
        fillcolor: "rgba(120,120,120,0.05)",
        line: { width: 1, dash: "dot" }
      }
    ];
    layout.yaxis.range = [yMin, yMax];

    Plotly.react("plot", [
      {
        type: "scatter",
        mode: "markers+text",
        x: plotPoints.map(
          (point) => point.mdotMsunPerYear
        ),
        y: plotPoints.map(
          (point) => point.deficitDex
        ),
        text: plotPoints.map(
          (point) => point.id
        ),
        textposition: "top center",
        marker: {
          size: 10,
          color: colors.accent2
        },
        customdata: plotPoints.map((point) => [
          point.flow.netElectronDensityCm3,
          point.plasma.vectorMuMeV,
          point.ratio511
        ]),
        hovertemplate:
          "%{text}<br>Ṁ=%{x:.3e} M☉/yr" +
          "<br>deficit=%{y:.2f} dex" +
          "<br>nₑ=%{customdata[0]:.3e} cm⁻³" +
          "<br>μ_V=%{customdata[1]:.4f} MeV" +
          "<br>e⁺ budget ratio=%{customdata[2]:.3e}" +
          "<extra></extra>"
      },
      {
        type: "scatter",
        mode: "markers",
        x: [analysis.current.mdotMsunPerYear],
        y: [analysis.current.deficitDex],
        marker: {
          size: 12,
          color: colors.accent
        },
        name: "current",
        hovertemplate:
          "current<br>Ṁ=%{x:.3e} M☉/yr" +
          "<br>deficit=%{y:.2f} dex<extra></extra>"
      }
    ], layout, {
      responsive: true,
      displaylogo: false
    });
  }


  function flowGeometryRow(point, context) {
    return '<div class="analysis-row flow-geometry">' +
      '<strong>' + point.label + '</strong>' +
      '<span>' + A.formatScientific(
        point.radiusRg,
        3
      ) + '</span>' +
      '<span>' + A.formatScientific(
        point.scaleHeightRatio,
        3
      ) + '</span>' +
      '<span>' + (
        point.alpha === null
          ? "explicit"
          : A.formatScientific(point.alpha, 3)
      ) + '</span>' +
      '<span>' + A.formatScientific(
        point.radialVelocityFracC,
        3
      ) + '</span>' +
      '<span>' + A.formatScientific(
        point.electronFractionYe,
        3
      ) + '</span>' +
      '<span>' + A.formatScientific(
        point.flow.netElectronDensityCm3,
        3
      ) + '</span>' +
      '<span>' + A.formatScientific(
        point.ratio511,
        3
      ) + '</span>' +
      '<span>' + (
        Number.isFinite(point.deficitDex)
          ? point.deficitDex.toFixed(2) + " dex"
          : "∞"
      ) + '</span>' +
      '</div>';
  }

  function renderFlowGeometryCalibration() {
    if ($("mode").value !== "cme") {
      setAnalysisMeta(
        "Flow Geometry Calibration",
        "RIAF geometry envelope is evaluated through the stationary CVE accretion-plasma chain"
      );
      setAnalysisTable(
        '<div class="inference-empty">Switch to the CVE closure.</div>'
      );
      if (window.Plotly) Plotly.purge("plot");
      return;
    }

    const analysis =
      A.flowGeometryCalibrationAnalysis(
        params(),
        { mapResolution: 7 }
      );
    const best = analysis.best;
    const worst = analysis.worst;
    const context = analysis.context;

    setAnalysisMeta(
      "Flow Geometry Calibration",
      "EHT geometric-mid Ṁ held fixed · RIAF v_r/c = α(H/R)²/√(r/r_g)"
    );

    const summary = [
      '<div class="flow-summary">',
      '<div><span>Ṁ fixed</span><strong>' +
        A.formatScientific(
          analysis.mdotMsunPerYear,
          3
        ) + ' M☉/yr</strong></div>',
      '<div><span>Best deficit</span><strong>' +
        (best ? best.deficitDex.toFixed(2) : "—") +
        ' dex</strong></div>',
      '<div><span>Worst deficit</span><strong>' +
        (worst ? worst.deficitDex.toFixed(2) : "—") +
        ' dex</strong></div>',
      '<div><span>Geometry leverage</span><strong>' +
        A.formatScientific(
          analysis.geometryLeverageDex,
          3
        ) + ' dex</strong></div>',
      '<div><span>Density leverage</span><strong>' +
        A.formatScientific(
          analysis.densityLeverageDex,
          3
        ) + ' dex</strong></div>',
      '</div>'
    ].join("");

    const table = [
      '<div class="analysis-row analysis-row-head flow-geometry"><span>Case</span><span>r/r_g</span><span>H/r</span><span>α</span><span>|v_r|/c</span><span>Y_e</span><span>nₑ,net</span><span>e⁺ budget ratio</span><span>Deficit</span></div>',
      flowGeometryRow(
        analysis.current,
        context
      ),
      flowGeometryRow(
        analysis.reference,
        context
      ),
      best
        ? flowGeometryRow(
            {
              ...best,
              label: "Envelope best"
            },
            context
          )
        : "",
      worst
        ? flowGeometryRow(
            {
              ...worst,
              label: "Envelope worst"
            },
            context
          )
        : ""
    ].join("");

    const note =
      '<div class="missing-note"><strong>RIAF anchor:</strong> ' +
      context.source.statement +
      '<br><strong>Envelope:</strong> r/r_g=' +
      context.radiusRg.min + '–' +
      context.radiusRg.max + ', H/r=' +
      context.scaleHeightRatio.min + '–' +
      context.scaleHeightRatio.max +
      ', α=' + context.alpha.min + '–' +
      context.alpha.max + ', Y_e=' +
      context.electronFractionYe.min + '–' +
      context.electronFractionYe.max +
      '. Radius, the H/r lower edge and composition interval are exploratory, not observational confidence intervals.</div>';

    setAnalysisTable(summary + table + note);

    if (!window.Plotly) return;

    const colors = themeColors();
    const layout = plotLayout(
      "r / r_g",
      "H / r"
    );
    layout.xaxis.type = "log";

    Plotly.react("plot", [{
      type: "heatmap",
      x: analysis.map.radiusRg,
      y: analysis.map.scaleHeightRatio,
      z: analysis.map.deficitDex,
      colorbar: {
        title: "deficit<br>dex"
      },
      colorscale: "Viridis",
      hovertemplate:
        "r=%{x:.2f} r_g" +
        "<br>H/r=%{y:.2f}" +
        "<br>deficit=%{z:.2f} dex" +
        "<extra></extra>"
    }, {
      type: "scatter",
      mode: "markers",
      x: [analysis.reference.radiusRg],
      y: [analysis.reference.scaleHeightRatio],
      marker: {
        size: 10,
        color: colors.accent
      },
      name: "RIAF reference",
      hovertemplate:
        "RIAF reference<extra></extra>"
    }], layout, {
      responsive: true,
      displaylogo: false
    });
  }


  function renderMicrophysicsAudit() {
    if ($("mode").value !== "cme") {
      setAnalysisMeta("Microphysics Audit", "stationary CVE closure only");
      setAnalysisTable('<div class="inference-empty">Switch to the CVE closure.</div>');
      if (window.Plotly) Plotly.purge("plot");
      return;
    }
    const audit = A.microphysicsAudit(params());
    setAnalysisMeta(
      "Microphysics Audit",
      "dimensional observable fix + explicit phenomenological bridges"
    );
    const html = [
      '<div class="micro-summary">',
      '<div><span>Observed 511 quantity</span><strong>' +
        A.formatScientific(audit.observed511.valuePerSecond,3) +
        ' e⁺/s</strong></div>',
      '<div><span>Historical deficit</span><strong>' +
        audit.historicalDeficitDex.toFixed(2) + ' dex</strong></div>',
      '<div><span>Corrected deficit</span><strong>' +
        audit.correctedDeficitDex.toFixed(2) + ' dex</strong></div>',
      '<div><span>Dimensional correction</span><strong>' +
        audit.dimensionalCorrectionDex.toFixed(2) + ' dex</strong></div>',
      '</div>',
      '<div class="analysis-row analysis-row-head micro"><span>Bridge</span><span>Status</span><span>Current relation</span><span>Meaning</span></div>',
      '<div class="analysis-row micro"><strong>axion → μ₅</strong><span>phenomenological</span><span>' +
        audit.axionToMu5.modelRelation +
        '</span><span>' + audit.axionToMu5.warning + '</span></div>',
      '<div class="analysis-row micro"><strong>Derivative Cₑ=1</strong><span>literature-form benchmark</span><span>' +
        audit.axionToMu5.derivativeRelation +
        '</span><span>b₀=' +
        A.formatScientific(
          audit.axionToMu5.derivativeCe1PeakGeV,
          3
        ) + ' GeV; legacy/derivative=' +
        A.formatScientific(
          audit.axionToMu5.legacyToDerivativeRatio,
          3
        ) + '×</span></div>',
      '<div class="analysis-row micro"><strong>μ₅ → e⁺</strong><span>phenomenological energy proxy</span><span>' +
        audit.mu5ToPositrons.modelRelation +
        '</span><span>E_cost=' +
        A.formatScientific(audit.mu5ToPositrons.energyCostErg,3) +
        ' erg/e⁺; no microscopic pair-production rate is derived.</span></div>',
      '<div class="missing-note"><strong>Observable correction:</strong> the Galactic ~10⁴³ quantity is an annihilation/injection rate in e⁺/s, not an energy luminosity in erg/s. v8.9 therefore audits the corrected rate ratio separately; the legacy numerical e⁺ budget ratio fields remain untouched for backward reproducibility.</div>'
    ].join("");
    setAnalysisTable(html);
    if (!window.Plotly) return;
    const colors=themeColors();
    const layout=plotLayout("comparison","remaining deficit, dex");
    Plotly.react("plot",[{
      type:"bar",
      x:["legacy dimensional mismatch","rate-corrected proxy"],
      y:[audit.historicalDeficitDex,audit.correctedDeficitDex],
      marker:{color:colors.accent2},
      hovertemplate:"%{x}<br>%{y:.2f} dex<extra></extra>"
    }],layout,{responsive:true,displaylogo:false});
  }


  function renderPairProduction() {
    if ($("mode").value !== "cme") {setAnalysisMeta("Pair Production","Schwinger diagnostic");setAnalysisTable('<div class="inference-empty">Switch to the CVE closure.</div>');if(window.Plotly)Plotly.purge("plot");return;}
    const audit=A.pairProductionAudit(params()),req=audit.required;
    setAnalysisMeta("Explicit Pair Production","idealized constant-field Schwinger channel · 1 r_g shell");
    setAnalysisTable(['<div class="pair-summary">','<div><span>Ecrit</span><strong>'+A.formatScientific(audit.criticalFieldVcm,3)+' V/cm</strong></div>','<div><span>Required E/Ecrit</span><strong>'+A.formatScientific(req.electricFieldOverCritical,3)+'</strong></div>','<div><span>Required E</span><strong>'+A.formatScientific(req.electricFieldVcm,3)+' V/cm</strong></div>','<div><span>Min pair power</span><strong>'+A.formatScientific(audit.minimumObservedPairPowerErgS,3)+' erg/s</strong></div>','<div><span>Ṁc² / min pair power</span><strong>'+A.formatScientific(audit.energyBudgetRatio,3)+'×</strong></div>','</div>','<div class="missing-note"><strong>Interpretation:</strong> Schwinger production remains an explicit vacuum-QED channel. The v8.6 Gap tab now supplies a separate charge-starvation and analytic-potential cascade diagnostic; neither channel is a self-consistent GR plasma solution.</div>'].join(""));
    if(!window.Plotly)return;const xs=[],ys=[];for(let i=-4;i<=0.3;i+=0.08){const x=10**i,r=A.schwingerPairProduction(params(),{electricFieldVcm:x*audit.criticalFieldVcm});xs.push(x);ys.push(Math.log10(Math.max(r.rawRatio511,1e-320)));}
    const layout=plotLayout("E / Ecrit","log10(pair rate / observed)");layout.xaxis.type="log";Plotly.react("plot",[{type:"scatter",mode:"lines",x:xs,y:ys},{type:"scatter",mode:"markers",x:[req.electricFieldOverCritical],y:[0],marker:{size:11,color:themeColors().accent},name:"required"}],layout,{responsive:true,displaylogo:false});
  }


  function renderGapElectrodynamics() {
    if ($("mode").value !== "cme") {
      setAnalysisMeta("Gap / Pair Cascade","charge starvation → curvature/IC γ → γγ");
      setAnalysisTable('<div class="inference-empty">Switch to the CVE closure.</div>');
      if(window.Plotly)Plotly.purge("plot");
      return;
    }

    const options=currentGapOptions();
    const solve=$("gapClosureMode").value==="solve";
    const closure=solve
      ? A.solveGapClosure(params(),{...options,minGapHeightRg:1e-3,maxGapHeightRg:1,closureScanSteps:56})
      : null;
    const c=closure&&closure.closureAudit
      ? closure.closureAudit
      : A.radiativeGapCascadeAudit(params(),options);
    const starve=c.starvation;
    const balance=c.radiationBalance;
    const curv=c.curvaturePairMultiplicity;
    const ic=c.icPairMultiplicity;
    const resolvedHeight=closure&&closure.closureHeightRg
      ? closure.closureHeightRg
      : c.potential.gapHeightRg;

    setAnalysisMeta(
      "BH Gap v8.7",
      "spectral soft photons · KN inverse Compton · curvature · γγ · pair/GJ closure"
    );

    const closureText=solve
      ? (closure.status==="closure-found"
          ? "FOUND @ h="+A.formatScientific(closure.closureHeightRg,3)+" r_g"
          : "NOT FOUND in 10⁻³–1 r_g")
      : "manual h";

    const html=[
      '<div class="pair-summary">',
      '<div><span>closure</span><strong>'+closureText+'</strong></div>',
      '<div><span>gap state</span><strong>'+c.status+'</strong></div>',
      '<div><span>h / r_g</span><strong>'+A.formatScientific(resolvedHeight,3)+'</strong></div>',
      '<div><span>n_GJ</span><strong>'+A.formatScientific(starve.goldreichJulian.numberDensityCm3,3)+' cm⁻³</strong></div>',
      '<div><span>charge supply / n_GJ</span><strong>'+A.formatScientific(starve.supplyRatio,3)+'×</strong></div>',
      '<div><span>ΔV_gap</span><strong>'+A.formatScientific(c.potential.voltageV,3)+' V</strong></div>',
      '<div><span>γ_e</span><strong>'+A.formatScientific(balance.gamma,3)+'</strong></div>',
      '<div><span>radiation limit</span><strong>'+balance.limitingRegime+'</strong></div>',
      '<div><span>dominant cooling</span><strong>'+balance.dominantLoss+'</strong></div>',
      '<div><span>IC KN suppression</span><strong>'+A.formatScientific(balance.inverseCompton.effectiveKleinNishinaSuppression,3)+'</strong></div>',
      '<div><span>curvature pairs / primary</span><strong>'+A.formatScientific(curv,3)+'</strong></div>',
      '<div><span>IC pairs / primary</span><strong>'+A.formatScientific(ic,3)+'</strong></div>',
      '<div><span>total multiplicity</span><strong>'+A.formatScientific(c.multiplicityOneGeneration,3)+'</strong></div>',
      '<div><span>GJ refill</span><strong>'+A.formatScientific(c.closureSupplyRatio,3)+'×</strong></div>',
      '<div><span>pair channel</span><strong>'+c.dominantPairChannel+'</strong></div>',
      '<div><span>pair rate / bulge target</span><strong>'+A.formatScientific(c.pairRateToBulgeTarget,3)+'×</strong></div>',
      '</div>',
      '<div class="missing-note"><strong>Interpretation:</strong> v8.7 solves an algebraic gap-height closure using both one-generation pair multiplicity and a Goldreich–Julian refill proxy. The soft bath is now a power-law spectrum and IC cooling includes an approximate Klein–Nishina suppression. This is still not a time-dependent GRPIC solution.</div>'
    ].join("");
    setAnalysisTable(html);

    if(!window.Plotly)return;
    const scan=closure?closure.points:A.solveGapClosure(params(),{...options,minGapHeightRg:1e-3,maxGapHeightRg:1,closureScanSteps:56}).points;
    const xs=scan.map(x=>x.gapHeightRg);
    const ym=scan.map(x=>Math.log10(Math.max(x.multiplicityOneGeneration,1e-30)));
    const yr=scan.map(x=>Math.log10(Math.max(x.closureSupplyRatio,1e-30)));
    const yi=scan.map(x=>x.icFraction);
    const layout=plotLayout("h / r_g","closure diagnostic");
    layout.xaxis.type="log";
    layout.shapes=[{type:"line",x0:1e-3,x1:1,y0:0,y1:0,line:{dash:"dot"}}];
    Plotly.react("plot",[
      {type:"scatter",mode:"lines",name:"log₁₀ pair multiplicity",x:xs,y:ym},
      {type:"scatter",mode:"lines",name:"log₁₀ GJ refill",x:xs,y:yr},
      {type:"scatter",mode:"lines",name:"IC cooling fraction",x:xs,y:yi}
    ],layout,{responsive:true,displaylogo:false});
  }

  function renderAnnihilationPipeline() {
    const options=currentPositronOptions();
    const analysis=A.positronTransportPipeline(params(),options);
    const source=analysis.source;
    const ref=analysis.reference;
    const ism=analysis.ismTransport;
    const sourceStatus=source.status==="available"||source.status==="zero"
      ? source.status
      : "UNRESOLVED";
    setAnalysisMeta(
      "511-keV Observable Pipeline v8.9",
      analysis.transportModel==="ism-timescale"
        ? "source → ISM slowing / propagation → annihilation → positronium → line flux"
        : "legacy v8.8 manual transport factors"
    );

    const ismRows=ism?[
      '<div><span>ISM phase</span><strong>'+ism.phase.label+'</strong></div>',
      '<div><span>propagation</span><strong>'+ism.propagationMode+'</strong></div>',
      '<div><span>n_H</span><strong>'+A.formatScientific(ism.phase.hydrogenDensityCm3,3)+' cm⁻³</strong></div>',
      '<div><span>x_e</span><strong>'+A.formatScientific(ism.phase.ionizationFraction,3)+'</strong></div>',
      '<div><span>slowing time</span><strong>'+A.formatDuration(ism.slowingTimeSeconds)+'</strong></div>',
      '<div><span>field-line path</span><strong>'+A.formatScientific(ism.pathLengthPc,3)+' pc</strong></div>',
      '<div><span>D(E_inj)</span><strong>'+A.formatScientific(ism.diffusionCoefficientAtInjectionCm2S,3)+' cm²/s</strong></div>',
      '<div><span>diffusive σ</span><strong>'+A.formatScientific(ism.diffusionSigmaPc,3)+' pc</strong></div>',
      '<div><span>advection length</span><strong>'+A.formatScientific(ism.advectionDistancePc,3)+' pc</strong></div>',
      '<div><span>derived smearing</span><strong>'+A.formatScientific(ism.effectiveSmearingPc,3)+' pc</strong></div>',
      '<div><span>in-flight τ_ann</span><strong>'+A.formatScientific(ism.inFlightAnnihilationOpticalDepth,3)+'</strong></div>',
      '<div><span>in-flight survival</span><strong>'+A.formatScientific(ism.inFlightSurvivalFraction,3)+'</strong></div>',
      '<div><span>thermal t_ann</span><strong>'+A.formatDuration(ism.thermalAnnihilationTimeSeconds)+'</strong></div>',
      '<div><span>bulge escape time</span><strong>'+A.formatDuration(ism.bulgeEscapeTimeSeconds)+'</strong></div>',
      '<div><span>post-thermal annihilation</span><strong>'+A.formatScientific(ism.postThermalAnnihilationFraction,3)+'</strong></div>'
    ].join(""):"";

    const html=[
      '<div class="pair-summary">',
      '<div><span>source</span><strong>'+source.sourceKind+'</strong></div>',
      '<div><span>source status</span><strong>'+sourceStatus+'</strong></div>',
      '<div><span>transport model</span><strong>'+analysis.transportModel+'</strong></div>',
      '<div><span>production e⁺</span><strong>'+A.formatScientific(analysis.productionRatePerSecond,3)+' s⁻¹</strong></div>',
      '<div><span>source escape</span><strong>'+A.formatScientific(analysis.sourceEscapeFraction,3)+'</strong></div>',
      ismRows,
      '<div><span>bulge retention</span><strong>'+A.formatScientific(analysis.spatialRetentionFraction,3)+'</strong></div>',
      '<div><span>thermalisation survival</span><strong>'+A.formatScientific(analysis.thermalizationSurvivalFraction,3)+'</strong></div>',
      '<div><span>annihilation e⁺</span><strong>'+A.formatScientific(analysis.annihilationRatePerSecond,3)+' s⁻¹</strong></div>',
      '<div><span>f_Ps</span><strong>'+A.formatScientific(analysis.positronium.positroniumFraction,3)+'</strong></div>',
      '<div><span>511 photons / annihilation</span><strong>'+A.formatScientific(analysis.positronium.linePhotonsPerAnnihilation,3)+'</strong></div>',
      '<div><span>511 line photons</span><strong>'+A.formatScientific(analysis.linePhotonRatePerSecond,3)+' s⁻¹</strong></div>',
      '<div><span>predicted Earth flux</span><strong>'+A.formatScientific(analysis.lineFluxAtEarthPhCm2S,3)+' ph cm⁻² s⁻¹</strong></div>',
      '<div><span>line / observed bulge</span><strong>'+A.formatScientific(analysis.lineFluxToBulgeReference,3)+'×</strong></div>',
      '<div><span>smearing offset</span><strong>'+analysis.smearingOffsetSigma.toFixed(2)+'σ</strong></div>',
      '<div><span>injection energy</span><strong>'+A.formatScientific(analysis.injectionEnergyMeV,3)+' MeV</strong></div>',
      '<div><span>≤1.4 MeV diagnostic</span><strong>'+(analysis.injectionEnergyCompatibleWithSmearingScenario?'compatible':'tension')+'</strong></div>',
      '</div>',
      '<div class="missing-note"><strong>Interpretation:</strong> in v8.9 the default ISM mode derives spatial smearing, free-electron in-flight survival and post-thermal annihilation from phase density, a collisional slowing scale, diffusion/advection or field-line transport, and bulge escape. The low-energy diffusion law and effective thermal annihilation coefficient remain reduced-model inputs, not a full Monte-Carlo ISM calculation.</div>'
    ].join("");
    setAnalysisTable(html);

    if(!window.Plotly)return;
    const sweep=A.positronTransportSweep(params(),{
      ...options,
      injectionEnergyValuesMeV:A.logSpace(0.03,10,72),
      smearingValuesPc:A.linearSpace(25,600,72)
    });
    const colors=themeColors();
    if(sweep.xKey==="injectionEnergyMeV"){
      const layout=plotLayout("injection energy, MeV","effective transport smearing, pc");
      layout.xaxis.type="log";
      layout.shapes=[
        {type:"line",x0:0.03,x1:10,y0:100,y1:100,line:{dash:"dot",color:colors.muted}},
        {type:"line",x0:0.03,x1:10,y0:200,y1:200,line:{dash:"dot",color:colors.muted}}
      ];
      Plotly.react("plot",[{
        type:"scatter",mode:"lines",name:"derived smearing",
        x:sweep.points.map(p=>p.injectionEnergyMeV),
        y:sweep.points.map(p=>p.effectiveSmearingPc)
      }],layout,{responsive:true,displaylogo:false});
    }else{
      const layout=plotLayout("transport smearing, pc","fraction / observed ratio");
      layout.shapes=[
        {type:"line",x0:150,x1:150,y0:0,y1:1,line:{dash:"dash",color:colors.muted}}
      ];
      Plotly.react("plot",[
        {
          type:"scatter",mode:"lines",name:"bulge retention",
          x:sweep.points.map(p=>p.smearingScalePc),
          y:sweep.points.map(p=>p.spatialRetentionFraction)
        },
        {
          type:"scatter",mode:"lines",name:"511 flux / observed",
          x:sweep.points.map(p=>p.smearingScalePc),
          y:sweep.points.map(p=>p.lineFluxToBulgeReference)
        }
      ],layout,{responsive:true,displaylogo:false});
    }
  }

  function renderValidity() {
    const p = params();
    const mode = $("mode").value;
    const result = A.simulate(mode, p);
    const report = A.modelValidityReport(
      p,
      mode,
      result
    );

    setAnalysisMeta(
      "Model Validity / Layer Map",
      "What is derived within the adopted model, what is idealized, and what remains a phenomenological ansatz"
    );

    const summary = [
      '<div class="validity-summary">',
      '<div><span>Model</span><strong>AxionBH ' +
        report.modelVersion + '</strong></div>',
      '<div><span>State schema</span><strong>v' +
        report.stateSchemaVersion + '</strong></div>',
      '<div><span>Mode</span><strong>' +
        modeNames[mode] + '</strong></div>',
      '<div><span>Plasma closure</span><strong>' +
        (report.activePlasmaClosure || "n/a") +
        '</strong></div>',
      '</div>'
    ].join("");

    const rows = [
      '<div class="analysis-row analysis-row-head validity"><span>Layer</span><span>Category</span><span>State</span><span>What it means</span></div>',
      ...report.layers.map((layer) =>
        '<div class="analysis-row validity"><strong>' +
        layer.title +
        '</strong><span class="validity-tag ' +
        layer.category.replace(/[^a-z-]/g, "") +
        '">' + layer.category +
        '</span><span>' + layer.state +
        '</span><span>' + layer.detail +
        '</span></div>'
      )
    ].join("");

    const accretion = report.accretion
      ? '<div class="missing-note"><strong>Active accretion closure:</strong> ' +
        'r=' + A.formatScientific(report.accretion.radiusRg, 3) +
        ' r_g · H/r=' +
        A.formatScientific(report.accretion.scaleHeightRatio, 3) +
        ' · |v_r|/c=' +
        A.formatScientific(report.accretion.radialVelocityFracC, 3) +
        ' · Y_e=' +
        A.formatScientific(report.accretion.electronFractionYe, 3) +
        ' · nₑ,net=' +
        A.formatScientific(report.accretion.netElectronDensityCm3, 3) +
        ' cm⁻³.</div>'
      : '';

    setAnalysisTable(summary + rows + accretion);
    if (window.Plotly) Plotly.purge("plot");
  }

  function renderChirality() {
    if ($("mode").value !== "cme") {
      setAnalysisMeta(
        "Chirality Dynamics",
        "The n₅(t) diagnostic is defined for the stationary CVE closure"
      );
      setAnalysisTable(
        '<div class="inference-empty">Switch to the CVE closure. Chirality dynamics are not wired into the other luminosity branches.</div>'
      );
      if (window.Plotly) Plotly.purge("plot");
      return;
    }

    const analysis = A.chiralityDynamicsSeries(
      params(),
      currentChiralityOptions(),
      140
    );

    setAnalysisMeta(
      "Chirality Dynamics",
      "dn₅/dt = S_proxy + C_A E·B − Γ_flip n₅ · exact constant-coefficient evolution"
    );

    const eqMu = analysis.equilibriumMu5 === null
      ? "no finite eq"
      : A.formatScientific(analysis.equilibriumMu5, 3) + " GeV";
    const flipTime = Number.isFinite(analysis.flipTimeSeconds)
      ? A.formatScientific(analysis.flipTimeSeconds, 3) + " s"
      : "∞";
    const crossover = Number.isFinite(
      analysis.electricAlignmentCrossover
    )
      ? A.formatScientific(
          analysis.electricAlignmentCrossover,
          3
        )
      : "—";

    const summary = [
      '<div class="chirality-summary">',
      '<div><span>T/mₑ</span><strong>' +
        A.formatScientific(
          analysis.temperatureToElectronMass,
          3
        ) + '</strong></div>',
      '<div><span>Regime</span><strong>' +
        analysis.masslessRegime + '</strong></div>',
      '<div><span>μ₅(0)</span><strong>' +
        A.formatScientific(analysis.initialMu5, 3) +
        ' GeV</strong></div>',
      '<div><span>μ₅(t_end)</span><strong>' +
        A.formatScientific(analysis.finalMu5, 3) +
        ' GeV</strong></div>',
      '<div><span>μ₅(eq)</span><strong>' +
        eqMu + '</strong></div>',
      '<div><span>τ_flip</span><strong>' +
        flipTime + '</strong></div>',
      '</div>'
    ].join("");

    const table = [
      '<div class="analysis-row analysis-row-head chirality"><span>Quantity</span><span>Value</span><span>Meaning</span></div>',
      '<div class="analysis-row chirality"><strong>S_proxy</strong><span>' +
        A.formatScientific(analysis.sourceProxyGeV4, 3) +
        ' GeV⁴</span><span>|J₅,CVE| / L_eff proxy</span></div>',
      '<div class="analysis-row chirality"><strong>S_anomaly</strong><span>' +
        A.formatScientific(analysis.anomalySourceGeV4, 3) +
        ' GeV⁴</span><span>C_A E·B, signed</span></div>',
      '<div class="analysis-row chirality"><strong>|E∥/B| crossover</strong><span>' +
        crossover + '</span><span>|anomaly| = S_proxy</span></div>',
      '<div class="analysis-row chirality"><strong>Γ_flip @ μ₅,max</strong><span>' +
        A.formatScientific(
          analysis.flipRateAtClosureCeiling,
          3
        ) + ' s⁻¹</span><span>proxy-only equilibrium at closure ceiling</span></div>',
      '<div class="analysis-row chirality"><strong>E∥/B @ μ₅,max</strong><span>' +
        A.formatScientific(
          analysis.electricAlignmentForClosureCeiling,
          3
        ) + '</span><span>required at selected Γ_flip</span></div>'
    ].join("");

    const validity =
      analysis.masslessRegime === "nonrelativistic"
        ? '<div class="diagnostic-line warning"><strong>REGIME WARNING</strong><span>At the current T, T/mₑ ≪ 1. The massless Dirac susceptibility and anomaly-transport coefficients are used only as a structural diagnostic; a finite-mass kinetic treatment is required for a physical electron plasma.</span></div>'
        : '<div class="diagnostic-line info"><strong>REGIME</strong><span>Massless susceptibility remains an approximation; inspect T/mₑ before physical interpretation.</span></div>';

    const note =
      '<div class="missing-note">' +
      validity +
      '<strong>Source caveat:</strong> S_proxy is |J₅,CVE|/L_eff from the current closure. It is not a microscopic derivation of axion → axial-charge production. The E·B term uses the anomaly convention consistent with the Transport tab.</div>';

    setAnalysisTable(summary + table + note);

    if (!window.Plotly) return;

    const valid = analysis.points.filter((point) =>
      point.timeSeconds > 0 &&
      Number.isFinite(point.mu5) &&
      point.mu5 !== 0
    );
    const colors = themeColors();
    const layout = plotLayout(
      "time, s",
      "log₁₀ |μ₅|, GeV"
    );
    layout.xaxis.type = "log";
    layout.shapes = [{
      type: "line",
      x0: valid.length ? valid[0].timeSeconds : 1e-12,
      x1: analysis.horizonSeconds,
      y0: Math.log10(Math.abs(analysis.closureMu5Ceiling)),
      y1: Math.log10(Math.abs(analysis.closureMu5Ceiling)),
      line: { color: colors.muted, dash: "dash", width: 1 }
    }];

    Plotly.react("plot", [{
      type: "scatter",
      mode: "lines",
      x: valid.map((point) => point.timeSeconds),
      y: valid.map((point) =>
        Math.log10(Math.abs(point.mu5))
      ),
      customdata: valid.map((point) => [
        point.mu5,
        point.eta5,
        point.jCME
      ]),
      line: { color: colors.accent2, width: 2 },
      hovertemplate:
        "t=%{x:.3e} s" +
        "<br>log₁₀|μ₅|=%{y:.2f}" +
        "<br>μ₅=%{customdata[0]:.3e} GeV" +
        "<br>η₅=%{customdata[1]:.3e}" +
        "<br>jCME=%{customdata[2]:.3e} GeV³" +
        "<extra></extra>"
    }], layout, {
      responsive: true,
      displaylogo: false
    });
  }

  function renderMissingPhysics() {
    if ($("mode").value !== "cme") {
      setAnalysisMeta(
        "Missing Physics Lab",
        "Phenomenological gain channels are defined only for the CVE closure"
      );
      setAnalysisTable(
        '<div class="inference-empty">Switch to the CVE closure. This tab does not alter the baseline calculation and is diagnostic only.</div>'
      );
      if (window.Plotly) Plotly.purge("plot");
      return;
    }

    const p = params();
    const analysis = A.missingPhysicsAnalysis(p, 1);
    const ceiling = analysis.ceiling;
    const placement = $("missingPlacement").value;
    const gain = missingGainValue();
    const selected = A.missingPhysicsPoint(p, placement, gain);

    setAnalysisMeta(
      "Missing Physics Lab",
      "g_extra is a phenomenological diagnostic multiplier; the baseline CVE result remains unchanged"
    );

    const selectedState = selected.closureValid
      ? A.formatScientific(selected.ratio511, 3)
      : "closure invalid";

    const summary = [
      '<div class="missing-summary">',
      '<div><span>Baseline gap</span><strong>' +
        ceiling.currentDeficitOrders.toFixed(2) + ' dex</strong></div>',
      '<div><span>Closure ceiling</span><strong>' +
        A.formatScientific(ceiling.ratioMax, 3) + ' L₅₁₁</strong></div>',
      '<div><span>Ceiling gap</span><strong>' +
        ceiling.ceilingDeficitOrders.toFixed(2) + ' dex</strong></div>',
      '<div><span>μ₅ max</span><strong>' +
        A.formatScientific(ceiling.mu5Max, 3) + ' GeV</strong></div>',
      '<div><span>Selected g_extra</span><strong>' +
        A.formatScientific(gain, 3) + '×</strong></div>',
      '<div><span>Selected e⁺ budget ratio</span><strong>' +
        selectedState + '</strong></div>',
      '</div>'
    ].join("");

    const table = [
      '<div class="analysis-row analysis-row-head missing"><span>Placement</span><span>Limit</span><span>Gain</span><span>Outcome</span></div>',
      ...analysis.rows.map(missingPhysicsRow)
    ].join("");

    const headroomDex = Number.isFinite(ceiling.upstreamHeadroom)
      ? Math.log10(ceiling.upstreamHeadroom).toFixed(2)
      : "∞";

    const note =
      '<div class="missing-note"><strong>Analytic ceiling:</strong> ' +
      'D ≥ 0 forces μ₅ ≤ πT/√3. Therefore any multiplicative gain placed upstream ' +
      'inside the present quadratic closure can add at most ' +
      headroomDex +
      ' dex over the current run. Even at that boundary a downstream factor of ≈' +
      A.formatScientific(ceiling.requiredPostGainAtCeiling, 3) +
      '× is still required.</div>';

    setAnalysisTable(summary + table + note);

    if (!window.Plotly) return;

    const criticalExp =
      Number.isFinite(ceiling.criticalUpstreamProduct) &&
      ceiling.criticalUpstreamProduct > 0
        ? Math.log10(ceiling.criticalUpstreamProduct)
        : 60;
    const sweepMax = placement === "conversion"
      ? Math.min(
          220,
          Math.max(
            60,
            Number.isFinite(
              ceiling.requiredPostGainAtCurrent
            ) &&
            ceiling.requiredPostGainAtCurrent > 0
              ? Math.log10(
                  ceiling.requiredPostGainAtCurrent
                ) * 1.02
              : 60
          )
        )
      : Math.min(
          220,
          Math.max(60, criticalExp * 1.02)
        );

    const sweep = A.missingPhysicsSweep(p, placement, {
      minExp: 0,
      maxExp: sweepMax,
      steps: 220
    });
    const valid = sweep.points.filter((point) =>
      Number.isFinite(point.ratio511) && point.ratio511 > 0
    );

    const x = valid.map((point) => point.exponent);
    const y = valid.map((point) => Math.log10(point.ratio511));
    const selectedY =
      selected.closureValid && selected.ratio511 > 0
        ? Math.log10(selected.ratio511)
        : null;
    const colors = themeColors();
    const layout = plotLayout("log₁₀ g_extra", "log₁₀ e⁺ budget ratio");
    layout.shapes = [{
      type: "line",
      x0: 0,
      x1: sweepMax,
      y0: 0,
      y1: 0,
      line: { color: colors.muted, dash: "dash", width: 1 }
    }];

    const traces = [{
      type: "scatter",
      mode: "lines",
      x,
      y,
      line: { color: colors.accent, width: 2 },
      hovertemplate:
        "log₁₀ g=%{x:.2f}<br>log₁₀ e⁺ budget ratio=%{y:.2f}<extra></extra>"
    }];

    if (selectedY !== null) {
      traces.push({
        type: "scatter",
        mode: "markers",
        x: [Number($("missingGainExp").value)],
        y: [selectedY],
        marker: { size: 10, color: colors.accent2 },
        hovertemplate:
          "selected<br>log₁₀ g=%{x:.2f}<br>log₁₀ e⁺ budget ratio=%{y:.2f}<extra></extra>"
      });
    }

    Plotly.react("plot", traces, layout, {
      responsive: true,
      displaylogo: false
    });
  }

  function renderComparison() {
    const mode = $("mode").value;
    const scenarios = A.comparePresets(mode);
    const currentResult = A.simulate(mode, params());
    scenarios.push({
      name: "current",
      parameters: params(),
      result: currentResult,
      metric: Number(currentResult.ratio511)
    });

    const names = {
      baseline: "Sgr A* baseline",
      breakthrough: "High-B breakthrough",
      optimistic: "Optimistic",
      current: "Current parameters"
    };

    setAnalysisMeta(
      "Scenario comparison",
      modeNames[mode] + " · the same e⁺ budget-ratio metric"
    );

    const html = [
      '<div class="analysis-row analysis-row-head compare"><span>Scenario</span><span>a/M</span><span>B₀</span><span>e⁺ budget ratio</span></div>',
      ...scenarios.map((item) =>
        '<div class="analysis-row compare"><strong>' +
        names[item.name] +
        '</strong><span>' + item.parameters.spin.toFixed(3) +
        '</span><span>' + A.formatScientific(item.parameters.B0, 2) +
        '</span><span>' + A.formatScientific(item.metric, 3) +
        '</span></div>'
      )
    ].join("");
    setAnalysisTable(html);

    if (!window.Plotly) return;
    const layout = plotLayout("scenario", "e⁺ budget ratio");
    layout.yaxis.type = "log";
    Plotly.react("plot", [{
      type: "bar",
      x: scenarios.map((item) => names[item.name]),
      y: scenarios.map((item) => item.metric > 0 ? item.metric : null),
      marker: { color: themeColors().accent2 },
      hovertemplate: "%{x}<br>e⁺ budget ratio=%{y:.3e}<extra></extra>"
    }], layout, { responsive: true, displaylogo: false });
  }

  function renderAnalysis(kind = state.analysis) {
    state.analysis = kind;
    document.querySelectorAll(".analysis-tab").forEach((button) => {
      button.classList.toggle("active", button.dataset.analysis === kind);
    });

    $("explorerControls").classList.toggle("hidden", kind !== "explorer");
    $("chiralityControls").classList.toggle("hidden", kind !== "chirality");
    $("gapControls").classList.toggle("hidden", kind !== "gap");
    $("annihilationControls").classList.toggle("hidden", kind !== "annihilation");
    $("missingPhysicsControls").classList.toggle("hidden", kind !== "missing");
    $("plot").classList.toggle("plot-tall", kind === "explorer");

    setAnalysisBusy(true);
    window.requestAnimationFrame(() => {
      try {
        if (kind === "explorer") renderParameterExplorer();
        else if (kind === "sensitivity") renderSensitivity();
        else if (kind === "inference") renderInference();
        else if (kind === "transport") renderTransport();
        else if (kind === "plasma") renderPlasma();
        else if (kind === "calibration") renderAccretionCalibration();
        else if (kind === "flow") renderFlowGeometryCalibration();
        else if (kind === "micro") renderMicrophysicsAudit();
        else if (kind === "pairs") renderPairProduction();
        else if (kind === "gap") renderGapElectrodynamics();
        else if (kind === "annihilation") renderAnnihilationPipeline();
        else if (kind === "validity") renderValidity();
        else if (kind === "chirality") renderChirality();
        else if (kind === "missing") renderMissingPhysics();
        else if (kind === "compare") renderComparison();
        else renderSpinAnalysis();
      } catch (error) {
        toast(error.message || String(error));
      } finally {
        setAnalysisBusy(false);
      }
    });
  }

  function run() {
    try {
      const p = params();
      const mode = $("mode").value;
      const result = A.simulate(mode, p);
      state.lastResult = result;
      state.lastParams = p;
      state.lastMode = mode;
      render(result);
      $("runStatus").textContent = "Calculation complete";
      $("runStatusDot").style.background = "var(--ok)";
      renderAnalysis(state.analysis);
    } catch (error) {
      $("runStatus").textContent = "Parameter error";
      $("runStatusDot").style.background = "var(--danger)";
      toast(error.message || String(error));
    }
  }


  function downloadTextFile(filename, text, type) {
    const blob = new Blob([text], { type });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = filename;
    anchor.click();
    URL.revokeObjectURL(url);
  }

  function downloadJson() {
    if (!state.lastResult) return toast("Run a calculation first.");
    const diagnostics = currentDiagnostics();
    const payload = {
      generatedAt: new Date().toISOString(),
      model: "AxionBH research workbench v8.9.1",
      modelVersion: A.MODEL_VERSION,
      stateSchemaVersion: A.STATE_SCHEMA_VERSION,
      stateId: runStateId(state.lastMode, state.lastParams),
      mode: state.lastMode,
      parameters: state.lastParams,
      result: state.lastResult,
      diagnostics,
      explorer: {
        view: $("explorerView").value,
        reference: $("explorerReference").value,
        faExp: Number($("explorerFaExp").value),
        resolution: $("explorerResolution").value
      },
      transport: state.lastMode === "cme"
        ? A.anomalousTransportDiagnostics(
            state.lastParams,
            state.lastResult
          )
        : null,
      chirality: state.lastMode === "cme"
        ? A.chiralityDynamics(
            state.lastParams,
            currentChiralityOptions()
          )
        : null,
      validity: A.modelValidityReport(
        state.lastParams,
        state.lastMode,
        state.lastResult
      ),
      accretionCalibration:
        state.lastMode === "cme"
          ? A.accretionCalibrationAnalysis(
              state.lastParams
            )
          : null,
      flowGeometryCalibration:
        state.lastMode === "cme"
          ? A.flowGeometryCalibrationAnalysis(
              state.lastParams
            )
          : null,
      microphysicsAudit:
        state.lastMode === "cme"
          ? A.microphysicsAudit(state.lastParams)
          : null,
      pairProductionAudit:
        state.lastMode === "cme"
          ? A.pairProductionAudit(state.lastParams)
          : null,
      gapElectrodynamicsAudit:
        state.lastMode === "cme"
          ? A.gapElectrodynamicsAudit(
              state.lastParams,
              currentGapOptions()
            )
          : null,
      positronTransport:
        A.positronTransportPipeline(
          state.lastParams,
          currentPositronOptions()
        ),
      missingPhysics: {
        placement: $("missingPlacement").value,
        gainExp: Number($("missingGainExp").value),
        analysis: state.lastMode === "cme"
          ? A.missingPhysicsAnalysis(state.lastParams, 1)
          : null
      },
      note: "Exploratory model output; not a validated astrophysical inference."
    };
    downloadTextFile(
      "axionbh-result-" + payload.stateId + ".json",
      JSON.stringify(payload, null, 2),
      "application/json"
    );
  }

  function downloadReport() {
    if (!state.lastResult) return toast("Run a calculation first.");
    const diagnostics = currentDiagnostics();
    const stateId = runStateId(state.lastMode, state.lastParams);
    const lines = [
      "# AxionBH reproducibility report",
      "",
      "- Model: AxionBH Research Workbench v8.9.1",
      "- Generated: " + new Date().toISOString(),
      "- State ID: " + stateId,
      "- Mode: " + modeNames[state.lastMode],
      "",
      "## Parameters",
      "",
      "| Parameter | Value |",
      "| --- | ---: |"
    ];

    parameterIds.forEach((key) => {
      lines.push("| " + (parameterLabels[key] || key) + " | " +
        A.formatScientific(Number(state.lastParams[key]), 6) + " |");
    });

    lines.push("", "## Result", "", "| Metric | Value |", "| --- | --- |");
    detailedRows(state.lastResult).forEach(([key, value]) => {
      lines.push("| " + key + " | " + String(value).replace(/\|/g, "\\|") + " |");
    });

    lines.push("", "## Diagnostics", "");
    diagnostics.checks.forEach((item) => {
      const value =
        item.value !== null && Number.isFinite(Number(item.value))
          ? " (" + A.formatScientific(Number(item.value), 6) + ")"
          : "";
      lines.push("- [" + item.level.toUpperCase() + "] " + item.message + value);
    });

    const validity = A.modelValidityReport(
      state.lastParams,
      state.lastMode,
      state.lastResult
    );
    lines.push("", "## Model layers", "");
    validity.layers.forEach((layer) => {
      lines.push(
        "- **" + layer.title + "** — " +
        layer.category + " / " + layer.state +
        ": " + layer.detail
      );
    });

    lines.push(
      "",
      "## Explorer state",
      "",
      "- View: " + $("explorerView").value,
      "- Reference B: " + (referenceNames[$("explorerReference").value] || $("explorerReference").value),
      "- f_a slice: " + A.formatScientific(explorerFaValue(), 6) + " GeV",
      "- Resolution: " + explorerResolution().join("×"),
      "",
      "> Exploratory model output; not a validated astrophysical inference."
    );

    downloadTextFile(
      "axionbh-report-" + stateId + ".md",
      lines.join("\n"),
      "text/markdown;charset=utf-8"
    );
  }

  function csvCell(value) {
    if (value === null || value === undefined) return "";
    if (typeof value === "number" && !Number.isFinite(value)) return "";
    const text = String(value);
    if (!/[,"\n]/.test(text)) return text;
    return '"' + text.replace(/"/g, '""') + '"';
  }

  function downloadExplorerCsv() {
    let data;
    try {
      data = getExplorerComparison();
    } catch (error) {
      return toast(error.message || String(error));
    }

    const rows = [[
      "spin_a_over_M",
      "B0_G",
      "fa_GeV",
      "reference_B",
      "ratio511_A",
      "ratio511_B",
      "delta_percent",
      "deficit_orders_A"
    ]];

    data.comparison.yValues.forEach((b0, rowIndex) => {
      data.comparison.xValues.forEach((spin, columnIndex) => {
        rows.push([
          spin,
          b0,
          data.faGev,
          referenceNames[data.referenceKey] || data.referenceKey,
          data.comparison.mapA.z[rowIndex][columnIndex],
          data.comparison.mapB.z[rowIndex][columnIndex],
          data.comparison.differencePercent[rowIndex][columnIndex],
          Number.isFinite(data.comparison.mapA.z[rowIndex][columnIndex]) &&
          data.comparison.mapA.z[rowIndex][columnIndex] > 0
            ? A.deficitOrders(
                data.comparison.mapA.z[rowIndex][columnIndex],
                1
              )
            : null
        ]);
      });
    });

    const csv = rows.map((row) => row.map(csvCell).join(",")).join("\n");
    const stateId = runStateId("cme", { ...params(), faGev: data.faGev });
    downloadTextFile(
      "axionbh-explorer-" + stateId + ".csv",
      csv,
      "text/csv;charset=utf-8"
    );
  }

  async function copyResult() {
    if (!state.lastResult) return toast("Run a calculation first.");
    const text = detailedRows(state.lastResult)
      .map(([key, value]) => key + ": " + value)
      .join("\n");
    try {
      await navigator.clipboard.writeText(text);
      toast("Results copied.");
    } catch {
      toast("Clipboard unavailable.");
    }
  }

  function encodeState(payload) {
    return btoa(JSON.stringify(payload))
      .replace(/\+/g, "-")
      .replace(/\//g, "_")
      .replace(/=+$/g, "");
  }

  function decodeState(encoded) {
    const normalized = encoded.replace(/-/g, "+").replace(/_/g, "/");
    const padded = normalized + "=".repeat((4 - normalized.length % 4) % 4);
    return JSON.parse(atob(padded));
  }

  async function shareCurrentState() {
    let p;
    try {
      p = params();
    } catch (error) {
      return toast(error.message || String(error));
    }
    const url = new URL(window.location.href);
    url.search = "";
    url.searchParams.set("state", encodeState({
      schemaVersion: A.STATE_SCHEMA_VERSION,
      modelVersion: A.MODEL_VERSION,
      mode: $("mode").value,
      params: p,
      analysis: state.analysis,
      explorer: {
        view: $("explorerView").value,
        reference: $("explorerReference").value,
        faExp: Number($("explorerFaExp").value),
        resolution: $("explorerResolution").value
      },
      chirality: {
        flipExp: Number($("chiralityFlipExp").value),
        timeExp: Number($("chiralityTimeExp").value),
        anomalyMode: $("chiralityAnomalyMode").value,
        eExp: Number($("chiralityEExp").value)
      },
      gap: {
        potentialModel: $("gapPotentialModel").value,
        closureMode: $("gapClosureMode").value,
        heightExp: Number($("gapHeightExp").value),
        injectionExp: Number($("gapInjectionExp").value),
        curvatureExp: Number($("gapCurvatureExp").value),
        softMinExp: Number($("gapSoftMinExp").value),
        softMaxExp: Number($("gapSoftMaxExp").value),
        photonIndex: Number($("gapPhotonIndex").value),
        softLumExp: Number($("gapSoftLumExp").value)
      },
      annihilation: {
        sourceKind: $("positronSourceKind").value,
        transportModel: $("positronTransportModel").value,
        ismPhase: $("positronIsmPhase").value,
        propagationMode: $("positronPropagationMode").value,
        escape: Number($("positronEscape").value),
        smearingPc: Number($("positronSmearingPc").value),
        bulgeRadiusPc: Number($("positronBulgeRadiusPc").value),
        thermalization: Number($("positronThermalization").value),
        annihilation: Number($("positronAnnihilation").value),
        positronium: Number($("positroniumFraction").value),
        injectionExp: Number($("positronInjectionExp").value),
        logD10: Number($("positronLogD10").value),
        diffusionDelta: Number($("positronDiffusionDelta").value),
        advectionKms: Number($("positronAdvectionKms").value),
        fieldLineExp: Number($("positronFieldLineExp").value),
        annCoeffExp: Number($("positronAnnCoeffExp").value)
      },
      missingPhysics: {
        placement: $("missingPlacement").value,
        gainExp: Number($("missingGainExp").value)
      }
    }));

    try {
      await navigator.clipboard.writeText(url.toString());
      toast("Link to this calculation copied.");
    } catch {
      window.prompt("Copy this link:", url.toString());
    }
  }

  function restoreSharedState() {
    const encoded = new URLSearchParams(window.location.search).get("state");
    if (!encoded) return false;
    try {
      const payload = decodeState(encoded);
      const restored = A.normalizeParams(payload.params || {});
      applyParameters(restored);
      if (modeNames[payload.mode]) $("mode").value = payload.mode;

      if (["spin", "explorer", "sensitivity", "inference", "transport", "plasma", "calibration", "flow", "micro", "pairs", "gap", "annihilation", "validity", "chirality", "missing", "compare"].includes(payload.analysis)) {
        state.analysis = payload.analysis;
      }

      if (payload.explorer && typeof payload.explorer === "object") {
        if (["surface", "contour", "difference", "deficit"].includes(payload.explorer.view)) {
          $("explorerView").value = payload.explorer.view;
        }
        if (referenceNames[payload.explorer.reference]) {
          $("explorerReference").value = payload.explorer.reference;
        }
        const faExp = Number(payload.explorer.faExp);
        if (Number.isFinite(faExp) && faExp >= 14 && faExp <= 18) {
          $("explorerFaExp").value = faExp;
        }
        if (explorerResolutions[payload.explorer.resolution]) {
          $("explorerResolution").value = payload.explorer.resolution;
        }
      }

      if (payload.chirality && typeof payload.chirality === "object") {
        const flipExp = Number(payload.chirality.flipExp);
        const timeExp = Number(payload.chirality.timeExp);
        const eExp = Number(payload.chirality.eExp);
        if (Number.isFinite(flipExp) && flipExp >= -30 && flipExp <= 6) {
          $("chiralityFlipExp").value = flipExp;
        }
        if (Number.isFinite(timeExp) && timeExp >= -3 && timeExp <= 15) {
          $("chiralityTimeExp").value = timeExp;
        }
        if (Number.isFinite(eExp) && eExp >= -40 && eExp <= 0) {
          $("chiralityEExp").value = eExp;
        }
        if (["off", "source", "sink"].includes(payload.chirality.anomalyMode)) {
          $("chiralityAnomalyMode").value = payload.chirality.anomalyMode;
        }
      }

      if (payload.gap && typeof payload.gap === "object") {
        if (["vacuum-h2","near-gj-h3"].includes(payload.gap.potentialModel)) {
          $("gapPotentialModel").value = payload.gap.potentialModel;
        }
        if (["solve","manual"].includes(payload.gap.closureMode)) {
          $("gapClosureMode").value = payload.gap.closureMode;
        }
        const gapRanges = [
          ["gapHeightExp", payload.gap.heightExp, -3, 0],
          ["gapInjectionExp", payload.gap.injectionExp, -24, 0],
          ["gapCurvatureExp", payload.gap.curvatureExp, -1, 1],
          ["gapSoftMinExp", payload.gap.softMinExp, -6, 3],
          ["gapSoftMaxExp", payload.gap.softMaxExp, -2, 6],
          ["gapPhotonIndex", payload.gap.photonIndex, 0.5, 4],
          ["gapSoftLumExp", payload.gap.softLumExp, 30, 42]
        ];
        gapRanges.forEach(([id,value,min,max]) => {
          const x=Number(value);
          if(Number.isFinite(x)&&x>=min&&x<=max) $(id).value=x;
        });
      }

      if (payload.annihilation && typeof payload.annihilation === "object") {
        if (["mode-proxy","gap-cascade","gap-schwinger"].includes(payload.annihilation.sourceKind)) {
          $("positronSourceKind").value=payload.annihilation.sourceKind;
        }
        if (["ism-timescale","legacy-factors"].includes(payload.annihilation.transportModel)) {
          $("positronTransportModel").value=payload.annihilation.transportModel;
        }
        if (A.ISM_PHASE_PRESETS[payload.annihilation.ismPhase]) {
          $("positronIsmPhase").value=payload.annihilation.ismPhase;
        }
        if (["diffusion-advection","collisional-ballistic"].includes(payload.annihilation.propagationMode)) {
          $("positronPropagationMode").value=payload.annihilation.propagationMode;
        }
        const transportRanges=[
          ["positronEscape",payload.annihilation.escape,0,1],
          ["positronSmearingPc",payload.annihilation.smearingPc,25,600],
          ["positronBulgeRadiusPc",payload.annihilation.bulgeRadiusPc,100,3000],
          ["positronThermalization",payload.annihilation.thermalization,0,1],
          ["positronAnnihilation",payload.annihilation.annihilation,0,1],
          ["positroniumFraction",payload.annihilation.positronium,0,1],
          ["positronInjectionExp",payload.annihilation.injectionExp,-2,2],
          ["positronLogD10",payload.annihilation.logD10,24,30],
          ["positronDiffusionDelta",payload.annihilation.diffusionDelta,0,1],
          ["positronAdvectionKms",payload.annihilation.advectionKms,0,300],
          ["positronFieldLineExp",payload.annihilation.fieldLineExp,-4,0],
          ["positronAnnCoeffExp",payload.annihilation.annCoeffExp,-15,-10]
        ];
        transportRanges.forEach(([id,value,min,max])=>{
          const x=Number(value);
          if(Number.isFinite(x)&&x>=min&&x<=max)$(id).value=x;
        });
      }

      if (payload.missingPhysics && typeof payload.missingPhysics === "object") {
        if (missingPlacementNames[payload.missingPhysics.placement]) {
          $("missingPlacement").value = payload.missingPhysics.placement;
        }
        const gainExp = Number(payload.missingPhysics.gainExp);
        if (Number.isFinite(gainExp) && gainExp >= 0 && gainExp <= 220) {
          $("missingGainExp").value = gainExp;
        }
      }

      updateExplorerFaLabel();
      updateChiralityLabels();
      updateGapLabels();
      updatePositronLabels();
      updateMissingGainLabel();
      $("preset").value = "custom";
      updateConditionalFields();
      updatePresetButtons();
      return true;
    } catch {
      toast("Could not restore parameters from the shared link.");
      return false;
    }
  }

  function toggleTheme() {
    const current = document.documentElement.dataset.theme || "dark";
    const next = current === "dark" ? "light" : "dark";
    document.documentElement.dataset.theme = next;
    localStorage.setItem("axionbh-theme", next);
    if (state.lastResult) renderAnalysis(state.analysis);
  }

  function resetWorkbench() {
    const url = new URL(window.location.href);
    url.search = "";
    window.history.replaceState(null, "", url.toString());
    $("mode").value = "cme";
    state.analysis = "spin";
    document.querySelectorAll(".analysis-tab").forEach((button) => {
      button.classList.toggle("active", button.dataset.analysis === "spin");
    });
    selectPreset("baseline");
    renderAnalysis("spin");
    toast("Workbench reset to the EHT-context baseline.");
  }

  let explorerRenderTimer;
  function scheduleExplorerRender(delay = 180) {
    clearTimeout(explorerRenderTimer);
    explorerRenderTimer = setTimeout(() => {
      if (state.analysis === "explorer" && state.lastResult) {
        renderAnalysis("explorer");
      }
    }, delay);
  }

  let toastTimer;
  function toast(message) {
    const element = $("toast");
    element.textContent = message;
    element.classList.add("show");
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => element.classList.remove("show"), 2600);
  }

  function init() {
    const savedTheme = localStorage.getItem("axionbh-theme");
    if (savedTheme === "light") document.documentElement.dataset.theme = "light";

    state.userPresets = loadUserPresets();
    refreshPresetOptions("baseline");

    Object.entries(A.DEFAULTS).forEach(([key, value]) => {
      if ($(key)) setValue(key, value);
    });

    ["spin", "B0", "betaTurb"].forEach((id) => {
      const input = $(id);
      input.addEventListener("input", () => {
        const output = $(input.id + "Out");
        if (output) output.textContent = displayInput(input.value);
        markCustom();
      });
    });

    parameterIds.forEach((id) => {
      const element = $(id);
      if (element && element.type !== "range") {
        element.addEventListener("input", markCustom);
      }
    });

    $("preset").addEventListener("change", (event) => selectPreset(event.target.value));
    $("savePresetBtn").addEventListener("click", saveUserPreset);
    $("deletePresetBtn").addEventListener("click", deleteUserPreset);
    $("mode").addEventListener("change", () => {
      updateConditionalFields();
      markCustom();
      run();
    });
    $("runBtn").addEventListener("click", run);
    $("resetBtn").addEventListener("click", resetWorkbench);
    $("shareBtn").addEventListener("click", shareCurrentState);
    $("copyBtn").addEventListener("click", copyResult);
    $("exportBtn").addEventListener("click", downloadJson);
    $("reportBtn").addEventListener("click", downloadReport);
    $("explorerCsvBtn").addEventListener("click", downloadExplorerCsv);
    $("themeBtn").addEventListener("click", toggleTheme);

    document.querySelectorAll(".analysis-tab").forEach((button) => {
      button.addEventListener("click", () => renderAnalysis(button.dataset.analysis));
    });

    $("explorerFaExp").addEventListener("input", () => {
      updateExplorerFaLabel();
      scheduleExplorerRender();
    });
    $("explorerView").addEventListener("change", () => scheduleExplorerRender(0));
    $("explorerReference").addEventListener("change", () => scheduleExplorerRender(0));
    $("explorerResolution").addEventListener("change", () => scheduleExplorerRender(0));

    $("electronDensityMode").addEventListener("change", () => {
      updateConditionalFields();
      markCustom();
    });

    ["chiralityFlipExp", "chiralityTimeExp", "chiralityEExp"].forEach((id) => {
      $(id).addEventListener("input", () => {
        updateChiralityLabels();
        if (state.analysis === "chirality" && state.lastResult) {
          renderAnalysis("chirality");
        }
      });
    });
    $("chiralityAnomalyMode").addEventListener("change", () => {
      if (state.analysis === "chirality" && state.lastResult) {
        renderAnalysis("chirality");
      }
    });

    ["gapHeightExp","gapInjectionExp","gapCurvatureExp","gapSoftMinExp","gapSoftMaxExp","gapPhotonIndex","gapSoftLumExp"].forEach((id) => {
      $(id).addEventListener("input", () => {
        updateGapLabels();
        if (state.analysis === "gap" && state.lastResult) {
          renderAnalysis("gap");
        }
      });
    });
    ["gapPotentialModel","gapClosureMode"].forEach((id) => {
      $(id).addEventListener("change", () => {
        if (state.analysis === "gap" && state.lastResult) {
          renderAnalysis("gap");
        }
      });
    });

    ["positronEscape","positronSmearingPc","positronBulgeRadiusPc","positronThermalization","positronAnnihilation","positroniumFraction","positronInjectionExp","positronLogD10","positronDiffusionDelta","positronAdvectionKms","positronFieldLineExp","positronAnnCoeffExp"].forEach((id)=>{
      $(id).addEventListener("input",()=>{
        updatePositronLabels();
        if(state.analysis==="annihilation"&&state.lastResult){
          renderAnalysis("annihilation");
        }
      });
    });
    ["positronSourceKind","positronTransportModel","positronIsmPhase","positronPropagationMode"].forEach((id)=>{
      $(id).addEventListener("change",()=>{
        if(state.analysis==="annihilation"&&state.lastResult){
          renderAnalysis("annihilation");
        }
      });
    });

    $("missingGainExp").addEventListener("input", () => {
      updateMissingGainLabel();
      if (state.analysis === "missing" && state.lastResult) {
        renderAnalysis("missing");
      }
    });
    $("missingPlacement").addEventListener("change", () => {
      if (state.analysis === "missing" && state.lastResult) {
        renderAnalysis("missing");
      }
    });

    updateConditionalFields();
    updateExplorerFaLabel();
    updateChiralityLabels();
    updateGapLabels();
    updatePositronLabels();
    updateMissingGainLabel();
    const restored = restoreSharedState();
    if (restored) {
      run();
    } else {
      $("preset").value = "baseline";
      selectPreset("baseline");
    }

    document.addEventListener("keydown", (event) => {
      if ((event.metaKey || event.ctrlKey) && event.key === "Enter") {
        event.preventDefault();
        run();
      }
    });
  }

  document.addEventListener("DOMContentLoaded", init);
})();

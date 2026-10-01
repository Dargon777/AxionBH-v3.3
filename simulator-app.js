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
    cme: "CVE closure / стационарное облако",
    bosenova: "Bosenova / ручные вспышки",
    superradiant: "Суперрадиантный рост",
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
    burstEfficiency: "ε_burst"
  };

  const parameterIds = [
    "massSolar", "spin", "B0", "betaTurb", "faGev", "mEff", "mdot",
    "temperature", "electronMuMeV", "electronDensityMode",
    "electronDensityCm3", "accretionRadiusRg",
    "radialVelocityFracC", "scaleHeightRatio",
    "electronFractionYe", "nProfile", "axionMassEv", "burstEnergy",
    "burstIntervalYears", "burstDuration", "burstEfficiency"
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
    let name = window.prompt("Название пресета:");
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
    toast("Пресет сохранён локально.");
  }

  function deleteUserPreset() {
    const value = $("preset").value;
    if (!value.startsWith("user:")) return;
    const id = value.slice(5);
    state.userPresets = state.userPresets.filter((item) => item.id !== id);
    persistUserPresets();
    refreshPresetOptions("custom");
    toast("Пресет удалён.");
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
        ["ā", A.formatScientific(result.aBar) + " GeV", "устойчивая natural-unit ветвь"],
        ["κ", A.formatScientific(result.kappa), "эффективность конверсии"],
        ["Lₑ₊", A.formatScientific(result.luminosity) + " erg/s", "позитронная светимость"],
        ["L / L₅₁₁", formatRatio(result.ratio511), "относительно 1.07×10⁴³ erg/s"]
      ];
    }
    if (result.mode === "bosenova") {
      return [
        ["Eₑ₊ / burst", A.formatScientific(result.convertedEnergy) + " erg", "энергия после эффективности"],
        ["Nₑ₊ / burst", A.formatScientific(result.positronsPerBurst), "оценка числа позитронов"],
        ["⟨L⟩", A.formatScientific(result.averageLuminosity) + " erg/s", "средняя светимость"],
        ["⟨L⟩ / L₅₁₁", formatRatio(result.ratio511), "относительно наблюдаемой"]
      ];
    }
    if (result.mode === "superradiant") {
      return [
        ["α", A.formatScientific(result.alpha), "гравитационная связь"],
        ["Γ", A.formatScientific(result.gamma) + " s⁻¹", "темп роста"],
        ["t_sat", A.formatDuration(result.saturationTime), "до 5% массы облака"],
        ["Lₑ₊ / L₅₁₁", formatRatio(result.ratio511), "при заданной эффективности"]
      ];
    }
    return [
      ["α", A.formatScientific(result.alpha), "гравитационная связь"],
      ["t_sat", A.formatDuration(result.saturationTime), "время накопления"],
      ["⟨L_burst⟩", A.formatScientific(result.averageLuminosity) + " erg/s", "среднее по циклу"],
      ["⟨L⟩ / L₅₁₁", formatRatio(result.ratio511), "относительно наблюдаемой"]
    ];
  }

  function detailedRows(result) {
    const rows = [["Режим", modeNames[result.mode]]];
    if (result.mode === "cme") {
      rows.push(
        ["Спиновый порог", result.thresholdPassed ? "пройден" : "не пройден (a/M < 0.35)"],
        ["Среднее B в эргосфере", A.formatScientific(result.avgB) + " G"],
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
        ["Конвертированная энергия", A.formatScientific(result.convertedEnergy) + " erg"],
        ["Средний темп e⁺", A.formatScientific(result.averageRate) + " s⁻¹"],
        ["Средняя светимость", A.formatScientific(result.averageLuminosity) + " erg/s"],
        ["Пиковая светимость", A.formatScientific(result.burstLuminosity) + " erg/s"],
        ["Интервал", A.formatDuration(result.intervalSeconds)]
      );
    } else {
      rows.push(
        ["Активна суперрадиация", result.active ? "да" : "нет"],
        ["α", A.formatScientific(result.alpha)],
        ["Γ", A.formatScientific(result.gamma) + " s⁻¹"],
        ["e-fold", A.formatDuration(result.eFoldTime)],
        ["Насыщение", A.formatDuration(result.saturationTime)]
      );
      if (result.mode === "superradiant") {
        rows.push(
          ["Мощность облака при насыщении", A.formatScientific(result.saturationPower) + " erg/s"],
          ["Позитронная мощность", A.formatScientific(result.positronPower) + " erg/s"]
        );
      } else {
        rows.push(
          ["Энергия вспышки", A.formatScientific(result.burstEnergy) + " erg"],
          ["Конвертированная энергия", A.formatScientific(result.convertedEnergy) + " erg"],
          ["Средняя светимость", A.formatScientific(result.averageLuminosity) + " erg/s"],
          ["Пиковая светимость", A.formatScientific(result.burstLuminosity) + " erg/s"]
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
      model: "AxionBH-v8.2",
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
      '<strong>Диагностика</strong>' +
      '<span class="state-id" title="Детерминированный идентификатор режима и параметров">' +
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
    $("interpretation").textContent = ratio >= 1
      ? "В этой точке реализация модели достигает или превышает выбранную опорную светимость."
      : "В этой точке реализация модели остаётся ниже выбранной опорной светимости.";
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
    setAnalysisMeta("κ как функция спина", "CVE closure · логарифмическая шкала");
    setAnalysisTable("");

    if (!window.Plotly) return toast("Plotly не загрузился; сами расчёты работают.");

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
    baseline: "Sgr A* baseline",
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
      '<div><span>Модель A</span><strong>Текущие параметры</strong></div>',
      '<div><span>Модель B</span><strong>' +
        (referenceNames[referenceKey] || referenceKey) + '</strong></div>',
      '<div><span>fₐ slice</span><strong>' +
        A.formatScientific(faGev, 2) + ' GeV</strong></div>',
      '<div><span>Сетка</span><strong>' +
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
        title: "log₁₀ L/L₅₁₁",
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
          "<br>L/L₅₁₁=%{customdata:.3e}<extra></extra>"
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
        colorbar: { title: "log₁₀ L/L₅₁₁", len: 0.72 },
        hovertemplate:
          "B<br>a/M=%{x:.3f}<br>B₀=%{y:.3e} G" +
          "<br>L/L₅₁₁=%{customdata:.3e}<extra></extra>"
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
          "<br>L/L₅₁₁=%{customdata:.3e}<extra></extra>"
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
        colorbar: { title: "log₁₀ L/L₅₁₁", len: 0.75 },
        contours: { coloring: "heatmap", showlabels: false },
        hovertemplate:
          "B<br>a/M=%{x:.3f}<br>B₀=%{y:.3e} G" +
          "<br>L/L₅₁₁=%{customdata:.3e}<extra></extra>"
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
      '<div><span>Карта</span><strong>Дефицит до L₅₁₁</strong></div>',
      '<div><span>Модель</span><strong>Текущие параметры</strong></div>',
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
        "<br>L/L₅₁₁=%{customdata:.3e}" +
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
        ? "Сколько порядков величины отделяет L/L₅₁₁ от единицы; нулевые точки не имеют конечного log-gap"
        : "CVE closure · spin × B₀ · fₐ задаёт логарифмический срез; A и B используют один fₐ"
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
      return toast("Plotly не загрузился; сетка рассчитана, но не может быть нарисована.");
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
      "Чувствительность ±10%",
      modeNames[mode] + " · отклик L/L₅₁₁ на изменение одного параметра"
    );

    const rows = analysis.rows;
    const html = [
      '<div class="analysis-row analysis-row-head"><span>Параметр</span><span>−10%</span><span>+10%</span><span>Эластичность</span></div>',
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
    const layout = plotLayout("параметр", "макс. |Δ(L/L₅₁₁)|, %");
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
        "v8.2 inverse solver сейчас определён для CVE closure"
      );
      setAnalysisTable(
        '<div class="inference-empty">Переключи режим на CME, чтобы оценить дефицит и требуемые однопараметрические сдвиги.</div>'
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
      "Однопараметрический inverse scan до L/L₅₁₁ = 1 · диапазоны диагностические, не физические priors"
    );

    const deficit = analysis.deficitOrders;
    const gain = analysis.requiredGain;
    const rows = analysis.rows;

    const summary = [
      '<div class="inference-summary">',
      '<div><span>Current L/L₅₁₁</span><strong>' +
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
      '<div class="analysis-row analysis-row-head inference"><span>Параметр</span><span>Сейчас</span><span>Required / best</span><span>Сдвиг</span><span>Итог</span></div>',
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
      "один изменяемый параметр",
      "оставшийся дефицит, dex"
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
        "CVE/CME decomposition сейчас привязана к стационарной axion closure"
      );
      setAnalysisTable(
        '<div class="inference-empty">Переключи режим на CVE closure. Этот анализ сравнивает токи и не преобразует их автоматически в L₅₁₁.</div>'
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
      '<div class="analysis-row analysis-row-head transport"><span>Канал</span><span>Тип тока</span><span>Направление</span><span>Коэффициент</span></div>',
      '<div class="analysis-row transport"><strong>Axial CVE</strong><span>axial J₅</span><span>∥ ω</span><span>T²/6 + μ₅²/(2π²)</span></div>',
      '<div class="analysis-row transport"><strong>Magnetic CME</strong><span>vector/electric j</span><span>∥ B</span><span>e² μ₅/(2π²)</span></div>'
    ].join("");

    const note =
      '<div class="missing-note"><strong>Не суммируется в L₅₁₁:</strong> ' +
      'это разные токи с разными направлениями и квантовыми числами. ' +
      'Без отдельной геометрии, кинетики, relaxation и pair-production closure ' +
      'перевод jCME в позитронную светимость был бы выдуманным. ' +
      'В текущем CVE коэффициенте доля μ₅²-члена = ' +
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


  function renderPlasma() {
    if ($("mode").value !== "cme") {
      setAnalysisMeta(
        "Finite-Mass Plasma",
        "massive Dirac CVE diagnostic is attached to the stationary CVE closure"
      );
      setAnalysisTable(
        '<div class="inference-empty">Переключи режим на CVE closure.</div>'
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
        '<div class="inference-empty">Переключи режим на CVE closure.</div>'
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
      '<div class="analysis-row analysis-row-head calibration"><span>Case</span><span>Ṁ, M☉/yr</span><span>nₑ,net cm⁻³</span><span>μ_V MeV</span><span>CVE suppression</span><span>L/L₅₁₁</span><span>Deficit</span><span>Context</span></div>',
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
          "<br>L/L₅₁₁=%{customdata[2]:.3e}" +
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
        '<div class="inference-empty">Переключи режим на CVE closure.</div>'
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
      '<div class="analysis-row analysis-row-head flow-geometry"><span>Case</span><span>r/r_g</span><span>H/r</span><span>α</span><span>|v_r|/c</span><span>Y_e</span><span>nₑ,net</span><span>L/L₅₁₁</span><span>Deficit</span></div>',
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
      "Что выведено внутри принятой модели, что идеализировано, а что остаётся phenomenological ansatz"
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
        "n₅(t) diagnostic определён для стационарной CVE closure"
      );
      setAnalysisTable(
        '<div class="inference-empty">Переключи режим на CVE closure. Динамика хиральности не подключена к другим luminosity-веткам.</div>'
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
        "Феноменологические gain-каналы определены только для CVE closure"
      );
      setAnalysisTable(
        '<div class="inference-empty">Переключи режим на CME. Эта вкладка не меняет основной расчёт и служит только диагностикой.</div>'
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
      "g_extra — феноменологический диагностический множитель; основной CVE-результат остаётся неизменным"
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
      '<div><span>Selected L/L₅₁₁</span><strong>' +
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
    const layout = plotLayout("log₁₀ g_extra", "log₁₀ L/L₅₁₁");
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
        "log₁₀ g=%{x:.2f}<br>log₁₀ L/L₅₁₁=%{y:.2f}<extra></extra>"
    }];

    if (selectedY !== null) {
      traces.push({
        type: "scatter",
        mode: "markers",
        x: [Number($("missingGainExp").value)],
        y: [selectedY],
        marker: { size: 10, color: colors.accent2 },
        hovertemplate:
          "selected<br>log₁₀ g=%{x:.2f}<br>log₁₀ L/L₅₁₁=%{y:.2f}<extra></extra>"
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
      current: "Текущие параметры"
    };

    setAnalysisMeta(
      "Сравнение сценариев",
      modeNames[mode] + " · одна и та же метрика L/L₅₁₁"
    );

    const html = [
      '<div class="analysis-row analysis-row-head compare"><span>Сценарий</span><span>a/M</span><span>B₀</span><span>L/L₅₁₁</span></div>',
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
    const layout = plotLayout("сценарий", "L/L₅₁₁");
    layout.yaxis.type = "log";
    Plotly.react("plot", [{
      type: "bar",
      x: scenarios.map((item) => names[item.name]),
      y: scenarios.map((item) => item.metric > 0 ? item.metric : null),
      marker: { color: themeColors().accent2 },
      hovertemplate: "%{x}<br>L/L₅₁₁=%{y:.3e}<extra></extra>"
    }], layout, { responsive: true, displaylogo: false });
  }

  function renderAnalysis(kind = state.analysis) {
    state.analysis = kind;
    document.querySelectorAll(".analysis-tab").forEach((button) => {
      button.classList.toggle("active", button.dataset.analysis === kind);
    });

    $("explorerControls").classList.toggle("hidden", kind !== "explorer");
    $("chiralityControls").classList.toggle("hidden", kind !== "chirality");
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
      $("runStatus").textContent = "Расчёт завершён";
      $("runStatusDot").style.background = "var(--ok)";
      renderAnalysis(state.analysis);
    } catch (error) {
      $("runStatus").textContent = "Ошибка параметров";
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
    if (!state.lastResult) return toast("Сначала выполни расчёт.");
    const diagnostics = currentDiagnostics();
    const payload = {
      generatedAt: new Date().toISOString(),
      model: "AxionBH research workbench v8.2",
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
    if (!state.lastResult) return toast("Сначала выполни расчёт.");
    const diagnostics = currentDiagnostics();
    const stateId = runStateId(state.lastMode, state.lastParams);
    const lines = [
      "# AxionBH reproducibility report",
      "",
      "- Model: AxionBH Research Workbench v8.2",
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
    if (!state.lastResult) return toast("Сначала выполни расчёт.");
    const text = detailedRows(state.lastResult)
      .map(([key, value]) => key + ": " + value)
      .join("\n");
    try {
      await navigator.clipboard.writeText(text);
      toast("Результаты скопированы.");
    } catch {
      toast("Буфер обмена недоступен.");
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
      missingPhysics: {
        placement: $("missingPlacement").value,
        gainExp: Number($("missingGainExp").value)
      }
    }));

    try {
      await navigator.clipboard.writeText(url.toString());
      toast("Ссылка на этот расчёт скопирована.");
    } catch {
      window.prompt("Скопируй ссылку:", url.toString());
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

      if (["spin", "explorer", "sensitivity", "inference", "transport", "plasma", "calibration", "flow", "validity", "chirality", "missing", "compare"].includes(payload.analysis)) {
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
      updateMissingGainLabel();
      $("preset").value = "custom";
      updateConditionalFields();
      updatePresetButtons();
      return true;
    } catch {
      toast("Не удалось прочитать параметры из ссылки.");
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
    updateMissingGainLabel();
    restoreSharedState();
    run();
  }

  document.addEventListener("DOMContentLoaded", init);
})();

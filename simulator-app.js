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
    cme: "CME / стационарное облако",
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
    nProfile: "n",
    axionMassEv: "mₐ",
    burstEnergy: "E_burst",
    burstIntervalYears: "Δt_burst",
    burstDuration: "t_burst",
    burstEfficiency: "ε_burst"
  };

  const parameterIds = [
    "massSolar", "spin", "B0", "betaTurb", "faGev", "mEff", "mdot",
    "temperature", "nProfile", "axionMassEv", "burstEnergy",
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
        ["ā", A.formatScientific(result.aBar), "самосогласованное поле"],
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
        ["μ₅", A.formatScientific(result.mu5)],
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
    setAnalysisMeta("κ как функция спина", "CME-ветка · логарифмическая шкала");
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
    return [Math.min(...values), Math.max(...values)];
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

  function renderParameterExplorer() {
    setAnalysisMeta(
      "3D Parameter Explorer",
      "CME · spin × B₀ · fₐ задаёт логарифмический срез; A и B используют один fₐ"
    );

    const data = getExplorerComparison();
    setAnalysisTable(
      explorerSummary(
        data.referenceKey,
        data.faGev,
        data.resolution,
        data.comparison.differencePercent
      )
    );

    if (!window.Plotly) {
      return toast("Plotly не загрузился; сетка рассчитана, но не может быть нарисована.");
    }

    const view = $("explorerView").value;
    if (view === "difference") renderExplorerDifference(data);
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
    $("plot").classList.toggle("plot-tall", kind === "explorer");

    setAnalysisBusy(true);
    window.requestAnimationFrame(() => {
      try {
        if (kind === "explorer") renderParameterExplorer();
        else if (kind === "sensitivity") renderSensitivity();
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

  function downloadJson() {
    if (!state.lastResult) return toast("Сначала выполни расчёт.");
    const payload = {
      generatedAt: new Date().toISOString(),
      model: "AxionBH research workbench v7.2",
      mode: state.lastMode,
      parameters: state.lastParams,
      result: state.lastResult,
      note: "Exploratory model output; not a validated astrophysical inference."
    };
    const blob = new Blob(
      [JSON.stringify(payload, null, 2)],
      { type: "application/json" }
    );
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = "axionbh-result-" + Date.now() + ".json";
    anchor.click();
    URL.revokeObjectURL(url);
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
      mode: $("mode").value,
      params: p
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

    document.querySelectorAll('input[type="range"]').forEach((input) => {
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
    $("themeBtn").addEventListener("click", toggleTheme);

    document.querySelectorAll(".analysis-tab").forEach((button) => {
      button.addEventListener("click", () => renderAnalysis(button.dataset.analysis));
    });

    updateConditionalFields();
    restoreSharedState();
    run();
  }

  document.addEventListener("DOMContentLoaded", init);
})();

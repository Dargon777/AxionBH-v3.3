(() => {
  "use strict";

  const A = window.AxionBH;
  const $ = (id) => document.getElementById(id);
  const state = { lastResult: null, lastParams: null, lastMode: "cme" };

  const modeNames = {
    cme: "CME / стационарное облако",
    bosenova: "Bosenova / ручные вспышки",
    superradiant: "Суперрадиантный рост",
    hybrid: "Superradiant + Bosenova"
  };

  const parameterIds = [
    "massSolar","spin","B0","betaTurb","faGev","mEff","mdot",
    "temperature","nProfile","axionMassEv","burstEnergy",
    "burstIntervalYears","burstDuration","burstEfficiency"
  ];

  function n(id) {
    return Number($(id).value);
  }

  function params() {
    const out = {};
    parameterIds.forEach((id) => { out[id] = n(id); });
    return A.normalizeParams(out);
  }

  function setValue(id, value) {
    $(id).value = value;
    const output = $(id + "Out");
    if (output) output.textContent = displayInput(value);
  }

  function displayInput(value) {
    const v = Number(value);
    if (!Number.isFinite(v)) return "—";
    if ((Math.abs(v) >= 1e5 || (Math.abs(v) > 0 && Math.abs(v) < 1e-3))) {
      return v.toExponential(2);
    }
    return String(Number(v.toPrecision(5)));
  }

  function setPreset(name) {
    if (name === "custom") return;
    const preset = A.PRESETS[name];
    if (!preset) return;
    Object.entries(preset).forEach(([key, value]) => {
      if ($(key)) setValue(key, value);
    });
    run();
  }

  function updateConditionalFields() {
    const mode = $("mode").value;
    $("bosenovaFields").classList.toggle("hidden", !["bosenova","hybrid"].includes(mode));
    $("axionMassField").classList.toggle("hidden", !["superradiant","hybrid"].includes(mode));
    $("burstManualFields").classList.toggle("hidden", mode !== "bosenova");
  }

  function formatRatio(v) {
    if (!Number.isFinite(v)) return "—";
    if (v === 0) return "0 ×";
    if (v >= .01 && v < 1000) return v.toPrecision(4) + " ×";
    return A.formatScientific(v, 3) + " ×";
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

    $("metricGrid").innerHTML = primaryMetrics(result).map(([k,v,d]) =>
      '<div class="metric"><span>'+k+'</span><strong>'+v+'</strong><small>'+d+'</small></div>'
    ).join("");

    $("resultTable").innerHTML = detailedRows(result).flatMap(([k,v]) => [
      '<div class="key">'+k+'</div>',
      '<div class="value">'+v+'</div>'
    ]).join("");

    const ratio = Number(result.ratio511 || 0);
    const ratioText = ratio >= 1
      ? "Модель в этой точке достигает или превышает выбранную опорную светимость."
      : "Модель в этой точке ниже выбранной опорной светимости.";
    $("interpretation").textContent = ratioText;
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
    } catch (error) {
      $("runStatus").textContent = "Ошибка параметров";
      $("runStatusDot").style.background = "var(--danger)";
      toast(error.message || String(error));
    }
  }

  function plot() {
    try {
      const p = params();
      const points = A.spinSweep(p, 72);
      if (!window.Plotly) {
        toast("Plotly не загрузился; сам расчёт при этом работает.");
        return;
      }
      const theme = document.documentElement.dataset.theme || "dark";
      const dark = theme !== "light";
      Plotly.react("plot", [{
        x: points.map(x => x.spin),
        y: points.map(x => x.kappa > 0 ? x.kappa : null),
        mode: "lines",
        line: { width: 3 },
        hovertemplate: "a/M=%{x:.3f}<br>κ=%{y:.3e}<extra></extra>"
      }], {
        paper_bgcolor: "transparent",
        plot_bgcolor: "transparent",
        font: { color: dark ? "#cbd5e1" : "#475569" },
        xaxis: { title: "spin a/M", gridcolor: dark ? "#233044" : "#dce3ed" },
        yaxis: { title: "κ", type: "log", gridcolor: dark ? "#233044" : "#dce3ed" },
        margin: { l: 66, r: 20, t: 24, b: 58 },
        shapes: [{
          type: "line", x0: .35, x1: .35, y0: 0, y1: 1, yref: "paper",
          line: { dash: "dot", width: 1 }
        }]
      }, { responsive: true, displaylogo: false });
    } catch (error) {
      toast(error.message || String(error));
    }
  }

  function downloadJson() {
    if (!state.lastResult) return toast("Сначала выполни расчёт.");
    const payload = {
      generatedAt: new Date().toISOString(),
      model: "AxionBH browser simulator v7",
      mode: state.lastMode,
      parameters: state.lastParams,
      result: state.lastResult,
      note: "Exploratory model output; not a validated astrophysical inference."
    };
    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "axionbh-result-" + Date.now() + ".json";
    a.click();
    URL.revokeObjectURL(url);
  }

  async function copyResult() {
    if (!state.lastResult) return toast("Сначала выполни расчёт.");
    const text = detailedRows(state.lastResult).map(([k,v]) => k + ": " + v).join("\n");
    try {
      await navigator.clipboard.writeText(text);
      toast("Результаты скопированы.");
    } catch {
      toast("Буфер обмена недоступен в этом браузере.");
    }
  }

  function toggleTheme() {
    const current = document.documentElement.dataset.theme || "dark";
    const next = current === "dark" ? "light" : "dark";
    document.documentElement.dataset.theme = next;
    localStorage.setItem("axionbh-theme", next);
    if (state.lastResult) plot();
  }

  let toastTimer;
  function toast(message) {
    const el = $("toast");
    el.textContent = message;
    el.classList.add("show");
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => el.classList.remove("show"), 2400);
  }

  function init() {
    const savedTheme = localStorage.getItem("axionbh-theme");
    if (savedTheme === "light") document.documentElement.dataset.theme = "light";

    Object.entries(A.DEFAULTS).forEach(([key,value]) => {
      if ($(key)) setValue(key,value);
    });

    document.querySelectorAll('input[type="range"]').forEach((input) => {
      input.addEventListener("input", () => {
        const out = $(input.id + "Out");
        if (out) out.textContent = displayInput(input.value);
        $("preset").value = "custom";
      });
    });

    parameterIds.forEach((id) => {
      const el = $(id);
      if (el && el.type !== "range") el.addEventListener("input", () => $("preset").value = "custom");
    });

    $("preset").addEventListener("change", (e) => setPreset(e.target.value));
    $("mode").addEventListener("change", () => { updateConditionalFields(); run(); });
    $("runBtn").addEventListener("click", run);
    $("plotBtn").addEventListener("click", plot);
    $("copyBtn").addEventListener("click", copyResult);
    $("exportBtn").addEventListener("click", downloadJson);
    $("themeBtn").addEventListener("click", toggleTheme);

    updateConditionalFields();
    run();
    plot();
  }

  document.addEventListener("DOMContentLoaded", init);
})();

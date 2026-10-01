const fs = require("node:fs");
const assert = require("node:assert/strict");

const html = fs.readFileSync("sim.html", "utf8");
const app = fs.readFileSync("simulator-app.js", "utf8");
const core = fs.readFileSync("simulator-core.js", "utf8");

assert.ok(html.includes('src="simulator-core.js"'));
assert.ok(html.includes('src="simulator-app.js"'));
assert.ok(html.includes('href="simulator.css"'));
assert.ok(!html.includes("pyodide"));
assert.ok(!html.includes("runPythonAsync"));
assert.ok(!html.includes("FORMSPREE"));
assert.ok(!html.includes("CUSTOM_SERVER_URL"));
assert.ok(!html.includes("GOOGLE_FORM_URL"));
assert.ok(!html.includes("passwordModal"));
assert.ok(!app.includes("fetch("));
assert.ok(core.includes("spinSweep"));
assert.ok(core.includes("manualBosenova"));

const ids = [...html.matchAll(/id="([^"]+)"/g)].map((m) => m[1]);
const duplicates = ids.filter((id, index) => ids.indexOf(id) !== index);
assert.deepEqual(duplicates, []);

console.log("AxionBH static integrity checks passed");


assert.doesNotThrow(() => new Function(app));
assert.doesNotThrow(() => new Function(core));

for (const id of [
  "savePresetBtn",
  "deletePresetBtn",
  "shareBtn",
  "analysisTitle",
  "analysisTable",
  "analysisBusy",
  "plot"
]) {
  assert.ok(html.includes('id="' + id + '"'), "missing UI id: " + id);
}

for (const feature of [
  "parameterMap",
  "sensitivityAnalysis",
  "comparePresets",
  "shareCurrentState",
  "USER_PRESETS_KEY"
]) {
  assert.ok(
    core.includes(feature) || app.includes(feature),
    "missing workbench feature: " + feature
  );
}

assert.ok(!app.includes("fetch("));
assert.ok(!app.includes("XMLHttpRequest"));


for (const id of [
  "explorerControls",
  "explorerView",
  "explorerReference",
  "explorerFaExp",
  "explorerFaOut",
  "explorerResolution"
]) {
  assert.ok(html.includes('id="' + id + '"'), "missing explorer UI id: " + id);
}

for (const feature of [
  "compareParameterMaps",
  "parameterSlices",
  "relativeDifferencePercent",
  "renderParameterExplorer",
  "renderExplorerSurface",
  "renderExplorerContour",
  "renderExplorerDifference",
  "scheduleExplorerRender"
]) {
  assert.ok(
    core.includes(feature) || app.includes(feature),
    "missing v7.2 explorer feature: " + feature
  );
}

assert.ok(html.includes('data-analysis="explorer"'));
assert.ok(!html.includes('data-analysis="map"'));


for (const id of [
  "reportBtn",
  "diagnostics",
  "explorerCsvBtn"
]) {
  assert.ok(html.includes('id="' + id + '"'), "missing v7.3 UI id: " + id);
}

for (const feature of [
  "diagnoseRun",
  "runStateId",
  "downloadReport",
  "downloadExplorerCsv",
  "root_residual"
]) {
  assert.ok(
    core.includes(feature) || app.includes(feature),
    "missing v7.3 reproducibility feature: " + feature
  );
}

for (const feature of [
  "selfConsistencyCoefficients",
  "selfConsistencyBranches",
  "temperatureGeV",
  "magneticFieldGeV2",
  "fixed_point_slope",
  "unit_system"
]) {
  assert.ok(
    core.includes(feature) || app.includes(feature),
    "missing v7.4 CME unit-audit feature: " + feature
  );
}

assert.ok(html.includes("v7.9"));
assert.ok(app.includes("AxionBH research workbench v7.9"));


for (const feature of [
  "deficitOrders",
  "parameterDeficitMap",
  "inferParameterTarget",
  "parameterInference",
  "renderInference",
  "renderExplorerDeficit"
]) {
  assert.ok(
    core.includes(feature) || app.includes(feature),
    "missing v7.5 inference feature: " + feature
  );
}

assert.ok(html.includes('data-analysis="inference"'));
assert.ok(html.includes('<option value="deficit">'));


for (const id of [
  "missingPhysicsControls",
  "missingPlacement",
  "missingGainExp",
  "missingGainOut"
]) {
  assert.ok(html.includes('id="' + id + '"'), "missing v7.6 UI id: " + id);
}

for (const feature of [
  "cmeWithGains",
  "cmeClosureCeiling",
  "missingPhysicsPoint",
  "missingPhysicsSweep",
  "missingPhysicsAnalysis",
  "renderMissingPhysics",
  "missingGainValue"
]) {
  assert.ok(
    core.includes(feature) || app.includes(feature),
    "missing v7.6 missing-physics feature: " + feature
  );
}

assert.ok(html.includes('data-analysis="missing"'));


for (const feature of [
  "chiralMagneticConductivity",
  "chiralMagneticCurrent",
  "axialVorticalCurrent",
  "anomalousTransportDiagnostics",
  "anomalousTransportSweep",
  "renderTransport"
]) {
  assert.ok(
    core.includes(feature) || app.includes(feature),
    "missing v7.7 transport feature: " + feature
  );
}

assert.ok(html.includes('data-analysis="transport"'));
assert.ok(app.includes("CVE closure / стационарное облако"));


for (const id of [
  "chiralityControls",
  "chiralityFlipExp",
  "chiralityFlipOut",
  "chiralityTimeExp",
  "chiralityTimeOut",
  "chiralityAnomalyMode",
  "chiralityEExp",
  "chiralityEOut"
]) {
  assert.ok(
    html.includes('id="' + id + '"'),
    "missing v7.8 chirality UI id: " + id
  );
}

for (const feature of [
  "axialChargeDensity",
  "axialSusceptibility",
  "mu5FromAxialCharge",
  "chiralitySourceProxy",
  "chiralityDynamics",
  "chiralityDynamicsSeries",
  "renderChirality"
]) {
  assert.ok(
    core.includes(feature) || app.includes(feature),
    "missing v7.8 chirality feature: " + feature
  );
}

assert.ok(html.includes('data-analysis="chirality"'));


for (const id of [
  "electronMuMeV"
]) {
  assert.ok(
    html.includes('id="' + id + '"'),
    "missing v7.9 plasma UI id: " + id
  );
}

for (const feature of [
  "massiveCveDimensionlessIntegral",
  "massiveAxialVorticalConductivity",
  "masslessAxialVorticalReference",
  "finiteMassPlasmaDiagnostics",
  "finiteMassPlasmaSweep",
  "renderPlasma"
]) {
  assert.ok(
    core.includes(feature) || app.includes(feature),
    "missing v7.9 finite-mass feature: " + feature
  );
}

assert.ok(html.includes('data-analysis="plasma"'));

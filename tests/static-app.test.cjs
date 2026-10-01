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
